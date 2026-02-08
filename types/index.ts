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
  role: string;
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

export interface AuthModalProps {
  visible: boolean;
  role: "patient" | "doctor";
  onClose: () => void;
  onSuccess: (user: CurrentUser) => void;
  onLogin: (email: string, password: string, role: string) => Promise<void>;
  onRegister: (userData: FormData, role: string) => Promise<void>;
}
