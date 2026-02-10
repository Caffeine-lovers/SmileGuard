// Shared type definitions for SmileGuard app

export interface User {
  name: string;
  email: string;
  password: string;
  role: "patient" | "doctor";
  service?: string;
  specialty?: string;
}

export interface CurrentUser {
  name: string;
  email: string;
  role: "patient" | "doctor";
}

export interface FormData {
  service: string;
  name: string;
  email: string;
  password: string;
}

export interface Appointment {
  id: string;
  service: string;
  date: string;
  status: "Pending" | "Completed";
}

