import { describe, it, expect } from "vitest";
import {
  findPaidPaymentForAppointment,
  isPayMongoReference,
  resolvePaymentFromResource,
  validatePaymentForAppointment,
  type ResolvedPayment,
} from "@/lib/paymongoVerification";

const PATIENT = "11111111-1111-1111-1111-111111111111";
const OTHER_PATIENT = "22222222-2222-2222-2222-222222222222";
const APT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_APT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

// Shapes follow PayMongo's v1 API (amounts in centavos)
const paymentResource = (over: Record<string, any> = {}) => ({
  id: "pay_abc123",
  type: "payment",
  attributes: {
    status: "paid",
    amount: 400000,
    source: { type: "gcash" },
    metadata: { appointment_id: APT, patient_id: PATIENT },
    ...over,
  },
});

const checkoutResource = (paymentOver: Record<string, any> = {}, sessionMeta: Record<string, any> = {}) => ({
  id: "cs_xyz789",
  type: "checkout_session",
  attributes: {
    payment_method_used: "paymaya",
    metadata: { appointment_id: APT, patient_id: PATIENT, ...sessionMeta },
    payments: [
      { id: "pay_fromcs", type: "payment", attributes: { status: "paid", amount: 500000, metadata: {}, ...paymentOver } },
    ],
  },
});

const good: ResolvedPayment = {
  paymentId: "pay_abc123",
  status: "paid",
  amount: 4000,
  method: "gcash",
  appointmentId: APT,
  patientId: PATIENT,
};

describe("resolvePaymentFromResource()", () => {
  it("reads a pay_ resource and converts centavos to pesos", () => {
    expect(resolvePaymentFromResource(paymentResource())).toEqual(good);
  });

  it("reads a cs_ checkout session using the session metadata", () => {
    expect(resolvePaymentFromResource(checkoutResource())).toEqual({
      paymentId: "pay_fromcs",
      status: "paid",
      amount: 5000,
      method: "paymaya",
      appointmentId: APT,
      patientId: PATIENT,
    });
  });

  it("session metadata wins over payment metadata", () => {
    const r = resolvePaymentFromResource(checkoutResource({ metadata: { patient_id: OTHER_PATIENT } }));
    expect(r?.patientId).toBe(PATIENT);
  });

  it("returns null for a checkout session with no payments (customer never paid)", () => {
    const cs = checkoutResource();
    cs.attributes.payments = [];
    expect(resolvePaymentFromResource(cs)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolvePaymentFromResource(null)).toBeNull();
    expect(resolvePaymentFromResource({} as any)).toBeNull();
  });
});

describe("validatePaymentForAppointment() — the fake-payment hole", () => {
  it("accepts a paid payment for this patient and appointment", () => {
    const v = validatePaymentForAppointment(good, { patientId: PATIENT, appointmentId: APT });
    expect(v).toEqual({ ok: true, appointmentId: APT, payment: good });
  });

  it("resolves the appointment from metadata when none is given", () => {
    const v = validatePaymentForAppointment(good, { patientId: PATIENT });
    expect(v.ok && v.appointmentId).toBe(APT);
  });

  it("rejects a made-up reference that PayMongo doesn't know (was: marked paid at ₱300)", () => {
    const v = validatePaymentForAppointment(null, { patientId: PATIENT, appointmentId: APT });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.status).toBe(404);
  });

  it.each(["unpaid", "pending", "failed", "awaiting_next_action"])("rejects a payment with status %s", (status) => {
    const v = validatePaymentForAppointment({ ...good, status }, { patientId: PATIENT, appointmentId: APT });
    expect(v.ok).toBe(false);
  });

  it("rejects someone else's payment", () => {
    const v = validatePaymentForAppointment({ ...good, patientId: OTHER_PATIENT }, { patientId: PATIENT, appointmentId: APT });
    expect(!v.ok && v.status).toBe(403);
  });

  it("rejects a payment with no patient metadata", () => {
    const v = validatePaymentForAppointment({ ...good, patientId: undefined }, { patientId: PATIENT, appointmentId: APT });
    expect(v.ok).toBe(false);
  });

  it("rejects reusing one appointment's payment for another appointment", () => {
    const v = validatePaymentForAppointment(good, { patientId: PATIENT, appointmentId: OTHER_APT });
    expect(!v.ok && v.status).toBe(409);
  });

  it("rejects a payment not linked to any appointment", () => {
    const v = validatePaymentForAppointment({ ...good, appointmentId: undefined }, { patientId: PATIENT });
    expect(v.ok).toBe(false);
  });

  it("rejects zero or negative amounts", () => {
    expect(validatePaymentForAppointment({ ...good, amount: 0 }, { patientId: PATIENT }).ok).toBe(false);
    expect(validatePaymentForAppointment({ ...good, amount: -5 }, { patientId: PATIENT }).ok).toBe(false);
  });
});

describe("findPaidPaymentForAppointment()", () => {
  it("finds the paid payment for the appointment", () => {
    const list = [
      paymentResource({ status: "failed" }),
      paymentResource({ metadata: { appointment_id: OTHER_APT, patient_id: PATIENT } }),
      { ...paymentResource(), id: "pay_right" },
    ];
    expect(findPaidPaymentForAppointment(list, APT)?.paymentId).toBe("pay_right");
  });

  it("does NOT fall back to another appointment of the same patient (old behaviour)", () => {
    const list = [paymentResource({ metadata: { appointment_id: OTHER_APT, patient_id: PATIENT } })];
    expect(findPaidPaymentForAppointment(list, APT)).toBeNull();
  });

  it("handles empty lists", () => {
    expect(findPaidPaymentForAppointment([], APT)).toBeNull();
  });
});

describe("isPayMongoReference()", () => {
  it.each(["pay_abc123", "cs_ZZ9", " pay_abc "])("accepts %s", (ref) => {
    expect(isPayMongoReference(ref)).toBe(true);
  });

  it.each(["", "abc", "pay_", "pay_<script>", "src_123", "pay_abc; drop", null, 42])("rejects %s", (ref) => {
    expect(isPayMongoReference(ref)).toBe(false);
  });
});
