import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@smileguard/supabase-client';
import { Billing } from '@smileguard/shared-types';

interface BillingEditProps {
  visible: boolean;
  billing: Billing | null;
  onClose: () => void;
  onSave?: () => void;
}

type PaymentStatus = 'pending' | 'paid' | 'overdue';
type PaymentMethod = 'cash' | 'card' | 'gcash' | 'bank-transfer';

const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'overdue'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'gcash', 'bank-transfer'];

export default function BillingEdit({ visible, billing, onClose, onSave }: BillingEditProps) {
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<PaymentStatus>('pending');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);

  // Initialize state when billing changes
  useEffect(() => {
    if (billing) {
      setSelectedPaymentStatus((billing.payment_status as PaymentStatus) || 'pending');
      setSelectedPaymentMethod((billing.payment_method as PaymentMethod) || 'cash');
    }
  }, [billing, visible]);

  const handleUpdatePaymentStatus = async () => {
    if (!billing) return;

    try {
      setUpdatingPaymentStatus(true);

      const updateData: any = {
        payment_status: selectedPaymentStatus,
      };

      if (selectedPaymentStatus === 'paid') {
        updateData.payment_method = selectedPaymentMethod;
        updateData.payment_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('billings')
        .update(updateData)
        .eq('id', billing.id);

      if (error) {
        console.error('Error updating payment status:', error);
        Alert.alert('Error', 'Failed to update payment status');
        return;
      }

      Alert.alert('Success', `Payment status updated to ${selectedPaymentStatus}`);
      
      if (onSave) {
        onSave();
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating payment:', error);
      Alert.alert('Error', 'Failed to update payment status');
    } finally {
      setUpdatingPaymentStatus(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
          <View style={{ flex: 1, flexDirection: 'column' }}>
            {/* Header */}
            <View style={{ paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>Update Payment Status</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Modify billing payment details</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={{ paddingLeft: 12 }}>
                  <Text style={{ fontSize: 24, color: '#999', fontWeight: '300' }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              contentContainerStyle={{ paddingBottom: 20 }}
              style={{
                flex: 1,
                paddingHorizontal: 16,
                paddingTop: 20,
              }}
            >

            {/* Billing Info Card */}
            {billing && (
              <View
                style={{
                  backgroundColor: '#f9f9f9',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 24,
                  borderLeftWidth: 4,
                  borderLeftColor: '#0b7fab',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View>
                    <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Bill ID</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginTop: 4 }}>
                      {billing.id?.slice(0, 8).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Amount</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#0b7fab', marginTop: 4 }}>
                      ₱{(billing.final_amount || billing.amount).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {billing.discount_type && billing.discount_type !== 'none' && (
                  <View
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      marginTop: 10,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: '#666' }}>
                      Discount ({billing.discount_type})
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#ef4444' }}>
                      -₱{billing.discount_amount?.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Payment Status Section */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 }}>
                Payment Status
              </Text>
              <View style={{ gap: 10 }}>
                {PAYMENT_STATUSES.map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setSelectedPaymentStatus(status)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: selectedPaymentStatus === status ? '#0b7fab' : '#e0e0e0',
                      backgroundColor: selectedPaymentStatus === status ? '#f0f9ff' : '#fff',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: selectedPaymentStatus === status ? '#0b7fab' : '#333',
                          textTransform: 'capitalize',
                        }}
                      >
                        {status}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: selectedPaymentStatus === status ? '#0b7fab' : '#999',
                          marginTop: 3,
                        }}
                      >
                        {status === 'pending' && 'Awaiting payment'}
                        {status === 'paid' && 'Payment received'}
                        {status === 'overdue' && 'Payment overdue'}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: selectedPaymentStatus === status ? '#0b7fab' : '#ddd',
                        backgroundColor: selectedPaymentStatus === status ? '#0b7fab' : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selectedPaymentStatus === status && (
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Payment Method Section (only for paid status) */}
            {selectedPaymentStatus === 'paid' && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 }}>
                  Payment Method
                </Text>
                <View style={{ gap: 10 }}>
                  {PAYMENT_METHODS.map((method) => (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setSelectedPaymentMethod(method)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 14,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: selectedPaymentMethod === method ? '#10b981' : '#e0e0e0',
                        backgroundColor: selectedPaymentMethod === method ? '#f0fdf4' : '#fff',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: selectedPaymentMethod === method ? '#10b981' : '#333',
                            textTransform: 'capitalize',
                          }}
                        >
                          {method === 'gcash' ? 'GCash' : method === 'bank-transfer' ? 'Bank Transfer' : method.charAt(0).toUpperCase() + method.slice(1)}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selectedPaymentMethod === method ? '#10b981' : '#ddd',
                          backgroundColor: selectedPaymentMethod === method ? '#10b981' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selectedPaymentMethod === method && (
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>✓</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Additional Info */}
            {selectedPaymentStatus === 'paid' && (
              <View
                style={{
                  backgroundColor: '#f0fdf4',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 24,
                  borderLeftWidth: 3,
                  borderLeftColor: '#10b981',
                }}
              >
                <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600' }}>
                  ℹ️ Payment date will be set to today
                </Text>
              </View>
            )}
            </ScrollView>

            {/* Action Buttons - Fixed at Bottom */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff' }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={updatingPaymentStatus}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 10,
                    backgroundColor: '#f0f0f0',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUpdatePaymentStatus}
                  disabled={updatingPaymentStatus}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 10,
                    backgroundColor: updatingPaymentStatus ? '#999' : '#0b7fab',
                    alignItems: 'center',
                  }}
                >
                  {updatingPaymentStatus ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Update Status</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
