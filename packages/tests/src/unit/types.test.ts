import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateDiscount,
  type Billing,
  type CurrentUser,
  type Appointment,
  type PreflightCheckResult,
} from "@smileguard/shared-types";

describe("Billing Service - Type Safety & Calculations", () => {
  describe("calculateDiscount()", () => {
    it("should apply 20% PWD discount", () => {
      const amount = 1000;
      const result = calculateDiscount(amount, "pwd");

      expect(result.discountAmount).toBe(200);
      expect(result.finalAmount).toBe(800);
    });

    it("should apply 20% senior citizen discount", () => {
      const amount = 1500;
      const result = calculateDiscount(amount, "senior");

      expect(result.discountAmount).toBe(300);
      expect(result.finalAmount).toBe(1200);
    });

    it("should apply no discount when type is 'none'", () => {
      const amount = 2000;
      const result = calculateDiscount(amount, "none");

      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(2000);
    });

    it("should handle undefined discount type as no discount", () => {
      const amount = 500;
      const result = calculateDiscount(amount, undefined);

      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(500);
    });

    it("should calculate correctly for fractional amounts", () => {
      const amount = 123.45;
      const result = calculateDiscount(amount, "pwd");

      expect(result.discountAmount).toBeCloseTo(24.69, 2);
      expect(result.finalAmount).toBeCloseTo(98.76, 2);
    });

    it("should handle zero amount", () => {
      const result = calculateDiscount(0, "pwd");
      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(0);
    });
  });

  describe("Billing Type Interface Compliance", () => {
    it("should create valid Billing object with all fields", () => {
      const billing: Billing = {
        id: "bill-001",
        patient_id: "patient-001",
        appointment_id: "apt-001",
        amount: 5000,
        discount_type: "pwd",
        discount_amount: 1000,
        final_amount: 4000,
        payment_status: "paid",
        payment_method: "gcash",
        payment_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(billing.patient_id).toBe("patient-001");
      expect(billing.discount_type).toBe("pwd");
      expect(billing.payment_status).toBe("paid");
      expect(billing.payment_method).toBe("gcash");
    });

    it("should allow optional fields in Billing object", () => {
      const billing: Billing = {
        patient_id: "patient-001",
        amount: 1000,
        final_amount: 1000,
        payment_status: "pending",
      };

      expect(billing.id).toBeUndefined();
      expect(billing.discount_amount).toBeUndefined();
    });

    it("should enforce valid payment_status enum", () => {
      const validStatuses: Billing["payment_status"][] = [
        "pending",
        "paid",
        "overdue",
      ];

      validStatuses.forEach((status) => {
        const billing: Billing = {
          patient_id: "p-001",
          amount: 100,
          final_amount: 100,
          payment_status: status,
        };
        expect(billing.payment_status).toBe(status);
      });
    });

    it("should enforce valid payment_method enum", () => {
      const validMethods: Billing["payment_method"][] = [
        "cash",
        "card",
        "gcash",
        "bank-transfer",
      ];

      validMethods.forEach((method) => {
        const billing: Billing = {
          patient_id: "p-001",
          amount: 100,
          final_amount: 100,
          payment_status: "pending",
          payment_method: method,
        };
        expect(billing.payment_method).toBe(method);
      });
    });
  });
});

describe("Appointment Type Safety", () => {
  it("should create valid Appointment object", () => {
    const apt: Appointment = {
      id: "apt-001",
      patient_id: "patient-001",
      dentist_id: "doctor-001",
      service: "Cleaning",
      appointment_date: "2026-04-20",
      appointment_time: "14:30",
      status: "scheduled",
    };

    expect(apt.patient_id).toBe("patient-001");
    expect(apt.status).toBe("scheduled");
    expect(apt.appointment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should enforce appointment status enum", () => {
    const validStatuses: Appointment["status"][] = [
      "scheduled",
      "completed",
      "cancelled",
      "no-show",
      "declined",
    ];

    validStatuses.forEach((status) => {
      const apt: Appointment = {
        patient_id: "p-001",
        dentist_id: "d-001",
        service: "Whitening",
        appointment_date: "2026-05-01",
        appointment_time: "09:00",
        status: status,
      };
      expect(apt.status).toBe(status);
    });
  });

  it("should allow null dentist_id (no doctor assigned yet)", () => {
    const apt: Appointment = {
      patient_id: "p-001",
      dentist_id: null,
      service: "Initial Consultation",
      appointment_date: "2026-04-25",
      appointment_time: "10:00",
      status: "scheduled",
    };

    expect(apt.dentist_id).toBeNull();
  });
});

describe("CurrentUser Type Safety", () => {
  it("should create valid patient user", () => {
    const user: CurrentUser = {
      id: "user-001",
      name: "John Patient",
      email: "john@example.com",
      role: "patient",
      service: "Cleaning",
    };

    expect(user.role).toBe("patient");
    expect(user.service).toBe("Cleaning");
  });

  it("should create valid doctor user", () => {
    const user: CurrentUser = {
      id: "user-002",
      name: "Dr. Sarah",
      email: "doctor@example.com",
      role: "doctor",
      clinic_id: "clinic-001",
    };

    expect(user.role).toBe("doctor");
    expect(user.clinic_id).toBe("clinic-001");
  });

  it("should enforce role enum (patient | doctor)", () => {
    const patientUser: CurrentUser = {
      name: "Patient",
      email: "p@example.com",
      role: "patient",
    };

    const doctorUser: CurrentUser = {
      name: "Doctor",
      email: "d@example.com",
      role: "doctor",
    };

    expect(patientUser.role).toBe("patient");
    expect(doctorUser.role).toBe("doctor");
  });

  describe("Pre-Flight AI Quality Gate - Contracts & Decision Matrix", () => {
    it("should accept valid intraoral photo with natural teeth and no braces", () => {
      const result: PreflightCheckResult = {
        passed: true,
        has_teeth: true,
        has_braces: false,
        is_clear: true,
        rejection_reason: null,
        patient_feedback: null,
      };

      expect(result.passed).toBe(true);
      expect(result.has_teeth).toBe(true);
      expect(result.has_braces).toBe(false);
      expect(result.is_clear).toBe(true);
      expect(result.rejection_reason).toBeNull();
    });

    it("should reject and flag orthodontic braces with clinical guidance", () => {
      const result: PreflightCheckResult = {
        passed: false,
        has_teeth: true,
        has_braces: true,
        is_clear: true,
        rejection_reason: "BRACES_DETECTED",
        patient_feedback: {
          headline: "Orthodontic Braces Detected",
          description: "Metallic brackets produce optical reflections that disrupt anomaly detection.",
          tips: ["Consult your orthodontist directly for chairside inspection."],
        },
      };

      expect(result.passed).toBe(false);
      expect(result.has_braces).toBe(true);
      expect(result.rejection_reason).toBe("BRACES_DETECTED");
      expect(result.patient_feedback?.headline).toContain("Braces");
    });

    it("should reject non-dental subjects when no teeth are visible", () => {
      const result: PreflightCheckResult = {
        passed: false,
        has_teeth: false,
        has_braces: false,
        is_clear: true,
        rejection_reason: "NO_TEETH_DETECTED",
        patient_feedback: {
          headline: "No Teeth Visible",
          description: "Photo does not clearly show teeth or gums.",
          tips: ["Smile wide to expose teeth", "Move camera 4-6 inches from mouth"],
        },
      };

      expect(result.passed).toBe(false);
      expect(result.has_teeth).toBe(false);
      expect(result.rejection_reason).toBe("NO_TEETH_DETECTED");
    });

    it("should reject images with poor focus or lighting", () => {
      const result: PreflightCheckResult = {
        passed: false,
        has_teeth: true,
        has_braces: false,
        is_clear: false,
        rejection_reason: "IMAGE_TOO_BLURRY",
        patient_feedback: {
          headline: "Photo Too Blurry",
          description: "High resolution is required for early lesion screening.",
          tips: ["Hold phone steady", "Turn on room lighting"],
        },
      };

      expect(result.passed).toBe(false);
      expect(result.is_clear).toBe(false);
      expect(result.rejection_reason).toBe("IMAGE_TOO_BLURRY");
    });

    it("should reject images with visible facial features (nose, eyes, full face)", () => {
      const result: PreflightCheckResult = {
        passed: false,
        has_teeth: true,
        has_no_facial_features: false,
        has_braces: false,
        is_clear: true,
        rejection_reason: "FACIAL_FEATURES_DETECTED",
        patient_feedback: {
          headline: "Crop Photo to Teeth Only",
          description: "Your photo includes facial features such as your nose or face. Please crop strictly to teeth and gums.",
          tips: ["Bring camera closer to exclude nose", "Focus strictly on teeth and gums"],
        },
      };

      expect(result.passed).toBe(false);
      expect(result.has_no_facial_features).toBe(false);
      expect(result.rejection_reason).toBe("FACIAL_FEATURES_DETECTED");
      expect(result.patient_feedback?.headline).toContain("Crop Photo");
    });
  });
});
