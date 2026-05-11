import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { supabase } from '@smileguard/supabase-client';
import { useAuth } from '../../hooks/useAuth';

// Custom Collapsible component for this theme
interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
  accentColor: string;
  textColor: string;
  borderColor: string;
}

function CustomCollapsible({ title, children, accentColor, textColor, borderColor }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: accentColor,
          borderRadius: 12,
          marginBottom: 8,
        }}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>
          {isOpen ? '−' : '+'}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 }}>
          {title}
        </Text>
      </TouchableOpacity>
      {isOpen && <View style={{ paddingLeft: 0 }}>{children}</View>}
    </View>
  );
}

interface AppointmentRules {
  id: string;
  cancellation_window_hours: number;
  cancellation_fee_amount: number;
  grace_period_enabled: boolean;
  grace_period_hours: number;
  first_time_cancellation_free: boolean;
  reschedule_allowed: boolean;
  reschedule_window_hours: number;
  no_show_penalty_enabled: boolean;
  no_show_penalty_amount: number;
  created_at: string;
  updated_at: string;
}

interface AppointmentsRuleSetupProps {
  onClose?: () => void;
  onSave?: (rules: AppointmentRules) => void;
  styles?: any;
}

export default function AppointmentsRuleSetup({
  onClose,
  onSave,
  styles: externalStyles,
}: AppointmentsRuleSetupProps) {
  const { currentUser } = useAuth();

  // Hardcoded colors for consistency with other tabs
  const ACCENT_COLOR = '#0b7fab';
  const LIGHT_BG = '#f0f8ff';
  const CARD_BG = '#fff';
  const TEXT_PRIMARY = '#333';
  const TEXT_SECONDARY = '#666';
  const BORDER_COLOR = '#ddd';
  const SUCCESS_COLOR = '#4ade80';
  const AI_COLOR = '#6366f1';
  const AI_BG = '#f5f3ff';

  const [appointmentRules, setAppointmentRules] = useState<AppointmentRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState<Partial<AppointmentRules>>({
    cancellation_window_hours: 24,
    cancellation_fee_amount: 500,
    grace_period_enabled: true,
    grace_period_hours: 2,
    first_time_cancellation_free: true,
    reschedule_allowed: true,
    reschedule_window_hours: 24,
    no_show_penalty_enabled: true,
    no_show_penalty_amount: 300,
  });

  // Fetch user role and appointment rules on mount
  useEffect(() => {
    fetchUserRole();
    fetchAppointmentRules();
  }, [currentUser?.id]);

  const fetchUserRole = async () => {
    try {
      setRoleLoading(true);
      if (!currentUser?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;
      setUserRole(data?.role || null);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
    } finally {
      setRoleLoading(false);
    }
  };

  const fetchAppointmentRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointment_rules')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found
        throw error;
      }

      if (data) {
        setAppointmentRules(data);
        setFormData(data);
      } else {
        // Initialize with defaults if no record exists
        setFormData({
          cancellation_window_hours: 24,
          cancellation_fee_amount: 500,
          grace_period_enabled: true,
          grace_period_hours: 2,
          first_time_cancellation_free: true,
          reschedule_allowed: true,
          reschedule_window_hours: 24,
          no_show_penalty_enabled: true,
          no_show_penalty_amount: 300,
        });
      }
    } catch (error) {
      console.error('Error fetching appointment rules:', error);
      Alert.alert('Error', 'Failed to load appointment rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (appointmentRules?.id) {
        // Update existing record
        const { error } = await supabase
          .from('appointment_rules')
          .update({
            cancellation_window_hours: formData.cancellation_window_hours,
            cancellation_fee_amount: formData.cancellation_fee_amount,
            grace_period_enabled: formData.grace_period_enabled,
            grace_period_hours: formData.grace_period_hours,
            first_time_cancellation_free: formData.first_time_cancellation_free,
            reschedule_allowed: formData.reschedule_allowed,
            reschedule_window_hours: formData.reschedule_window_hours,
            no_show_penalty_enabled: formData.no_show_penalty_enabled,
            no_show_penalty_amount: formData.no_show_penalty_amount,
          })
          .eq('id', appointmentRules.id);

        if (error) throw error;
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('appointment_rules')
          .insert([formData])
          .select()
          .single();

        if (error) throw error;
        setAppointmentRules(data);
      }

      Alert.alert('Success', 'Appointment rules saved successfully');
      setHasChanges(false);
      setModifiedFields(new Set());
      if (onSave) {
        onSave(formData as AppointmentRules);
      }
    } catch (error) {
      console.error('Error saving appointment rules:', error);
      Alert.alert('Error', 'Failed to save appointment rules');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: typeof formData[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setModifiedFields((prev) => new Set([...prev, field as string]));
    setHasChanges(true);
  };

  if (loading || roleLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: LIGHT_BG },
          externalStyles,
        ]}>
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
      </View>
    );
  }

  const isDoctor = userRole === 'doctor';
  const isReadOnly = !isDoctor;

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: LIGHT_BG },
        externalStyles,
      ]}
      contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: TEXT_PRIMARY },
          ]}>
          Set Appointment Rules
        </Text>
        <Text style={[styles.subtitle, { color: TEXT_SECONDARY }]}>
          {isReadOnly
            ? 'View your appointment policies and settings'
            : 'Configure your appointment policies and settings'}
        </Text>
      </View>

      {/* Read-Only Notice for Patients */}
      {isReadOnly && (
        <View
          style={[
            styles.card,
            styles.policyCard,
            { borderColor: '#ef4444', backgroundColor: '#fee2e2' },
          ]}>
          <Text style={[styles.policyTitle, { color: '#dc2626' }]}>
            View Only
          </Text>
          <Text style={[styles.policyText, { color: '#dc2626' }]}>
            Only doctors can modify appointment rules. You can view the current rules below.
          </Text>
        </View>
      )}



      {/* Cancellation Settings Policy */}
      <View style={[styles.section, { marginTop: 20 }]}>
        <CustomCollapsible title="Cancellation Settings Policy" accentColor={ACCENT_COLOR} textColor={TEXT_PRIMARY} borderColor={BORDER_COLOR}>
          <View style={[styles.collapsibleContent, { marginTop: 16 }]}>
            {/* Cancellation Window */}
            <View style={[styles.card, { borderColor: BORDER_COLOR, backgroundColor: CARD_BG, marginBottom: 16 }]}>
              <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                Cancellation Window (Hours)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    borderColor: modifiedFields.has('cancellation_window_hours') ? ACCENT_COLOR : BORDER_COLOR,
                    borderWidth: modifiedFields.has('cancellation_window_hours') ? 2 : 1,
                    color: TEXT_PRIMARY,
                    opacity: isReadOnly ? 0.6 : 1,
                  },
                ]}
                placeholder="24"
                placeholderTextColor={TEXT_SECONDARY}
                keyboardType="number-pad"
                value={String(formData.cancellation_window_hours || '')}
                onChangeText={(text) =>
                  !isReadOnly && updateField('cancellation_window_hours', text === '' ? NaN : parseInt(text))
                }
                onBlur={() => {
                  if (isNaN(formData.cancellation_window_hours as any)) {
                    updateField('cancellation_window_hours', 24);
                  }
                }}
                editable={!isReadOnly}
              />
              <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                How many hours before the appointment can patients cancel?
              </Text>
            </View>

            {/* Fee Amount */}
            <View style={[styles.card, { borderColor: BORDER_COLOR, backgroundColor: CARD_BG, marginBottom: 16 }]}>
              <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                Cancellation Fee Amount (₹)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    borderColor: modifiedFields.has('cancellation_fee_amount') ? ACCENT_COLOR : BORDER_COLOR,
                    borderWidth: modifiedFields.has('cancellation_fee_amount') ? 2 : 1,
                    color: TEXT_PRIMARY,
                    opacity: isReadOnly ? 0.6 : 1,
                  },
                ]}
                placeholder="500"
                placeholderTextColor={TEXT_SECONDARY}
                keyboardType="decimal-pad"
                value={String(formData.cancellation_fee_amount || '')}
                onChangeText={(text) =>
                  !isReadOnly && updateField('cancellation_fee_amount', text === '' ? NaN : parseFloat(text))
                }
                onBlur={() => {
                  if (isNaN(formData.cancellation_fee_amount as any)) {
                    updateField('cancellation_fee_amount', 500);
                  }
                }}
                editable={!isReadOnly}
              />
              <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                Amount charged for late cancellations
              </Text>
            </View>

            {/* Toggle Grace Period */}
            <View
              style={[
                styles.card,
                styles.toggleCard,
                { 
                  borderColor: modifiedFields.has('grace_period_enabled') ? ACCENT_COLOR : BORDER_COLOR, 
                  borderWidth: modifiedFields.has('grace_period_enabled') ? 2 : 1,
                  backgroundColor: CARD_BG, 
                  marginBottom: 16 
                },
              ]}>
              <View style={styles.toggleContent}>
                <View>
                  <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                    Enable Grace Period
                  </Text>
                  <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                    Allow free cancellations within a grace period
                  </Text>
                </View>
                <Switch
                  value={formData.grace_period_enabled || false}
                  onValueChange={(value) => {
                    if (!isReadOnly) updateField('grace_period_enabled', value);
                  }}
                  trackColor={{ false: '#767577', true: ACCENT_COLOR }}
                  thumbColor={formData.grace_period_enabled ? SUCCESS_COLOR : '#f4f3f4'}
                  disabled={isReadOnly}
                />
              </View>

              {/* Grace Period Hours (conditional) */}
              {formData.grace_period_enabled && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER_COLOR }}>
                  <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                    Grace Period Duration (Hours)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        borderColor: modifiedFields.has('grace_period_hours') ? ACCENT_COLOR : BORDER_COLOR,
                        borderWidth: modifiedFields.has('grace_period_hours') ? 2 : 1,
                        color: TEXT_PRIMARY,
                        opacity: isReadOnly ? 0.6 : 1,
                      },
                    ]}
                    placeholder="2"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="number-pad"
                    value={String(formData.grace_period_hours || '')}
                    onChangeText={(text) =>
                      !isReadOnly && updateField('grace_period_hours', parseInt(text) || 2)
                    }
                    onBlur={() => {
                      if (isNaN(formData.grace_period_hours as any)) {
                        updateField('grace_period_hours', 2);
                      }
                    }}
                    editable={!isReadOnly}
                  />
                  <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                    Duration within which cancellations are free
                  </Text>
                </View>
              )}
            </View>

            {/* First-Time Cancellation Free */}
            <View
              style={[
                styles.card,
                styles.toggleCard,
                { 
                  borderColor: modifiedFields.has('first_time_cancellation_free') ? ACCENT_COLOR : BORDER_COLOR, 
                  borderWidth: modifiedFields.has('first_time_cancellation_free') ? 2 : 1,
                  backgroundColor: CARD_BG, 
                  marginBottom: 16 
                },
              ]}>
              <View style={styles.toggleContent}>
                <View>
                  <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                    First-Time Cancellation Free
                  </Text>
                  <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                    Don't charge fee for first cancellation
                  </Text>
                </View>
                <Switch
                  value={formData.first_time_cancellation_free || false}
                  onValueChange={(value) => {
                    if (!isReadOnly) updateField('first_time_cancellation_free', value);
                  }}
                  trackColor={{ false: '#767577', true: ACCENT_COLOR }}
                  thumbColor={formData.first_time_cancellation_free ? SUCCESS_COLOR : '#f4f3f4'}
                  disabled={isReadOnly}
                />
              </View>
            </View>

            {/* Current Policy Summary */}
            <View
              style={[
                styles.card,
                styles.policyCard,
                { borderColor: ACCENT_COLOR, backgroundColor: AI_BG },
              ]}>
              <Text style={[styles.policyTitle, { color: AI_COLOR }]}>
                Current Cancellation Policy
              </Text>
              <Text style={[styles.policyText, { color: AI_COLOR }]}>
                • Cancellation window: {formData.cancellation_window_hours} hours
              </Text>
              <Text style={[styles.policyText, { color: AI_COLOR }]}>
                • Cancellation fee: ₱{formData.cancellation_fee_amount}
              </Text>
              {formData.grace_period_enabled && (
                <Text style={[styles.policyText, { color: AI_COLOR }]}>
                  • Grace period: {formData.grace_period_hours} hours (free cancellation)
                </Text>
              )}
              {formData.first_time_cancellation_free && (
                <Text style={[styles.policyText, { color: AI_COLOR }]}>
                  • First cancellation is free
                </Text>
              )}
            </View>
          </View>
        </CustomCollapsible>
      </View>
      <View style={[styles.section, { marginTop: 20 }]}>
        <CustomCollapsible title="Reschedule Rules" accentColor={ACCENT_COLOR} textColor={TEXT_PRIMARY} borderColor={BORDER_COLOR}>
          <View style={[styles.collapsibleContent, { marginTop: 16 }]}>
            {/* Allow Rescheduling */}
            <View
              style={[
                styles.card,
                styles.toggleCard,
                { 
                  borderColor: modifiedFields.has('reschedule_allowed') ? ACCENT_COLOR : BORDER_COLOR, 
                  borderWidth: modifiedFields.has('reschedule_allowed') ? 2 : 1,
                  backgroundColor: CARD_BG, 
                  marginBottom: 16 
                },
              ]}>
              <View style={styles.toggleContent}>
                <View>
                  <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                    Allow Patient Rescheduling
                  </Text>
                  <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                    Permit patients to reschedule their appointments
                  </Text>
                </View>
                <Switch
                  value={formData.reschedule_allowed || false}
                  onValueChange={(value) => {
                    if (!isReadOnly) updateField('reschedule_allowed', value);
                  }}
                  trackColor={{ false: '#767577', true: ACCENT_COLOR }}
                  thumbColor={formData.reschedule_allowed ? SUCCESS_COLOR : '#f4f3f4'}
                  disabled={isReadOnly}
                />
              </View>

              {/* Reschedule Window Hours (conditional) */}
              {formData.reschedule_allowed && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER_COLOR }}>
                  <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                    Reschedule Window (Hours)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        borderColor: modifiedFields.has('reschedule_window_hours') ? ACCENT_COLOR : BORDER_COLOR,
                        borderWidth: modifiedFields.has('reschedule_window_hours') ? 2 : 1,
                        color: TEXT_PRIMARY,
                        opacity: isReadOnly ? 0.6 : 1,
                      },
                    ]}
                    placeholder="24"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="number-pad"
                    value={String(formData.reschedule_window_hours || '')}
                    onChangeText={(text) =>
                      !isReadOnly && updateField('reschedule_window_hours', text === '' ? NaN : parseInt(text))
                    }
                    onBlur={() => {
                      if (isNaN(formData.reschedule_window_hours as any)) {
                        updateField('reschedule_window_hours', 24);
                      }
                    }}
                    editable={!isReadOnly}
                  />
                  <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                    How many hours before appointment can patients reschedule?
                  </Text>
                </View>
              )}
            </View>
          </View>
        </CustomCollapsible>
      </View>

      {/* No-Show Penalty */}
      <View style={[styles.section, { marginTop: 20 }]}>
        <CustomCollapsible title="No-Show Penalty" accentColor={ACCENT_COLOR} textColor={TEXT_PRIMARY} borderColor={BORDER_COLOR}>
          <View style={[styles.collapsibleContent, { marginTop: 16 }]}>
            {/* Enable No-Show Penalty */}
            <View
              style={[
                styles.card,
                styles.toggleCard,
                { 
                  borderColor: modifiedFields.has('no_show_penalty_enabled') ? ACCENT_COLOR : BORDER_COLOR, 
                  borderWidth: modifiedFields.has('no_show_penalty_enabled') ? 2 : 1,
                  backgroundColor: CARD_BG, 
                  marginBottom: 16 
                },
              ]}>
              <View style={styles.toggleContent}>
                <View>
                  <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                    Enable No-Show Penalty
                  </Text>
                  <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                    Charge a fee if patient doesn't show up
                  </Text>
                </View>
                <Switch
                  value={formData.no_show_penalty_enabled || false}
                  onValueChange={(value) => {
                    if (!isReadOnly) updateField('no_show_penalty_enabled', value);
                  }}
                  trackColor={{ false: '#767577', true: ACCENT_COLOR }}
                  thumbColor={formData.no_show_penalty_enabled ? SUCCESS_COLOR : '#f4f3f4'}
                  disabled={isReadOnly}
                />
              </View>

              {/* No-Show Penalty Amount (conditional) */}
              {formData.no_show_penalty_enabled && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER_COLOR }}>
                  <Text style={[styles.label, { color: TEXT_PRIMARY }]}>
                    No-Show Penalty Amount (₱)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { 
                        borderColor: modifiedFields.has('no_show_penalty_amount') ? ACCENT_COLOR : BORDER_COLOR,
                        borderWidth: modifiedFields.has('no_show_penalty_amount') ? 2 : 1,
                        color: TEXT_PRIMARY,
                        opacity: isReadOnly ? 0.6 : 1,
                      },
                    ]}
                    placeholder="300"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="decimal-pad"
                    value={String(formData.no_show_penalty_amount || '')}
                    onChangeText={(text) =>
                      !isReadOnly && updateField('no_show_penalty_amount', text === '' ? NaN : parseFloat(text))
                    }
                    onBlur={() => {
                      if (isNaN(formData.no_show_penalty_amount as any)) {
                        updateField('no_show_penalty_amount', 300);
                      }
                    }}
                    editable={!isReadOnly}
                  />
                  <Text style={[styles.helperText, { color: TEXT_SECONDARY }]}>
                    Amount charged for no-shows
                  </Text>
                </View>
              )}
            </View>
          </View>
        </CustomCollapsible>
      </View>
      {isDoctor && (
        <View style={[styles.buttonContainer, { marginBottom: 40 }]}>
          <TouchableOpacity
            style={[
              styles.saveButton, 
              { 
                backgroundColor: hasChanges ? ACCENT_COLOR : '#999',
                opacity: hasChanges ? 1 : 0.6
              }
            ]}
            onPress={handleSave}
            disabled={!hasChanges || saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Rules</Text>
            )}
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: BORDER_COLOR },
              ]}
              onPress={onClose}
              disabled={saving}>
              <Text style={[styles.cancelButtonText, { color: TEXT_PRIMARY }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  collapsibleContent: {
    paddingLeft: 0,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  toggleCard: {
    padding: 14,
  },
  toggleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 4,
  },
  policyCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  policyText: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 6,
    lineHeight: 18,
  },
  buttonContainer: {
    gap: 10,
    marginTop: 24,
  },
  saveButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
