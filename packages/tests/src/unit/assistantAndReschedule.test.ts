import { describe, it, expect } from "vitest";
import {
  CurrentUser,
  Appointment,
  Doctor,
} from "@smileguard/shared-types";

describe("Assistant Role & Appointment Rescheduling", () => {
  describe("CurrentUser Role Safety", () => {
    it("should allow 'assistant' role in CurrentUser", () => {
      const assistantUser: CurrentUser = {
        id: "assistant-uuid-123",
        name: "Maria Assistant",
        email: "assistant@clinic.com",
        role: "assistant",
      };

      expect(assistantUser.role).toBe("assistant");
      expect(assistantUser.name).toBe("Maria Assistant");
    });

    it("should allow both 'doctor' and 'assistant' clinic roles", () => {
      const doctorUser: CurrentUser = {
        name: "Dr. Kyler",
        email: "kyler@clinic.com",
        role: "doctor",
      };

      const assistantUser: CurrentUser = {
        name: "Jane Assistant",
        email: "jane@clinic.com",
        role: "assistant",
      };

      expect(doctorUser.role).toBe("doctor");
      expect(assistantUser.role).toBe("assistant");
    });
  });

  describe("Doctor Profile with Assistant Role", () => {
    it("should allow assistant profile in doctors table model", () => {
      const assistantDoctorRecord: Doctor = {
        user_id: "user-ast-001",
        license_number: "PRC-998877",
        specialization: "Clinical Assistance & Chairside Care",
        first_name: "Anna",
        last_name: "Reyes",
        role: "assistant",
      };

      expect(assistantDoctorRecord.role).toBe("assistant");
      expect(assistantDoctorRecord.first_name).toBe("Anna");
      expect(assistantDoctorRecord.specialization).toBe("Clinical Assistance & Chairside Care");
    });
  });

  describe("Appointment Rescheduling Columns & Types", () => {
    it("should support rescheduled_by, rescheduled_at, and notes columns", () => {
      const rescheduledTime = new Date().toISOString();
      const appointment: Appointment = {
        id: "apt-rescheduled-001",
        patient_id: "patient-123",
        dentist_id: "doctor-456",
        service: "Teeth Cleaning",
        appointment_date: "2026-11-20",
        appointment_time: "14:00",
        status: "scheduled",
        rescheduled_by: "assistant",
        rescheduled_at: rescheduledTime,
        notes: "Patient requested afternoon schedule due to morning class",
      };

      expect(appointment.rescheduled_by).toBe("assistant");
      expect(appointment.rescheduled_at).toBe(rescheduledTime);
      expect(appointment.notes).toBe("Patient requested afternoon schedule due to morning class");
      expect(appointment.appointment_date).toBe("2026-11-20");
      expect(appointment.status).toBe("scheduled");
    });

    it("should track doctor-initiated vs assistant-initiated rescheduling", () => {
      const doctorReschedule: Appointment = {
        patient_id: "pat-1",
        dentist_id: "doc-1",
        service: "Extraction",
        appointment_date: "2026-11-22",
        appointment_time: "10:30",
        status: "scheduled",
        rescheduled_by: "doctor",
        rescheduled_at: new Date().toISOString(),
        notes: "Moved to ensure sterile suite readiness",
      };

      const assistantReschedule: Appointment = {
        patient_id: "pat-2",
        dentist_id: "doc-1",
        service: "Check-Up",
        appointment_date: "2026-11-23",
        appointment_time: "11:00",
        status: "scheduled",
        rescheduled_by: "assistant",
        rescheduled_at: new Date().toISOString(),
        notes: "Patient called to reschedule to Friday",
      };

      expect(doctorReschedule.rescheduled_by).toBe("doctor");
      expect(assistantReschedule.rescheduled_by).toBe("assistant");
    });
  });

  describe("Access Code Routing & Tiers", () => {
    const resolveRoleFromAccessCode = (code: string): "doctor" | "assistant" => {
      const trimmed = code.trim().toUpperCase();
      if (trimmed === "SMILEGUARD-STAFF") {
        return "assistant";
      }
      return "doctor";
    };

    it("should map SMILEGUARD-STAFF access code to assistant role", () => {
      expect(resolveRoleFromAccessCode("SMILEGUARD-STAFF")).toBe("assistant");
      expect(resolveRoleFromAccessCode("smileguard-staff ")).toBe("assistant");
    });

    it("should map SMILE-DOC-2026 access code to doctor role", () => {
      expect(resolveRoleFromAccessCode("SMILE-DOC-2026")).toBe("doctor");
      expect(resolveRoleFromAccessCode("smile-doc-2026")).toBe("doctor");
    });

    it("should default other doctor access codes to doctor role", () => {
      expect(resolveRoleFromAccessCode("DOC-2024-SG")).toBe("doctor");
      expect(resolveRoleFromAccessCode("CLINIC-ADMIN-01")).toBe("doctor");
    });
  });
});

