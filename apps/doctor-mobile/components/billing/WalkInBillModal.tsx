import React, { useEffect, useMemo, useState } from 'react';
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
import { X, Search, Check } from 'lucide-react-native';
import { supabase } from '@smileguard/supabase-client';
import { useClinic } from '../../contexts/ClinicContext';
import { createWalkInPatient } from '../../lib/profilesPatients';
import { formatCurrency, formatNumberWithCommas, parseCurrencyInput } from '../../lib/currencyFormatters';
import type { ProcessableBilling } from './ProcessPaymentModal';

interface WalkInBillModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the new unpaid bill so the caller can open Process Payment for it */
  onCreated: (billing: ProcessableBilling) => void;
}

interface PatientOption {
  id: string;
  name: string;
  contact: string;
  email: string;
  is_dummy: boolean;
}

interface ServiceOption {
  name: string;
  price: number;
}

const MAX_RESULTS = 6;

export default function WalkInBillModal({ visible, onClose, onCreated }: WalkInBillModalProps) {
  const { clinic } = useClinic();

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<'self' | 'hmo'>('self');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    setMode('existing');
    setSearch('');
    setSelectedId('');
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setSelectedServices([]);
    setAmount('');
    setPayer('self');

    (async () => {
      setLoadingPatients(true);
      try {
        const [registered, walkIns] = await Promise.all([
          supabase.from('profiles').select('id, name, email').eq('role', 'patient'),
          supabase.from('dummy_patients').select('id, name, email, phone'),
        ]);
        if (cancelled) return;

        const list: PatientOption[] = [
          ...(registered.data || []).map((p: any) => ({
            id: p.id,
            name: p.name || 'Patient',
            contact: '',
            email: p.email || '',
            is_dummy: false,
          })),
          ...(walkIns.data || []).map((d: any) => ({
            id: d.id,
            name: d.name || 'Walk-in Patient',
            contact: d.phone || '',
            email: d.email || '',
            is_dummy: true,
          })),
        ].sort((a, b) => a.name.localeCompare(b.name));

        setPatients(list);
        if (list.length === 0) setMode('new');
      } finally {
        if (!cancelled) setLoadingPatients(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const services: ServiceOption[] = useMemo(() => {
    let raw: any = clinic?.services;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s: any) => ({
        name: String(s?.name || s?.service_name || s?.title || '').trim(),
        price: Number(s?.price) || 0,
      }))
      .filter((s) => s.name && s.price > 0);
  }, [clinic?.services]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? patients.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q) ||
            p.contact.includes(q)
        )
      : patients;
    return list.slice(0, MAX_RESULTS);
  }, [patients, search]);

  const selectedPatient = patients.find((p) => p.id === selectedId) || null;
  const amountNum = parseCurrencyInput(amount);

  const toggleService = (name: string) => {
    const next = selectedServices.includes(name)
      ? selectedServices.filter((n) => n !== name)
      : [...selectedServices, name];
    setSelectedServices(next);
    const total = services.filter((s) => next.includes(s.name)).reduce((sum, s) => sum + s.price, 0);
    setAmount(total > 0 ? formatNumberWithCommas(total) : '');
  };

  const close = () => {
    if (!saving) onClose();
  };

  const createBill = async (patient: { id: string; name: string; email: string; is_dummy: boolean }) => {
    // Bills start unpaid; discount, HMO coverage and the payment are recorded in Process Payment
    const { data: created, error } = await supabase
      .from('billings')
      .insert({
        patient_id: patient.id,
        amount: amountNum,
        discount_type: 'none',
        discount_amount: 0,
        final_amount: amountNum,
        payment_status: 'not_paid',
      })
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!created) throw new Error('The bill was saved but could not be loaded. Refresh the ledger.');

    onCreated({
      ...created,
      payer_type: payer,
      patient_name: patient.name,
      patient_email: patient.email,
      is_dummy: patient.is_dummy,
    });
  };

  const submit = async (allowDuplicateName = false) => {
    if (amountNum <= 0) {
      Alert.alert('Check the amount', 'Enter a bill amount greater than 0.');
      return;
    }

    if (mode === 'existing') {
      if (!selectedPatient) {
        Alert.alert('Choose a patient', 'Pick the patient this bill is for, or switch to New patient.');
        return;
      }
    } else {
      const name = newName.trim();
      if (!name) {
        Alert.alert('Patient name needed', "Enter the new patient's full name.");
        return;
      }
      const duplicate = patients.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
      if (duplicate && !allowDuplicateName) {
        Alert.alert(
          'Patient already on record',
          `${duplicate.name} is already in the patient list. Bill the existing record instead?`,
          [
            {
              text: 'Use existing',
              onPress: () => {
                setMode('existing');
                setSearch(duplicate.name);
                setSelectedId(duplicate.id);
              },
            },
            { text: 'Create new', onPress: () => submit(true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
    }

    try {
      setSaving(true);

      if (mode === 'existing' && selectedPatient) {
        await createBill(selectedPatient);
        return;
      }

      const name = newName.trim();
      const email = newEmail.trim();
      const result = await createWalkInPatient({ name, phone: newPhone.trim(), email });
      if (!result.success || !result.patient_id) {
        throw new Error(result.error || 'Could not create the patient record.');
      }
      await createBill({ id: result.patient_id, name, email, is_dummy: true });
    } catch (err: any) {
      console.error('Error creating walk-in bill:', err);
      Alert.alert('Bill not created', err?.message || 'Could not create this bill.');
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
            <Text style={s.title}>WALK-IN BILL</Text>
            <Text style={s.subtitle}>Bill a patient at the front desk, then collect</Text>
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
            {/* Patient */}
            <View style={s.group}>
              <Text style={s.label}>Patient</Text>
              {renderPills(
                [
                  { id: 'existing', label: 'Existing patient' },
                  { id: 'new', label: 'New patient' },
                ],
                mode,
                (id) => setMode(id as 'existing' | 'new')
              )}

              {mode === 'existing' ? (
                <View style={{ marginTop: 10 }}>
                  <View style={s.searchWrap}>
                    <Search size={15} color="#64748B" />
                    <TextInput
                      style={s.searchInput}
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search name, email or phone"
                      placeholderTextColor="#94A3B8"
                      autoCorrect={false}
                    />
                  </View>

                  {loadingPatients ? (
                    <ActivityIndicator size="small" color="#047857" style={{ marginTop: 14 }} />
                  ) : matches.length === 0 ? (
                    <Text style={s.helper}>
                      No patient matches. Switch to New patient to add them.
                    </Text>
                  ) : (
                    matches.map((p) => {
                      const active = p.id === selectedId;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[s.patientRow, active && s.patientRowActive]}
                          onPress={() => setSelectedId(p.id)}
                          activeOpacity={0.8}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.patientName} numberOfLines={1}>{p.name}</Text>
                            {p.email || p.contact ? (
                              <Text style={s.patientSub} numberOfLines={1}>{p.email || p.contact}</Text>
                            ) : null}
                          </View>
                          <View style={p.is_dummy ? s.badgeWalkIn : s.badgeRegistered}>
                            <Text style={p.is_dummy ? s.badgeWalkInText : s.badgeRegisteredText}>
                              {p.is_dummy ? 'WALK-IN' : 'REGISTERED'}
                            </Text>
                          </View>
                          {active && <Check size={16} color="#047857" style={{ marginLeft: 8 }} />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                  {!loadingPatients && !search.trim() && patients.length > MAX_RESULTS && (
                    <Text style={s.helper}>
                      Showing {MAX_RESULTS} of {patients.length}. Search to find the others.
                    </Text>
                  )}
                </View>
              ) : (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <TextInput
                    style={s.input}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Full name (required)"
                    placeholderTextColor="#94A3B8"
                  />
                  <TextInput
                    style={s.input}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="Phone number"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={s.input}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="Email"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={s.helper}>Saved as a walk-in record so their future bills and visits stay together.</Text>
                </View>
              )}
            </View>

            {/* Services */}
            {services.length > 0 && (
              <View style={s.group}>
                <Text style={s.label}>Services Rendered</Text>
                <View style={s.pillRow}>
                  {services.map((svc) => {
                    const active = selectedServices.includes(svc.name);
                    return (
                      <TouchableOpacity
                        key={svc.name}
                        style={[s.pill, active && s.pillActive]}
                        onPress={() => toggleService(svc.name)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.pillText, active && s.pillTextActive]}>
                          {svc.name} · {formatCurrency(svc.price)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={s.helper}>Tap services to add up the bill, or type the amount below.</Text>
              </View>
            )}

            {/* Amount */}
            <View style={s.group}>
              <Text style={s.label}>Bill Amount (₱)</Text>
              <View style={s.inputWrap}>
                <Text style={s.prefix}>₱</Text>
                <TextInput
                  style={s.inputWithPrefix}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  onBlur={() => amountNum > 0 && setAmount(formatNumberWithCommas(amountNum))}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Who pays */}
            <View style={s.group}>
              <Text style={s.label}>Who Pays</Text>
              {renderPills(
                [
                  { id: 'self', label: 'Self-pay' },
                  { id: 'hmo', label: 'HMO Patient' },
                ],
                payer,
                (id) => setPayer(id as 'self' | 'hmo')
              )}
              <Text style={s.helper}>
                {payer === 'hmo'
                  ? 'Next screen: HMO provider, card number, LOA and the amount the HMO covers. The patient pays only the rest.'
                  : 'Next screen: discount, payment method and reference number.'}
              </Text>
            </View>

            <View style={{ marginTop: 8, gap: 10 }}>
              <TouchableOpacity
                style={[s.primaryBtn, saving && { opacity: 0.7 }]}
                onPress={() => submit()}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.primaryBtnText}>
                    Create Bill & Collect{amountNum > 0 ? ` ${formatCurrency(amountNum)}` : ''}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: { fontSize: 15, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 },
  subtitle: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  group: { marginBottom: 18 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  helper: { fontSize: 11, color: '#64748B', marginTop: 8, lineHeight: 16 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: '#047857', borderColor: '#047857' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  pillTextActive: { color: '#FFFFFF' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  patientRowActive: { borderColor: '#047857', backgroundColor: '#ECFDF5' },
  patientName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  patientSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  badgeWalkIn: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: '#FEF3C7' },
  badgeWalkInText: { fontSize: 9, fontWeight: '800', color: '#B45309' },
  badgeRegistered: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: '#DBEAFE' },
  badgeRegisteredText: { fontSize: 9, fontWeight: '800', color: '#1D4ED8' },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    color: '#0F172A',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  prefix: { fontSize: 15, fontWeight: '800', color: '#047857', marginRight: 6 },
  inputWithPrefix: { flex: 1, paddingVertical: 10, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#047857',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },
});
