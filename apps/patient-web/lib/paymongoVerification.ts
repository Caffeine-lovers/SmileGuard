/**
 * Pure helpers that decide whether a PayMongo payment may settle a SmileGuard appointment.
 * No network / Supabase access here — the API route fetches from PayMongo and passes the JSON in.
 */

export interface ResolvedPayment {
  paymentId: string;
  status: string;
  /** Amount in pesos (PayMongo reports centavos). */
  amount: number;
  method: string;
  appointmentId?: string;
  patientId?: string;
}

type PayMongoResource = {
  id?: string;
  type?: string;
  attributes?: Record<string, any>;
} | null | undefined;

const toPesos = (centavos: unknown) => (Number(centavos) || 0) / 100;

function fromPaymentResource(payment: PayMongoResource, fallbackMeta: Record<string, any> = {}): ResolvedPayment | null {
  if (!payment?.id || !payment.attributes) return null;
  const a = payment.attributes;
  const meta = { ...fallbackMeta, ...(a.metadata || {}) };
  return {
    paymentId: payment.id,
    status: String(a.status || 'unknown'),
    amount: toPesos(a.amount),
    method: a.source?.type || a.payment_method_used || 'online',
    appointmentId: meta.appointment_id || undefined,
    patientId: meta.patient_id || undefined,
  };
}

/**
 * Normalise either a `payment` (pay_…) or a `checkout_session` (cs_…) resource into one shape.
 * For checkout sessions the session metadata (set by /api/paymongo/create-checkout) is authoritative.
 */
export function resolvePaymentFromResource(resource: PayMongoResource): ResolvedPayment | null {
  if (!resource?.attributes) return null;
  const isCheckout = resource.type === 'checkout_session' || String(resource.id || '').startsWith('cs_');
  if (!isCheckout) return fromPaymentResource(resource);

  const sessionMeta = resource.attributes.metadata || {};
  const payments: PayMongoResource[] = resource.attributes.payments || [];
  const paid = payments.find((p) => p?.attributes?.status === 'paid') || payments[0];
  const resolved = fromPaymentResource(paid, {});
  if (!resolved) return null;
  // Session metadata wins over anything on the payment object.
  return {
    ...resolved,
    method: resource.attributes.payment_method_used || resolved.method,
    appointmentId: sessionMeta.appointment_id || resolved.appointmentId,
    patientId: sessionMeta.patient_id || resolved.patientId,
  };
}

/** Find the paid payment for an appointment in a PayMongo `GET /payments` list. */
export function findPaidPaymentForAppointment(payments: PayMongoResource[], appointmentId: string): ResolvedPayment | null {
  for (const p of payments || []) {
    const r = fromPaymentResource(p);
    if (r && r.status === 'paid' && r.appointmentId === appointmentId) return r;
  }
  return null;
}

export type PaymentValidation =
  | { ok: true; appointmentId: string; payment: ResolvedPayment }
  | { ok: false; status: number; reason: string };

/**
 * A payment may only settle a bill when PayMongo says it is paid, it was created for this
 * patient, and it was created for this appointment.
 */
export function validatePaymentForAppointment(
  payment: ResolvedPayment | null,
  ctx: { patientId: string; appointmentId?: string | null }
): PaymentValidation {
  if (!payment) {
    return { ok: false, status: 404, reason: 'No matching payment was found on PayMongo for this reference.' };
  }
  if (payment.status !== 'paid') {
    return { ok: false, status: 402, reason: `This payment is not completed yet (PayMongo status: ${payment.status}).` };
  }
  if (!(payment.amount > 0)) {
    return { ok: false, status: 422, reason: 'PayMongo reported an invalid payment amount.' };
  }
  if (!payment.patientId || payment.patientId !== ctx.patientId) {
    return { ok: false, status: 403, reason: 'This payment does not belong to your account.' };
  }
  if (!payment.appointmentId) {
    return { ok: false, status: 422, reason: 'This payment is not linked to a SmileGuard appointment.' };
  }
  if (ctx.appointmentId && payment.appointmentId !== ctx.appointmentId) {
    return { ok: false, status: 409, reason: 'This payment was made for a different appointment.' };
  }
  return { ok: true, appointmentId: payment.appointmentId, payment };
}

/** PayMongo reference IDs we accept from users. */
export function isPayMongoReference(ref: unknown): ref is string {
  return typeof ref === 'string' && /^(pay|cs)_[A-Za-z0-9]+$/.test(ref.trim());
}
