import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { calculateDiscount, Billing, saveBilling } from "../../lib/database.ts";

interface BillingPaymentProps {
  patientId: string;
  appointmentId?: string;
  baseAmount: number;
  onSuccess?: (billing: Billing) => void;
  onCancel?: () => void;
}

// Service prices (in production, these would come from a database)
const SERVICE_PRICES: Record<string, number> = {
  "Cleaning": 1500,
  "Whitening": 5000,
  "Fillings": 2000,
  "Root Canal": 8000,
  "Extraction": 1500,
  "Braces": 35000,
  "Implants": 45000,
  "X-Ray": 500,
  "Check-up": 300,
};

export default function BillingPayment({
  patientId,
  appointmentId,
  baseAmount,
  onSuccess,
  onCancel,
}: BillingPaymentProps) {
  const [selectedService, setSelectedService] = useState<string>("Check-up");
  const [amount, setAmount] = useState<number>(baseAmount ?? SERVICE_PRICES["Check-up"]);
  const [discountType, setDiscountType] = useState<Billing["discount_type"]>("none");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [finalAmount, setFinalAmount] = useState<number>(amount);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<Billing["payment_method"]>("cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [discountProof, setDiscountProof] = useState<string | null>(null);

  // Update amount when service changes
  const handleServiceChange = (service: string) => {
    setSelectedService(service);
    const newAmount = SERVICE_PRICES[service] || 0;
    setAmount(newAmount);
    applyDiscount(newAmount, discountType);
  };

  // Apply discount
  const applyDiscount = (total: number, type: Billing["discount_type"]) => {
    const { discountAmount: discAmount, finalAmount: final } = calculateDiscount(total, type);
    setDiscountAmount(discAmount);
    setFinalAmount(final);
  };

  // Handle discount type selection
  const handleDiscountSelect = (type: Billing["discount_type"]) => {
    setDiscountType(type);
    applyDiscount(amount, type);
    setShowDiscountModal(false);
    
    if (type !== "none") {
      // Require proof for discount
      setShowProofModal(true);
    }
  };

  // Handle proof upload (mock - in production would use image picker)
  const handleProofUpload = () => {
    // In production, this would use expo-image-picker
    Alert.alert(
      "Upload Proof",
      "Please upload a photo of your PWD/Senior ID or insurance card.",
      [
        {
          text: "Take Photo",
          onPress: () => {
            // Mock - in production use ImagePicker
            setDiscountProof("mock_proof_uri");
            Alert.alert("Success", "Proof uploaded successfully!");
            setShowProofModal(false);
          },
        },
        {
          text: "Choose from Gallery",
          onPress: () => {
            setDiscountProof("mock_proof_uri");
            Alert.alert("Success", "Proof uploaded successfully!");
            setShowProofModal(false);
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            setDiscountType("none");
            applyDiscount(amount, "none");
          },
        },
      ]
    );
  };

  // Process payment
  const handlePayment = async () => {
    if (discountType !== "none" && !discountProof) {
      Alert.alert("Proof Required", "Please upload proof of PWD/Senior/Insurance ID.");
      return;
    }

    setIsProcessing(true);

    try {
      const billingData = {
        patient_id: patientId,
        appointment_id: appointmentId ?? undefined,
        amount: amount,
        discount_type: discountType,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_status: "paid" as const,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString(),
      };

      const result = await saveBilling(billingData);

      if (result.success) {
        Alert.alert(
          "Payment Successful!",
          `Amount Paid: ₱${finalAmount.toFixed(2)}\nPayment Method: ${paymentMethod}\n${(discountType ?? "none") !== "none" ? `Discount Applied: ${(discountType ?? "none").toUpperCase()} (-₱${discountAmount.toFixed(2)})` : ""}`,
          [
            {
              text: "OK",
              onPress: () => onSuccess?.(result.data as Billing),
            },
          ]
        );
      } else {
        Alert.alert("Payment Failed", result.error || "Please try again.");
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Billing & Payment</Text>

        {/* Service Selection */}
        <Text style={styles.label}>Select Service</Text>
        <View style={styles.serviceGrid}>
          {Object.keys(SERVICE_PRICES).map((service) => (
            <TouchableOpacity
              key={service}
              style={[
                styles.serviceButton,
                selectedService === service && styles.serviceButtonSelected,
              ]}
              onPress={() => handleServiceChange(service)}
            >
              <Text
                style={[
                  styles.serviceButtonText,
                  selectedService === service && styles.serviceButtonTextSelected,
                ]}
              >
                {service}
              </Text>
              <Text style={styles.servicePrice}>₱{SERVICE_PRICES[service]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Amount */}
        <Text style={styles.label}>Or Enter Custom Amount</Text>
        <TextInput
          style={styles.input}
          value={amount.toString()}
          onChangeText={(text) => {
            const num = parseFloat(text) || 0;
            setAmount(num);
            applyDiscount(num, discountType);
          }}
          keyboardType="numeric"
          placeholder="Enter amount"
        />

        {/* Discount Selection */}
        <Text style={styles.label}>Discount Type</Text>
        <TouchableOpacity
          style={styles.discountButton}
          onPress={() => setShowDiscountModal(true)}
        >
          <Text style={styles.discountButtonText}>
            {discountType === "none"
              ? "No Discount"
              : discountType === "pwd"
              ? "PWD Discount (20%)"
              : discountType === "senior"
              ? "Senior Citizen Discount (20%)"
              : "Insurance (30%)"}
          </Text>
        </TouchableOpacity>

        {/* Amount Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Base Amount:</Text>
            <Text style={styles.summaryValue}>₱{amount.toFixed(2)}</Text>
          </View>
          
          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount:</Text>
              <Text style={styles.discountValue}>-₱{discountAmount.toFixed(2)}</Text>
            </View>
          )}
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>₱{finalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Method */}
        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.paymentOptions}>
          {(["cash", "card", "gcash", "bank-transfer"] as const).map((method) => (
            <TouchableOpacity
              key={method}
              style={[
                styles.paymentOption,
                paymentMethod === method && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text
                style={[
                  styles.paymentOptionText,
                  paymentMethod === method && styles.paymentOptionTextSelected,
                ]}
              >
                {method === "gcash" ? "GCash" : method === "card" ? "Card" : method === "bank-transfer" ? "Bank Transfer" : "Cash"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={isProcessing}
          >
            <Text style={styles.payButtonText}>
              {isProcessing ? "Processing..." : `Pay ₱${finalAmount.toFixed(2)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Discount Selection Modal */}
      <Modal visible={showDiscountModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Discount Type</Text>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleDiscountSelect("none")}
            >
              <Text style={styles.modalOptionText}>No Discount</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleDiscountSelect("pwd")}
            >
              <Text style={styles.modalOptionText}>PWD Discount (20%)</Text>
              <Text style={styles.modalOptionSubtext}>Persons with Disability</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleDiscountSelect("senior")}
            >
              <Text style={styles.modalOptionText}>Senior Citizen (20%)</Text>
              <Text style={styles.modalOptionSubtext}>65 years old and above</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleDiscountSelect("insurance")}
            >
              <Text style={styles.modalOptionText}>Insurance (30%)</Text>
              <Text style={styles.modalOptionSubtext}>With valid insurance</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDiscountModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Proof Upload Modal */}
      <Modal visible={showProofModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload Proof</Text>
            <Text style={styles.modalSubtext}>
              Please upload a photo of your ID or proof of discount eligibility.
            </Text>
            
            <TouchableOpacity style={styles.uploadButton} onPress={handleProofUpload}>
              <Text style={styles.uploadButtonText}>Choose Image</Text>
            </TouchableOpacity>
            
            {discountProof && (
              <Text style={styles.proofUploaded}>✓ Proof uploaded</Text>
            )}
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowProofModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 10,
    marginTop: 15,
  },
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  serviceButton: {
    width: "47%",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  serviceButtonSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
  },
  serviceButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  serviceButtonTextSelected: {
    color: "#4CAF50",
  },
  servicePrice: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  discountButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  discountButtonText: {
    fontSize: 16,
    color: "#1a1a2e",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginTop: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#666",
  },
  summaryValue: {
    fontSize: 16,
    color: "#1a1a2e",
  },
  discountValue: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  paymentOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  paymentOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  paymentOptionSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
  },
  paymentOptionText: {
    fontSize: 14,
    color: "#1a1a2e",
  },
  paymentOptionTextSelected: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 15,
    marginTop: 30,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
  },
  payButton: {
    flex: 2,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  payButtonDisabled: {
    backgroundColor: "#a5d6a7",
  },
  payButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    width: "85%",
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 20,
    textAlign: "center",
  },
  modalSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  modalOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#1a1a2e",
    fontWeight: "600",
  },
  modalOptionSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  uploadButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 15,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  proofUploaded: {
    color: "#4CAF50",
    textAlign: "center",
    marginBottom: 10,
  },
  modalCloseButton: {
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  modalCloseText: {
    fontSize: 16,
    color: "#666",
  },
});
