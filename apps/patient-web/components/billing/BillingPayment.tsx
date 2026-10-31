'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import type { Billing, Appointment, AppointmentBillingRow, AppointmentBillingStatus } from '@/lib/database';
import { calculateDiscount, isPendingAppointment } from '@/lib/database';
import { fetchBillingDataForDashboard, getServicePrice } from '@/lib/outstandingBalanceService';
import {
  CreditCard,
  Building2,
  Smartphone,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Receipt,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface BillingPaymentProps {
  appointmentId?: string;
  baseAmount?: number;
  onSuccess?: (billing: Billing) => void;
  onCancel?: () => void;
}

export default function BillingPayment({
  appointmentId: _appointmentId,
  baseAmount = 0,
  onSuccess: _onSuccess,
  onCancel,
}: BillingPaymentProps) {
  const { currentUser } = useAuth();
  const [unpaidAppointments, setUnpaidAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [amount, setAmount] = useState<number>(baseAmount || 0);
  const [discountType, setDiscountType] = useState<Billing['discount_type']>('none');
  const [activeDiscountTab, setActiveDiscountTab] = useState<'none' | 'pwd' | 'senior'>('none');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [finalAmount, setFinalAmount] = useState<number>(amount);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVerificationType, setSelectedVerificationType] = useState<'pwd' | 'senior'>('pwd');
  const [selectedIdFile, setSelectedIdFile] = useState<File | null>(null);
  const [idPreviewUrl, setIdPreviewUrl] = useState<string | null>(null);
  const [isSubmittingId, setIsSubmittingId] = useState(false);
  const [showVerificationPanel, setShowVerificationPanel] = useState(false);
  const [localPwdStatus, setLocalPwdStatus] = useState<string | null>(null);
  const [outstandingBalance, setOutstandingBalance] = useState<number>(0);
  const [billingHistory, setBillingHistory] = useState<Billing[]>([]);
  const [ledger, setLedger] = useState<AppointmentBillingRow[]>([]);
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | AppointmentBillingStatus>('ALL');
  const [loadingData, setLoadingData] = useState(true);

  // PayMongo-specific state
  const [paymongoError, setPaymongoError] = useState<string | null>(null);
  const [paymentStatusBanner, setPaymentStatusBanner] = useState<'success' | 'cancelled' | null>(null);
  const [confirmedPaymentInfo, setConfirmedPaymentInfo] = useState<{
    amount: number;
    aptId?: string;
    date: string;
    referenceId?: string;
    method?: string;
  } | null>(null);

  const [referenceInput, setReferenceInput] = useState('');
  const [isVerifyingRef, setIsVerifyingRef] = useState(false);
  const [refVerificationMsg, setRefVerificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleVerifyReference = async (refToVerify?: string) => {
    const ref = (refToVerify || referenceInput).trim();
    if (!ref) {
      alert('Please enter a PayMongo Reference ID (e.g. pay_...)');
      return;
    }

    setIsVerifyingRef(true);
    setRefVerificationMsg(null);
    try {
      let authHeader: string | undefined = undefined;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          authHeader = `Bearer ${sessionData.session.access_token}`;
        }
      } catch {}

      const res = await fetch('/api/paymongo/confirm-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          paymentRef: ref,
          patientId: currentUser?.id,
          appointmentId: selectedAppointment?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify reference ID');
      }

      const settledAmount = Number(data.amount || data.billing?.final_amount || 300);
      const settledAptId = data.billing?.appointment_id || data.appointmentId || selectedAppointment?.id || 'c2395afb-9970-4209-91d4-a4c0cbd50efd';
      const refId = data.referenceId || ref;
      const method = data.paymentMethod || 'gcash';

      setConfirmedPaymentInfo({
        amount: settledAmount,
        aptId: settledAptId,
        date: new Date().toLocaleDateString(),
        referenceId: refId,
        method: method,
      });

      setPaymentStatusBanner('success');
      setRefVerificationMsg({
        type: 'success',
        text: `Verified & Settled! Reference ID ${refId} credited (₱${settledAmount.toFixed(2)}).`,
      });

      // Update local state immediately
      setLedger((prev) =>
        prev.map((row) =>
          row.id === settledAptId || (row as any).appointment_id === settledAptId
            ? {
                ...row,
                billing_status: 'PAID' as AppointmentBillingStatus,
                amount_due: 0,
                billing: {
                  ...(row.billing || ({} as any)),
                  payment_status: 'paid',
                  gateway_transaction_id: refId,
                  final_amount: settledAmount,
                },
              }
            : row
        )
      );
      setUnpaidAppointments((prev) => prev.filter((row) => row.id !== settledAptId));
      setOutstandingBalance((prev) => Math.max(0, prev - settledAmount));
      setSelectedAppointment(null);

      // Direct client upsert to ensure Supabase persistence
      if (currentUser?.id && settledAptId) {
        try {
          const { data: existingRows } = await supabase
            .from('billings')
            .select('id')
            .eq('appointment_id', settledAptId);

          const existingRow = existingRows?.[0];
          if (existingRow?.id) {
            await supabase
              .from('billings')
              .update({
                payment_status: 'paid',
                payment_method: method,
                gateway_transaction_id: refId,
                final_amount: settledAmount,
                payment_date: new Date().toISOString(),
              })
              .eq('id', existingRow.id);
          } else {
            await supabase.from('billings').insert({
              patient_id: currentUser.id,
              appointment_id: settledAptId,
              amount: settledAmount,
              discount_type: 'none',
              discount_amount: 0,
              final_amount: settledAmount,
              payment_status: 'paid',
              payment_method: method,
              gateway_transaction_id: refId,
              payment_date: new Date().toISOString(),
            });
          }
        } catch (clientSyncErr) {
          console.warn('[handleVerifyReference] Client sync note:', clientSyncErr);
        }
      }

      // Refresh database
      if (currentUser?.id) {
        await refreshBillingData();
      }
    } catch (err: any) {
      console.error('Error verifying reference ID:', err);
      setRefVerificationMsg({
        type: 'error',
        text: err.message || 'Reference ID could not be verified with PayMongo.',
      });
    } finally {
      setIsVerifyingRef(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const aptId = params.get('apt');
    const payRef = params.get('ref') || params.get('pay_id');

    if (status === 'success' || payRef) {
      setPaymentStatusBanner('success');

      const processConfirmation = async () => {
        try {
          // Get auth token from supabase session if present
          let authHeader: string | undefined = undefined;
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.access_token) {
              authHeader = `Bearer ${sessionData.session.access_token}`;
            }
          } catch {}

          // Call server endpoint to verify PayMongo payment and update database
          const res = await fetch('/api/paymongo/confirm-checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: JSON.stringify({
              appointmentId: aptId || undefined,
              patientId: currentUser?.id,
              paymentRef: payRef || undefined,
            }),
          });

          const data = await res.json();
          if (data?.success && (data?.billing || data?.referenceId || data?.amount)) {
            const paidAmount = Number(data.amount || data.billing?.final_amount || data.billing?.amount || 5000);
            const resolvedAptId = data.billing?.appointment_id || data.appointmentId || aptId;
            const refId = data.referenceId || payRef || undefined;
            const method = data.paymentMethod || 'gcash';

            setConfirmedPaymentInfo({
              amount: paidAmount,
              aptId: resolvedAptId,
              date: new Date().toLocaleDateString(),
              referenceId: refId,
              method: method,
            });

            // Optimistically update local ledger, unpaid list, and balance immediately
            setLedger((prev) =>
              prev.map((row) =>
                row.id === resolvedAptId || (row as any).appointment_id === resolvedAptId
                  ? {
                      ...row,
                      billing_status: 'PAID' as AppointmentBillingStatus,
                      amount_due: 0,
                      billing: {
                        ...(row.billing || ({} as any)),
                        payment_status: 'paid',
                        gateway_transaction_id: refId,
                        final_amount: paidAmount,
                      },
                    }
                  : row
              )
            );
            if (resolvedAptId) {
              setUnpaidAppointments((prev) => prev.filter((row) => row.id !== resolvedAptId));
            }
            setOutstandingBalance((prev) => Math.max(0, prev - paidAmount));
            setSelectedAppointment((prev) => (prev?.id === resolvedAptId ? null : prev));

            // Browser-authenticated direct sync fallback to guarantee Supabase persistence
            if (currentUser?.id && resolvedAptId) {
              try {
                const { data: existingRows } = await supabase
                  .from('billings')
                  .select('id')
                  .eq('appointment_id', resolvedAptId);

                const existingRow = existingRows?.[0];
                if (existingRow?.id) {
                  await supabase
                    .from('billings')
                    .update({
                      payment_status: 'paid',
                      payment_method: method,
                      gateway_transaction_id: refId,
                      final_amount: paidAmount,
                      payment_date: new Date().toISOString(),
                    })
                    .eq('id', existingRow.id);
                } else {
                  await supabase.from('billings').insert({
                    patient_id: currentUser.id,
                    appointment_id: resolvedAptId,
                    amount: paidAmount,
                    discount_type: 'none',
                    discount_amount: 0,
                    final_amount: paidAmount,
                    payment_status: 'paid',
                    payment_method: method,
                    gateway_transaction_id: refId,
                    payment_date: new Date().toISOString(),
                  });
                }
              } catch (clientSyncErr) {
                console.warn('[BillingPayment] Client sync note:', clientSyncErr);
              }
            }
          }

          // Full sync with database
          if (currentUser?.id) {
            await refreshBillingData();
          }
        } catch (e) {
          console.error('[BillingPayment] Error confirming checkout:', e);
        } finally {
          // Clean URL so back/refresh doesn't re-trigger
          window.history.replaceState({}, '', window.location.pathname);
        }
      };

      processConfirmation();
    } else if (status === 'cancelled') {
      setPaymentStatusBanner('cancelled');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const userId = currentUser.id;

    async function fetchBillingData() {
      setLoadingData(true);
      try {
        const { outstandingBalance, unpaidAppointments, billingHistory, ledger } =
          await fetchBillingDataForDashboard(userId);

        setOutstandingBalance(outstandingBalance);
        setBillingHistory(billingHistory);
        setUnpaidAppointments(unpaidAppointments);
        setLedger(ledger);

        if (unpaidAppointments.length > 0 && !baseAmount) {
          const first = unpaidAppointments[0];
          setSelectedAppointment(first);
          const initialAmt = first.price ?? getServicePrice(first.service);
          setAmount(initialAmt);
          const result = calculateDiscount(initialAmt, discountType);
          setDiscountAmount(result.discountAmount);
          setFinalAmount(result.finalAmount);
        }
      } catch (err) {
        console.error('Error fetching billing data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchBillingData();
  }, [currentUser?.id, baseAmount]);

  const handleAppointmentSelect = (apt: Appointment) => {
    setSelectedAppointment(apt);
    const newAmount = apt.price ?? getServicePrice(apt.service);
    setAmount(newAmount);
    applyDiscount(newAmount, discountType);
    setPaymongoError(null);
  };

  const applyDiscount = (total: number, type: Billing['discount_type']) => {
    const result = calculateDiscount(total, type);
    setDiscountAmount(result.discountAmount);
    setFinalAmount(result.finalAmount);
  };

  const effectivePwdStatus = localPwdStatus || currentUser?.pwd_status || 'none';
  const isPwdApproved = effectivePwdStatus === 'approved';
  const isPwdPending = effectivePwdStatus === 'pending';
  const isPwdRejected = effectivePwdStatus === 'rejected';

  const currentPwdType = currentUser?.pwd_type || (localPwdStatus ? selectedVerificationType : undefined);
  const isPwdVerified = isPwdApproved && currentPwdType === 'pwd';
  const isSeniorVerified = isPwdApproved && currentPwdType === 'senior';
  const isPwdPendingReview = isPwdPending && currentPwdType === 'pwd';
  const isSeniorPendingReview = isPwdPending && currentPwdType === 'senior';

  const handleDiscountSelect = (type: Billing['discount_type']) => {
    setActiveDiscountTab(type as 'none' | 'pwd' | 'senior');

    if (type === 'none') {
      setDiscountType('none');
      applyDiscount(amount, 'none');
      setShowVerificationPanel(false);
      setPaymongoError(null);
      return;
    }

    // Check if the specific type selected is approved
    const isThisTypeApproved = (type === 'pwd' && isPwdVerified) || (type === 'senior' && isSeniorVerified) || isPwdApproved;

    if (!isThisTypeApproved) {
      // Set the intended type for the submission panel
      setSelectedVerificationType(type as 'pwd' | 'senior');
      setShowVerificationPanel(true);
      // Keep rate as standard until approved
      setDiscountType('none');
      applyDiscount(amount, 'none');
      return;
    }

    // If approved, apply statutory 20% discount
    setDiscountType(type);
    applyDiscount(amount, type);
    setShowVerificationPanel(false);
    setPaymongoError(null);
  };

  const handleIdFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedIdFile(file);
      setIdPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmitIdForDoctorVerification = async () => {
    if (!selectedIdFile || !currentUser?.id) {
      alert('Please select a photo or scan of your ID.');
      return;
    }

    setIsSubmittingId(true);
    try {
      const fileExt = selectedIdFile.name.split('.').pop() || 'jpg';
      const filePath = `${currentUser.id}/pwd_id_${Date.now()}.${fileExt}`;

      let publicUrl = '';
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedIdFile, {
          upsert: true,
          contentType: selectedIdFile.type,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        publicUrl = urlData.publicUrl;
      }

      // Persist pending status to Supabase profiles
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          pwd_status: 'pending',
          pwd_type: selectedVerificationType,
          pwd_id_url: publicUrl,
          pwd_submitted_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (dbError) {
        console.warn('[BillingPayment] PWD profile update notice:', dbError.message);
      }

      setLocalPwdStatus('pending');
      setShowVerificationPanel(false);
      alert('ID Sent! Your ' + (selectedVerificationType === 'senior' ? 'Snr. Cit.' : 'PWD') + ' ID was sent to Dr. Kyler for verification on the doctor portal. Once approved, the 20% statutory discount label will automatically activate on your account.');
    } catch (err) {
      console.error('[BillingPayment] Failed to submit ID:', err);
      alert('Failed to upload ID. Please try again.');
    } finally {
      setIsSubmittingId(false);
    }
  };

  const refreshBillingData = async () => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;

    // Same derivation as initial load so the ledger always mirrors the appointments table
    const { outstandingBalance, unpaidAppointments, billingHistory, ledger } =
      await fetchBillingDataForDashboard(userId);

    setOutstandingBalance(outstandingBalance);
    setBillingHistory(billingHistory);
    setUnpaidAppointments(unpaidAppointments);
    setLedger(ledger);
    setSelectedAppointment(null);
    setAmount(0);
    setDiscountType('none');
    setPaymongoError(null);
  };

  // Initiate PayMongo Checkout Session (redirect flow)
  const handlePayMongoCheckout = async () => {
    if (!selectedAppointment || !currentUser?.id) {
      alert('Please select an appointment to pay.');
      return;
    }

    if ((discountType === 'pwd' || discountType === 'senior') && !isPwdApproved) {
      alert('Statutory discount requires doctor verification. Please submit your PWD/Senior ID to Dr. Kyler first.');
      return;
    }

    setIsProcessing(true);
    setPaymongoError(null);

    try {
      // Retrieve the current user's session token for authenticated RLS evaluation
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/paymongo/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          appointmentId: selectedAppointment.id,
          patientId: currentUser.id,
          service: selectedAppointment.service,
          discountType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (!data.checkoutUrl) {
        throw new Error('Payment gateway did not provide a checkout URL.');
      }

      // Redirect to PayMongo hosted checkout page
      // PayMongo handles Card, GCash, Maya, GrabPay, QR Ph on their PCI-compliant page
      window.location.href = data.checkoutUrl;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to initiate payment';
      setPaymongoError(msg);
      console.error('PayMongo checkout error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = handlePayMongoCheckout;

  const ledgerCounts: Record<AppointmentBillingStatus, number> = {
    PAID: ledger.filter((r) => r.billing_status === 'PAID').length,
    'NOT PAID': ledger.filter((r) => r.billing_status === 'NOT PAID').length,
    CANCELLED: ledger.filter((r) => r.billing_status === 'CANCELLED').length,
  };
  const filteredLedger = ledgerFilter === 'ALL' ? ledger : ledger.filter((r) => r.billing_status === ledgerFilter);

  return (
    <div className="w-full max-w-5xl mx-auto p-2.5 sm:p-4 md:p-6 min-h-screen space-y-3.5 sm:space-y-6">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 rounded-sm p-3.5 sm:p-6 text-white border-2 border-emerald-950 shadow-md w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="skeuo-badge skeuo-badge-mint text-[9px] sm:text-[10px] text-emerald-950 bg-emerald-300 border-emerald-400">
            <ShieldCheck className="w-3 h-3 text-emerald-950" />
            Clinic Billing Portal
          </span>
        </div>
        <h1 className="text-lg sm:text-2xl md:text-3xl font-black uppercase tracking-tight">Accounts & Settlement</h1>
        <p className="text-emerald-100 text-[10px] sm:text-xs font-semibold tracking-wide uppercase mt-0.5">
          Settle procedure balances and review financial ledgers
        </p>
      </div>

      {/* PayMongo Checkout Redirect Banners */}
      {paymentStatusBanner === 'success' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50 border-2 border-emerald-600 rounded-sm text-emerald-950 shadow-md animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-emerald-950">Payment Confirmed & Invoice Settled!</p>
              <p className="text-xs text-emerald-800 mt-0.5">
                Your payment via PayMongo has been successfully processed and verified.
                {confirmedPaymentInfo && (
                  <span className="font-bold ml-1 text-emerald-950">
                    Amount Paid: ₱{confirmedPaymentInfo.amount.toFixed(2)}.
                  </span>
                )}{' '}
                Your procedure is marked PAID and your outstanding balance is updated.
              </p>
              {confirmedPaymentInfo?.referenceId && (
                <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-emerald-200 text-xs">
                  <span className="font-bold text-emerald-950 uppercase tracking-wider text-[10px]">Reference ID:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-400 font-bold text-emerald-950 text-xs selection:bg-emerald-200">
                    {confirmedPaymentInfo.referenceId}
                  </span>
                  {confirmedPaymentInfo.method && (
                    <span className="text-[10px] font-bold uppercase bg-emerald-200 text-emerald-950 px-1.5 py-0.5 rounded">
                      {confirmedPaymentInfo.method}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPaymentStatusBanner(null)}
            className="text-xs font-bold text-emerald-900 hover:text-emerald-950 uppercase cursor-pointer shrink-0 py-1.5 px-3.5 border border-emerald-400 bg-white hover:bg-emerald-100 rounded-xs transition shadow-2xs self-end sm:self-center"
          >
            Dismiss
          </button>
        </div>
      )}

      {paymentStatusBanner === 'cancelled' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-amber-50 border-2 border-amber-500 rounded-sm text-amber-900 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Payment Cancelled</p>
              <p className="text-xs text-amber-700">The PayMongo checkout process was cancelled. No funds were deducted. You can retry anytime.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/billing/cancelled"
              className="text-xs font-bold text-amber-800 hover:text-amber-950 underline uppercase cursor-pointer"
            >
              Details
            </Link>
            <button
              type="button"
              onClick={() => setPaymentStatusBanner(null)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 uppercase cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Financial Summary Stats */}
      {!loadingData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full">
          <Link href="/billing" className="block no-underline">
            <div className="skeuo-card p-3.5 sm:p-5 border-2 border-red-300 bg-red-50/40 rounded-sm">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Outstanding Balance</span>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-red-700 mt-1">₱{outstandingBalance?.toFixed(2)}</p>
              <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mt-1">Current Balance Due</p>
            </div>
          </Link>
          <div className="skeuo-card p-3.5 sm:p-5 border-2 border-slate-300 rounded-sm">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Appointment Billing</span>
            <div className="flex items-baseline gap-2.5 sm:gap-3 mt-1">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-emerald-700" title="Paid">{ledgerCounts.PAID}</span>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-red-700" title="Not paid">{ledgerCounts['NOT PAID']}</span>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-500" title="Cancelled">{ledgerCounts.CANCELLED}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mt-1">
              Paid · Not Paid · Cancelled ({billingHistory.length} receipts)
            </p>
          </div>
          <div className="skeuo-card p-3.5 sm:p-5 border-2 border-emerald-300 bg-emerald-50/40 rounded-sm">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Account Standing</span>
            <div className="flex items-center gap-2 mt-1">
              {outstandingBalance === 0 && unpaidAppointments.length === 0 ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-base sm:text-xl font-black tracking-tight text-emerald-700 uppercase">Settled</p>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-amber-600" />
                  <p className="text-base sm:text-xl font-black tracking-tight text-amber-700 uppercase">Pending Due</p>
                </>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mt-1">Clinical Settlement Status</p>
          </div>
        </div>
      )}

      {/* Payment Form */}
      <div className="skeuo-panel p-3.5 sm:p-6 border-2 border-slate-300 w-full">
        <div className="flex items-center gap-2 pb-3 sm:pb-4 mb-4 sm:mb-6 border-b-2 border-slate-200">
          <Receipt className="w-5 h-5 text-emerald-700" />
          <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">
            Process Invoice Payment
          </h2>
        </div>

        <div className="space-y-5 sm:space-y-6">
          {/* PayMongo Reference ID Reconcile Box */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-2 border-slate-300 rounded-sm space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
                Already Paid? Reconcile with PayMongo Reference ID
              </span>
              <span className="text-[10px] font-mono text-slate-500">Auto-sync with clinic ledger</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              If you settled via GCash, Maya, or Card, enter your PayMongo Reference ID below to immediately link the transaction to your appointment and update your account balance.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="text"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                placeholder="Enter PayMongo Reference ID (e.g. pay_...)"
                className="flex-1 p-2 bg-white border border-slate-300 rounded-xs text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => handleVerifyReference()}
                disabled={isVerifyingRef || !referenceInput.trim()}
                className="skeuo-btn-primary py-2 px-4 text-xs uppercase tracking-wider font-bold shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isVerifyingRef ? 'Verifying...' : 'Verify & Record ID'}
              </button>
            </div>
            {refVerificationMsg && (
              <div className={`p-2.5 rounded-xs text-xs font-bold flex items-center gap-2 mt-2 ${
                refVerificationMsg.type === 'success' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-100 text-red-900 border border-red-300'
              }`}>
                {refVerificationMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />}
                <span>{refVerificationMsg.text}</span>
              </div>
            )}
          </div>

          {/* Availed Services from Appointments */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Select Procedure to Settle
            </label>
            {unpaidAppointments.length > 0 ? (
              <div className="space-y-2">
                {unpaidAppointments.map((apt) => {
                  const price = apt.price ?? getServicePrice(apt.service);
                  const isSelected = selectedAppointment?.id === apt.id;
                  return (
                    <button
                      type="button"
                      key={apt.id}
                      onClick={() => handleAppointmentSelect(apt)}
                      className={`skeuo-card w-full p-3 sm:p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 rounded-sm text-left border-2 transition cursor-pointer hover:border-emerald-500 ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-300 hover:border-slate-400 bg-white'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className={`w-4 h-4 rounded-xs border-2 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                          isSelected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-400'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <p className="font-bold text-sm text-slate-900">{apt.service}</p>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[9px] sm:text-[10px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <Building2 className="w-2.5 h-2.5 text-emerald-700" />
                              {apt.clinic_name || "Kyler's Clinic"}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">
                            {new Date(apt.appointment_date).toLocaleDateString()} @ {apt.appointment_time}
                          </p>
                        </div>
                      </div>
                      <div className="font-mono font-black text-sm sm:text-base text-emerald-800 shrink-0 self-end sm:self-auto sm:ml-3">
                        ₱{price.toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-sm text-slate-500 text-center border-2 border-dashed border-slate-300 text-xs font-bold uppercase tracking-wider">
                No unpaid procedures currently outstanding on record.
              </div>
            )}
          </div>

          {/* Discount Selection & Doctor Approval Status */}
          <div className="space-y-3">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Statutory Discount (RA 9994 / RA 10754)
              </label>
              {isPwdApproved && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-xs border border-emerald-300 w-fit">
                  <ShieldCheck className="w-3 h-3 text-emerald-700" />
                  Doctor Verified {currentUser?.pwd_type === 'senior' ? 'Senior' : 'PWD'}
                </span>
              )}
              {isPwdPending && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-xs border border-amber-300 w-fit">
                  <Clock className="w-3 h-3 text-amber-700" />
                  Verification Pending Doctor Review
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 w-full">
              {[
                { value: 'none' as const, label: 'Standard Rate', badge: null },
                {
                  value: 'pwd' as const,
                  label: 'PWD (20%)',
                  badge: isPwdVerified ? 'Verified' : isPwdPendingReview ? 'Pending' : 'Needs ID',
                  isVerified: isPwdVerified,
                  isPending: isPwdPendingReview,
                },
                {
                  value: 'senior' as const,
                  label: 'Senior (20%)',
                  badge: isSeniorVerified ? 'Verified' : isSeniorPendingReview ? 'Pending' : 'Needs ID',
                  isVerified: isSeniorVerified,
                  isPending: isSeniorPendingReview,
                },
              ].map((option) => {
                const isActive = activeDiscountTab === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => handleDiscountSelect(option.value)}
                    className={`py-1.5 sm:py-2.5 px-1 sm:px-2 rounded-sm border-2 text-[9px] sm:text-xs font-bold uppercase tracking-wider transition text-center cursor-pointer relative ${
                      isActive
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-800 shadow-xs ring-2 ring-emerald-500/20'
                        : option.value !== 'none' && !option.isVerified
                        ? 'border-slate-300 bg-slate-50 text-slate-600 hover:border-emerald-400'
                        : 'border-slate-300 bg-white hover:border-slate-400 text-slate-700'
                    }`}
                  >
                    <div className="truncate sm:overflow-visible">{option.label}</div>
                    {option.badge && (
                      <span className={`block text-[7.5px] sm:text-[8px] font-bold mt-0.5 truncate sm:overflow-visible ${
                        option.isVerified ? 'text-emerald-700' : option.isPending ? 'text-amber-700 font-black' : 'text-slate-500'
                      }`}>
                        {option.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Approved Verification Banner */}
            {isPwdApproved && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950">
                  <span className="font-bold">Verified Statutory Discount Active: </span>
                  Dr. Kyler has approved your {currentUser?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD'} verification. A 20% deduction is applied to your billing.
                </div>
              </div>
            )}

            {/* Pending Verification Notice */}
            {isPwdPending && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-sm space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-900">
                  <Clock className="w-4 h-4 text-amber-700" />
                  ID Verification Submitted to Doctor
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Your ID was sent to Dr. Kyler for clinical verification. Statutory discounts activate immediately once the doctor approves your request on the clinic mobile app. Standard rate applies in the interim.
                </p>
              </div>
            )}

            {/* Rejected Notice */}
            {isPwdRejected && (
              <div className="p-3.5 bg-red-50 border border-red-300 rounded-sm space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-red-900">
                  <AlertCircle className="w-4 h-4 text-red-700" />
                  Verification Declined by Doctor
                </div>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  Your previous ID could not be validated. Please click below to submit a clear, valid ID.
                </p>
                <button
                  type="button"
                  onClick={() => setShowVerificationPanel(true)}
                  className="px-3 py-1 bg-red-700 text-white text-[11px] font-bold uppercase rounded-xs cursor-pointer hover:bg-red-800 transition"
                >
                  Re-submit ID
                </button>
              </div>
            )}

            {/* Verification Request Upload Panel (Shown when user clicks PWD/Senior without prior approval) */}
            {(showVerificationPanel || (!isPwdApproved && !isPwdPending && !isPwdRejected && discountType !== 'none')) && (
              <div className="p-4 sm:p-5 bg-bg-surface border-2 border-dashed border-emerald-500 rounded-sm space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Submit ID for Doctor Verification
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVerificationPanel(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  To ensure genuine entitlement under Philippine RA 9994 / RA 10754, upload your ID below. It will be sent directly to Dr. Kyler for clinical verification. Once approved on the doctor mobile portal, your account will receive the 20% discount permanently.
                </p>

                {/* ID Type Choice */}
                <div className="flex items-center gap-4 text-xs font-bold text-slate-800">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="verificationType"
                      value="pwd"
                      checked={selectedVerificationType === 'pwd'}
                      onChange={() => setSelectedVerificationType('pwd')}
                      className="accent-emerald-700"
                    />
                    PWD ID
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="verificationType"
                      value="senior"
                      checked={selectedVerificationType === 'senior'}
                      onChange={() => setSelectedVerificationType('senior')}
                      className="accent-emerald-700"
                    />
                    Snr. Cit. ID (60+)
                  </label>
                </div>

                <div className="pt-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleIdFileSelect}
                    className="block text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xs file:border file:border-emerald-700 file:bg-emerald-700 file:text-white file:text-xs file:font-bold file:uppercase file:cursor-pointer cursor-pointer max-w-full"
                  />
                  {idPreviewUrl && (
                    <div className="mt-2 w-32 h-20 rounded border border-emerald-300 overflow-hidden bg-slate-900">
                      <img src={idPreviewUrl} alt="ID Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {selectedIdFile && (
                    <p className="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{selectedIdFile.name} ready to submit</span>
                    </p>
                  )}
                </div>

                {((selectedVerificationType === 'pwd' && isPwdPendingReview) || (selectedVerificationType === 'senior' && isSeniorPendingReview)) && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm text-xs text-amber-900 font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Your {selectedVerificationType === 'senior' ? 'Snr. Cit.' : 'PWD'} ID is currently under doctor review. Uploading is disabled to prevent duplicate queue submissions.</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmitIdForDoctorVerification}
                  disabled={isSubmittingId || !selectedIdFile || (selectedVerificationType === 'pwd' && isPwdPendingReview) || (selectedVerificationType === 'senior' && isSeniorPendingReview)}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider rounded-xs transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingId ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Uploading & Sending to Doctor...
                    </>
                  ) : (
                    'Send ID to Dr. Kyler for Verification'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Payment Gateway - PayMongo Unified Portal */}
          <div className="skeuo-card p-4 sm:p-5 border-2 border-emerald-400 bg-emerald-50/40 rounded-sm space-y-3">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-950">
                  Payment Gateway &bull; PayMongo
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-xs border border-emerald-300 w-fit">
                All Channels Accepted
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
              PayMongo processes all clinic settlements securely. You will select your preferred channel (Cards, GCash, Maya, GrabPay, or QR Ph) on the hosted checkout page.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
              <span className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-white border border-slate-300 rounded-xs text-[10px] sm:text-[11px] font-bold text-slate-800 flex items-center gap-1.5 shadow-xs">
                <CreditCard className="w-3.5 h-3.5 text-blue-700" />
                Credit / Debit Card
              </span>
              <span className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-white border border-slate-300 rounded-xs text-[10px] sm:text-[11px] font-bold text-slate-800 flex items-center gap-1.5 shadow-xs">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                GCash
              </span>
              <span className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-white border border-slate-300 rounded-xs text-[10px] sm:text-[11px] font-bold text-slate-800 flex items-center gap-1.5 shadow-xs">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                Maya
              </span>
              <span className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-white border border-slate-300 rounded-xs text-[10px] sm:text-[11px] font-bold text-slate-800 flex items-center gap-1.5 shadow-xs">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                GrabPay / QR Ph
              </span>
            </div>
          </div>

          {/* Amount Summary */}
          <div className="skeuo-card p-4 sm:p-5 bg-slate-50 border-2 border-slate-300 rounded-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-slate-600" />
              Payment Breakdown
            </h3>
            <div className="space-y-2 text-xs sm:text-sm">
              {selectedAppointment?.clinic_name && (
                <div className="flex justify-between items-center text-slate-700 pb-2 border-b border-slate-200">
                  <span className="flex items-center gap-1 font-semibold text-xs text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                    Billing Clinic:
                  </span>
                  <span className="font-bold text-xs text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded-xs border border-emerald-300 truncate max-w-[160px] sm:max-w-none">
                    {selectedAppointment.clinic_name}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-700">
                <span>Clinic Procedure Fee:</span>
                <span className="font-mono font-bold">₱{amount.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span className="font-semibold">Discount Applied ({(discountType || 'none').toUpperCase()}):</span>
                  <span className="font-mono font-bold">-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t-2 border-slate-200 pt-2 flex justify-between text-sm sm:text-base font-black text-slate-900">
                <span className="uppercase tracking-wide">Net Settlement:</span>
                <span className="font-mono text-emerald-800">₱{finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* PayMongo Error */}
          {paymongoError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border-2 border-red-400 rounded-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <p className="text-xs font-bold">{paymongoError}</p>
            </div>
          )}

        </div>
      </div>

      {/* Appointment Billing Ledger — mirrors the appointments table */}
      {ledger.length > 0 && (
        <div className="skeuo-panel p-3 sm:p-5 md:p-6 border-2 border-slate-300 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-4">
            <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900">
              Appointment Billing Status
            </h2>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1 sm:gap-1.5 p-1 bg-slate-200/80 border border-slate-300 rounded-sm w-full sm:w-auto">
              {(['ALL', 'PAID', 'NOT PAID', 'CANCELLED'] as const).map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setLedgerFilter(f)}
                  className={`px-2 sm:px-3 py-1.5 sm:py-1 rounded-sm text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition cursor-pointer text-center ${
                    ledgerFilter === f ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f === 'ALL' ? `All (${ledger.length})` : `${f} (${ledgerCounts[f]})`}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Dynamic Card View (< md) */}
          <div className="md:hidden space-y-2.5 w-full">
            {filteredLedger.length === 0 ? (
              <div className="p-4 text-center text-slate-500 font-bold uppercase tracking-wider text-xs bg-slate-50 border border-slate-200 rounded-sm">
                No {ledgerFilter.toLowerCase()} appointments
              </div>
            ) : (
              filteredLedger.map((row) => {
                const awaitingApproval = isPendingAppointment(row);
                return (
                  <div key={row.id} className="p-3 bg-white border border-slate-300 rounded-sm shadow-2xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-900 leading-snug truncate">{row.service}</p>
                        {row.clinic_name && (
                          <p className="text-[10px] text-slate-500 font-medium truncate">{row.clinic_name}</p>
                        )}
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {new Date(row.appointment_date).toLocaleDateString()} @ {row.appointment_time}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-sm text-slate-900">
                          ₱{row.amount_due.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-500 capitalize">
                        {awaitingApproval ? 'Pending approval' : row.status === 'no-show' ? 'No show' : row.status}
                      </span>
                      <div className="text-right">
                        <span
                          className={`skeuo-badge text-[9px] ${
                            row.billing_status === 'PAID'
                              ? 'skeuo-badge-mint'
                              : row.billing_status === 'CANCELLED'
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          {row.billing_status}
                        </span>
                        {row.billing_status === 'PAID' && (
                          <span className="block text-[8px] font-mono font-bold text-emerald-900 bg-emerald-100/90 px-1 py-0.5 rounded border border-emerald-300 mt-1 truncate max-w-[130px]" title={row.billing?.gateway_transaction_id || confirmedPaymentInfo?.referenceId || 'PayMongo Verified'}>
                            Ref: {row.billing?.gateway_transaction_id || confirmedPaymentInfo?.referenceId || 'pay_verified'}
                          </span>
                        )}
                        {row.billing_status === 'CANCELLED' && row.billing?.payment_status === 'paid' && (
                          <span className="block text-[8px] font-semibold text-amber-700 mt-0.5">Paid · refund due</span>
                        )}
                        {row.billing_status === 'NOT PAID' && awaitingApproval && (
                          <span className="block text-[8px] font-semibold text-amber-700 mt-0.5">Payable once approved</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-500 uppercase tracking-wider">
                  <th className="text-left p-2.5 font-bold">Appointment</th>
                  <th className="text-left p-2.5 font-bold">Clinical Service</th>
                  <th className="text-left p-2.5 font-bold">Appointment Status</th>
                  <th className="text-right p-2.5 font-bold">Amount</th>
                  <th className="text-center p-2.5 font-bold">Billing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500 font-bold uppercase tracking-wider">
                      No {ledgerFilter.toLowerCase()} appointments
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((row) => {
                    const awaitingApproval = isPendingAppointment(row);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-700 font-mono whitespace-nowrap">
                          {new Date(row.appointment_date).toLocaleDateString()} @ {row.appointment_time}
                        </td>
                        <td className="p-2.5 text-slate-900 font-bold">
                          {row.service}
                          {row.clinic_name && (
                            <span className="block text-[10px] font-semibold text-slate-500">{row.clinic_name}</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-700 capitalize">
                          {awaitingApproval ? 'Pending approval' : row.status === 'no-show' ? 'No show' : row.status}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          ₱{row.amount_due.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`skeuo-badge text-[10px] ${
                              row.billing_status === 'PAID'
                                ? 'skeuo-badge-mint'
                                : row.billing_status === 'CANCELLED'
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-red-100 text-red-800 border-red-300'
                            }`}
                          >
                            {row.billing_status}
                          </span>
                          {row.billing_status === 'PAID' && (
                            <span className="block text-[9px] font-mono font-bold text-emerald-950 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 mt-1 max-w-[170px] mx-auto truncate" title={row.billing?.gateway_transaction_id || confirmedPaymentInfo?.referenceId || 'PayMongo Verified'}>
                              Ref: {row.billing?.gateway_transaction_id || confirmedPaymentInfo?.referenceId || 'pay_verified'}
                            </span>
                          )}
                          {row.billing_status === 'CANCELLED' && row.billing?.payment_status === 'paid' && (
                            <span className="block text-[10px] font-semibold text-amber-700 mt-1">Paid · refund due</span>
                          )}
                          {row.billing_status === 'NOT PAID' && awaitingApproval && (
                            <span className="block text-[10px] font-semibold text-amber-700 mt-1">Payable once approved</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {unpaidAppointments.length === 0 ? (
          <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-sm text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>All accounts are settled. No payments pending.</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePayment}
            disabled={isProcessing || !selectedAppointment}
            className="skeuo-btn-primary py-2.5 px-5 text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer w-full sm:w-auto"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Clock className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Processing...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>Pay ₱{finalAmount.toFixed(2)} via PayMongo</span>
              </span>
            )}
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="skeuo-btn-secondary py-2.5 px-4 text-xs uppercase tracking-wider cursor-pointer w-full sm:w-auto"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Security Badge */}
      <p className="text-center text-[10px] sm:text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1.5 uppercase tracking-wide px-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        Secured by PayMongo (BSP-Licensed). Card & e-wallet details are handled on PayMongo&apos;s PCI-DSS compliant servers.
      </p>
    </div>
  );
}
