import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShieldCheck } from 'lucide-react-native';
import { supabase } from '@smileguard/supabase-client';
import { Billing } from '@smileguard/shared-types';
import {
  formatCurrency,
  formatNumberWithCommas,
  parseCurrencyInput,
} from '../../lib/currencyFormatters';

export interface ProcessableBilling extends Billing {
  patient_name?: string;
  patient_email?: string;
  is_dummy?: boolean;
}

interface ProcessPaymentModalProps {
  visible: boolean;
  billing: ProcessableBilling | null;
  onClose: () => void;
  onSaved: () => void;
}

type PayerType = 'self' | 'hmo';

const DISCOUNT_OPTIONS = [
  { id: 'none', label: 'None (0%)' },
  { id: 'pwd', label: 'PWD (20%)' },
  { id: 'senior', label: 'Senior (20%)' },
  { id: 'custom', label: 'Custom' },
];

const HMO_PROVIDERS = ['Maxicare', 'Intellicare', 'MediCard', 'PhilCare', 'Cocolife', 'Pacific Cross'];

export const PAYMENT_METHOD_OPTIONS = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'card', label: 'Card' },
  { id: 'paymaya', label: 'Maya' },
  { id: 'bank-transfer', label: 'Bank' },
];

const STATUS_OPTIONS = [
  { id: 'paid', label: 'Paid' },
  { id: 'not_paid', label: 'Unpaid' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function paymentMethodLabel(method?: string | null): string {
  if (!method) return '';
  if (method === 'hmo') return 'HMO';
  return PAYMENT_METHOD_OPTIONS.find((m) => m.id === method)?.label || method.replace(/[_-]/g, ' ');
}

const isStatutory = (type: string) => type === 'pwd' || type === 'senior';

export default function ProcessPaymentModal({ visible, billing, onClose, onSaved }: ProcessPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [discountType, setDiscountType] = useState('none');
  const [discountAmount, setDiscountAmount] = useState('0.00');
  const [payerType, setPayerType] = useState<PayerType>('self');
  const [hmoProvider, setHmoProvider] = useState('');
  const [hmoMemberId, setHmoMemberId] = useState('');
  const [hmoApprovalCode, setHmoApprovalCode] = useState('');
  const [hmoCovered, setHmoCovered] = useState('');
  const [status, setStatus] = useState('paid');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [verifiedDiscount, setVerifiedDiscount] = useState<'pwd' | 'senior' | null>(null);
  const [saving, setSaving] = useState(false);

  const billingId = billing?.id;

  // Load the bill into the form each time the sheet opens
  useEffect(() => {
    if (!visible || !billing) return;
    let cancelled = false;

    const alreadyPaid = billing.payment_status === 'paid';
    setAmount(billing.amount ? formatNumberWithCommas(billing.amount) : '');
    setDiscountType(billing.discount_type || 'none');
    setDiscountAmount(formatNumberWithCommas(billing.discount_amount || 0));
    setPayerType(billing.payer_type === 'hmo' ? 'hmo' : 'self');
    setHmoProvider(billing.hmo_provider || '');
    setHmoMemberId(billing.hmo_member_id || '');
    setHmoApprovalCode(billing.hmo_approval_code || '');
    setHmoCovered(billing.hmo_covered_amount ? formatNumberWithCommas(billing.hmo_covered_amount) : '');
    setStatus('paid');
    setMethod(alreadyPaid && billing.payment_method && billing.payment_method !== 'hmo' ? billing.payment_method : 'cash');
    setReference(billing.payment_reference || '');
    setVerifiedDiscount(null);

    // A registered patient whose PWD / Senior ID the clinic approved gets the 20% by default
    if (!billing.is_dummy && billing.patient_id) {
      supabase
        .from('profiles')
        .select('pwd_status, pwd_type')
        .eq('id', billing.patient_id)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled || !data || data.pwd_status !== 'approved') return;
          const type: 'pwd' | 'senior' = data.pwd_type === 'senior' ? 'senior' : 'pwd';
          setVerifiedDiscount(type);
          if (!alreadyPaid && (!billing.discount_type || billing.discount_type === 'none')) {
            setDiscountType(type);
            setDiscountAmount(formatNumberWithCommas((Number(billing.amount) || 0) * 0.2));
          }
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, billingId]);

  const amountNum = parseCurrencyInput(amount);
  const discountNum = isStatutory(discountType)
    ? amountNum * 0.2
    : discountType === 'none'
      ? 0
      : Math.min(parseCurrencyInput(discountAmount), amountNum);
  const finalNum = Math.max(0, Math.round((amountNum - discountNum) * 100) / 100);
  const coveredNum = payerType === 'hmo' ? Math.round(parseCurrencyInput(hmoCovered) * 100) / 100 : 0;
  const patientShare = Math.max(0, Math.round((finalNum - coveredNum) * 100) / 100);
  const fullyCovered = payerType === 'hmo' && finalNum > 0 && patientShare === 0;
  const needsMethod = status === 'paid' && !fullyCovered;

  const handleDiscountTypeChange = (type: string) => {
    setDiscountType(type);
    if (isStatutory(type)) setDiscountAmount(formatNumberWithCommas(amountNum * 0.2));
    else if (type === 'none') setDiscountAmount('0.00');
  };

  const handleAmountChange = (text: string) => {
    setAmount(text);
    if (isStatutory(discountType)) setDiscountAmount(formatNumberWithCommas(parseCurrencyInput(text) * 0.2));
  };

  const close = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (!billing?.id) return;

    if (amountNum <= 0) {
      Alert.alert('Check the amount', 'Enter a bill amount greater than 0.');
      return;
    }
    if (payerType === 'hmo') {
      if (!hmoProvider.trim()) {
        Alert.alert('HMO provider needed', 'Pick or type the HMO provider for this patient.');
        return;
      }
      if (coveredNum > finalNum) {
        Alert.alert('Check HMO coverage', `The HMO cannot cover more than the bill total of ${formatCurrency(finalNum)}.`);
        return;
      }
      if (status === 'paid' && coveredNum <= 0) {
        Alert.alert('Check HMO coverage', 'Enter the amount the HMO approved, or switch to Self-pay.');
        return;
      }
    }

    try {
      setSaving(true);
      const { error } = await supabase.rpc('process_billing_payment', {
        p_billing_id: billing.id,
        p_payment_status: status,
        p_payment_method: needsMethod ? method : null,
        p_payment_reference: reference.trim() || null,
        p_amount: amountNum,
        p_discount_type: discountType,
        p_discount_amount: discountNum,
        p_payer_type: payerType,
        p_hmo_provider: payerType === 'hmo' ? hmoProvider.trim() : null,
        p_hmo_member_id: payerType === 'hmo' ? hmoMemberId.trim() || null : null,
        p_hmo_approval_code: payerType === 'hmo' ? hmoApprovalCode.trim() || null : null,
        p_hmo_covered_amount: coveredNum,
      });

      if (error) throw error;

      Alert.alert(
        status === 'paid' ? 'Payment recorded' : 'Bill updated',
        status === 'paid'
          ? `${billing.patient_name || 'Patient'}: ${formatCurrency(patientShare)} received` +
              (coveredNum > 0 ? `, ${formatCurrency(coveredNum)} billed to ${hmoProvider.trim()}.` : '.')
          : 'The bill was saved.'
      );
      onSaved();
    } catch (err: any) {
      console.error('Error processing payment:', err);
      const missingRpc = err?.code === 'PGRST202' || /process_billing_payment/.test(err?.message || '');
      Alert.alert(
        'Payment not saved',
        missingRpc
          ? 'The payment module is not set up on the database yet. Run migration 054 in Supabase, then try again.'
          : err?.message || 'Could not save this payment.'
      );
    } finally {
      setSaving(false);
    }
  };

  const renderPills = (
    options: { id: string; label: string }[],
    selected: string,
    onSelect: (id: string) => void
  ) => (
    <View style={s.pillRow}>
      {options.map((o) => {
        const active = selected === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            style={[s.pill, active && s.pillActive]}
            onPress={() => onSelect(o.id)}
            activeOpacity={0.8}
          >
            <Text style={[s.pillText, active && s.pillTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.title}>PROCESS PAYMENT</Text>
            <Text style={s.subtitle} numberOfLines={1}>
              {billing ? `BILL #${billing.id?.slice(0, 8).toUpperCase()} • ${billing.patient_name || 'Patient'}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={close}
            disabled={saving}
            style={s.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={18} color="#047857" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Bill amount */}
            <View style={s.group}>
              <Text style={s.label}>Bill Amount (₱)</Text>
              {billing?.is_dummy ? (
                <View style={s.inputWrap}>
                  <Text style={s.prefix}>₱</Text>
                  <TextInput
                    style={s.inputWithPrefix}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={handleAmountChange}
                    onBlur={() => amountNum > 0 && setAmount(formatNumberWithCommas(amountNum))}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              ) : (
                <View style={s.readonlyBox}>
                  <Text style={s.readonlyValue}>{formatCurrency(amountNum)}</Text>
                  <Text style={s.helper}>Set by the booked services</Text>
                </View>
              )}
            </View>

            {/* Discount */}
            <View style={s.group}>
              <Text style={s.label}>Discount</Text>
              {renderPills(DISCOUNT_OPTIONS, discountType, handleDiscountTypeChange)}
              {verifiedDiscount && (
                <View style={s.verifiedRow}>
                  <ShieldCheck size={13} color="#047857" />
                  <Text style={s.verifiedText}>
                    Clinic-verified {verifiedDiscount === 'senior' ? 'Senior Citizen' : 'PWD'} ID on file
                  </Text>
                </View>
              )}
              {discountType === 'custom' && (
                <View style={[s.inputWrap, { marginTop: 8 }]}>
                  <Text style={s.prefix}>₱</Text>
                  <TextInput
                    style={s.inputWithPrefix}
                    keyboardType="numeric"
                    value={discountAmount}
                    onChangeText={setDiscountAmount}
                    onBlur={() => setDiscountAmount(formatNumberWithCommas(parseCurrencyInput(discountAmount)))}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              )}
            </View>

            {/* Who pays */}
            <View style={s.group}>
              <Text style={s.label}>Who Pays</Text>
              {renderPills(
                [
                  { id: 'self', label: 'Self-pay' },
                  { id: 'hmo', label: 'HMO Patient' },
                ],
                payerType,
                (id) => setPayerType(id as PayerType)
              )}
            </View>

            {payerType === 'hmo' && (
              <View style={s.hmoCard}>
                <Text style={s.cardTitle}>HMO COVERAGE</Text>

                <Text style={s.label}>Provider</Text>
                {renderPills(
                  HMO_PROVIDERS.map((p) => ({ id: p, label: p })),
                  hmoProvider,
                  setHmoProvider
                )}
                <TextInput
                  style={[s.input, { marginTop: 8 }]}
                  value={hmoProvider}
                  onChangeText={setHmoProvider}
                  placeholder="Or type the HMO name"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={[s.label, { marginTop: 12 }]}>Member / Card No.</Text>
                <TextInput
                  style={s.input}
                  value={hmoMemberId}
                  onChangeText={setHmoMemberId}
                  placeholder="e.g. 1234-5678-9012"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />

                <Text style={[s.label, { marginTop: 12 }]}>LOA / Approval No.</Text>
                <TextInput
                  style={s.input}
                  value={hmoApprovalCode}
                  onChangeText={setHmoApprovalCode}
                  placeholder="Letter of Authorization number"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />

                <View style={s.coveredHeader}>
                  <Text style={[s.label, { marginBottom: 0 }]}>Amount HMO Covers (₱)</Text>
                  <TouchableOpacity onPress={() => setHmoCovered(formatNumberWithCommas(finalNum))} activeOpacity={0.7}>
                    <Text style={s.linkText}>Cover full bill</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.inputWrap}>
                  <Text style={s.prefix}>₱</Text>
                  <TextInput
                    style={s.inputWithPrefix}
                    keyboardType="numeric"
                    value={hmoCovered}
                    onChangeText={setHmoCovered}
                    onBlur={() => hmoCovered && setHmoCovered(formatNumberWithCommas(parseCurrencyInput(hmoCovered)))}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {coveredNum > finalNum && (
                  <Text style={s.errorText}>More than the bill total of {formatCurrency(finalNum)}.</Text>
                )}
              </View>
            )}

            {/* Breakdown */}
            <View style={s.calcCard}>
              <Text style={s.cardTitle}>SETTLEMENT BREAKDOWN</Text>
              <View style={s.calcRow}>
                <Text style={s.calcLabel}>Subtotal</Text>
                <Text style={s.calcValue}>{formatCurrency(amountNum)}</Text>
              </View>
              {discountNum > 0 && (
                <View style={s.calcRow}>
                  <Text style={s.calcLabel}>Discount ({discountType.toUpperCase()})</Text>
                  <Text style={[s.calcValue, { color: '#DC2626' }]}>-{formatCurrency(discountNum)}</Text>
                </View>
              )}
              <View style={s.calcRow}>
                <Text style={s.calcLabel}>Bill Total</Text>
                <Text style={s.calcValue}>{formatCurrency(finalNum)}</Text>
              </View>
              {payerType === 'hmo' && (
                <View style={s.calcRow}>
                  <Text style={s.calcLabel}>HMO Covers{hmoProvider.trim() ? ` (${hmoProvider.trim()})` : ''}</Text>
                  <Text style={[s.calcValue, { color: '#0284C7' }]}>-{formatCurrency(coveredNum)}</Text>
                </View>
              )}
              <View style={s.divider} />
              <View style={s.calcRow}>
                <Text style={[s.calcLabel, { fontWeight: '800', color: '#0F172A' }]}>Patient Pays</Text>
                <Text style={[s.calcValue, { fontWeight: '900', color: '#047857', fontSize: 16 }]}>
                  {formatCurrency(patientShare)}
                </Text>
              </View>
            </View>

            {/* Status */}
            <View style={s.group}>
              <Text style={s.label}>Payment Status</Text>
              {renderPills(STATUS_OPTIONS, status, setStatus)}
            </View>

            {/* How the patient's share was paid */}
            {needsMethod && (
              <>
                <View style={s.group}>
                  <Text style={s.label}>{payerType === 'hmo' ? "Patient's Share Paid By" : 'Payment Method'}</Text>
                  {renderPills(PAYMENT_METHOD_OPTIONS, method, setMethod)}
                </View>
                {method !== 'cash' && (
                  <View style={s.group}>
                    <Text style={s.label}>Reference No. (optional)</Text>
                    <TextInput
                      style={s.input}
                      value={reference}
                      onChangeText={setReference}
                      placeholder="GCash / Maya / bank / card slip reference"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                    />
                  </View>
                )}
              </>
            )}
            {status === 'paid' && fullyCovered && (
              <Text style={s.helper}>Fully covered by the HMO. Nothing to collect from the patient.</Text>
            )}

            <View style={{ marginTop: 24, gap: 10 }}>
              <TouchableOpacity
                style={[s.primaryBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.primaryBtnText}>
                    {status === 'paid' ? `Confirm Payment • ${formatCurrency(patientShare)}` : 'Save Bill'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={close} disabled={saving} activeOpacity={0.8}>
                <Text style={s.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
  },
  title: { fontSize: 15, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  helper: { fontSize: 11, color: '#64748B', marginTop: 4 },
  errorText: { fontSize: 11, color: '#DC2626', fontWeight: '700', marginTop: 4 },
  linkText: { fontSize: 12, fontWeight: '800', color: '#047857' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  prefix: { fontSize: 15, fontWeight: '800', color: '#047857', marginRight: 6 },
  inputWithPrefix: { flex: 1, paddingVertical: 10, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  readonlyBox: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readonlyValue: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: '#047857', borderColor: '#047857' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  pillTextActive: { color: '#FFFFFF' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#047857' },
  hmoCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  coveredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  calcCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 11, fontWeight: '900', color: '#0F172A', letterSpacing: 0.8, marginBottom: 10 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  calcLabel: { fontSize: 13, color: '#475569', flexShrink: 1, paddingRight: 8 },
  calcValue: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  primaryBtn: {
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#334155', fontSize: 14, fontWeight: '700' },
});
