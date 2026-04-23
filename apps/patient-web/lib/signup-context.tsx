'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// --- Interfaces ---

export interface MedicalIntakeData {
  id?: string;
  patient_id?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  allergies?: string;
  current_medications?: string;
  medical_conditions?: string;
  past_surgeries?: string;
  smoking_status?: string;
  pregnancy_status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SignupFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  service: string;
  medicalIntake: MedicalIntakeData; // Using local interface or MedicalIntake from shared-types
}

interface SignupContextType {
  formData: SignupFormData;
  setFormData: (data: SignupFormData) => void;
  updateFormField: (key: keyof SignupFormData, value: any) => void;
  updateMedicalField: (key: keyof MedicalIntakeData, value: any) => void;

  verificationMethod: 'email' | 'phone' | null;
  setVerificationMethod: (method: 'email' | 'phone' | null) => void;
  verificationEmail: string;
  setVerificationEmail: (email: string) => void;
  verificationPhone: string;
  setVerificationPhone: (phone: string) => void;
  verificationCode: string;
  setVerificationCode: (code: string) => void;
  countryCode: string;
  setCountryCode: (code: string) => void;

  otpSentAt: number | null;
  setOtpSentAt: (time: number | null) => void;
  resendAttempts: number;
  setResendAttempts: (attempts: number) => void;
  resendCooldownEnd: number | null;
  setResendCooldownEnd: (time: number | null) => void;

  isOAuthFlow: boolean;
  setIsOAuthFlow: (value: boolean) => void;
  currentAuthUser: any;
  setCurrentAuthUser: (user: any) => void;

  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;

  clearSignupData: () => void;
}

const SignupContext = createContext<SignupContextType | undefined>(undefined);

const STORAGE_KEY = 'smileguard_signup_data';

// Define the manual initial state since EMPTY_MEDICAL_INTAKE is missing
const INITIAL_MEDICAL_STATE: MedicalIntakeData = {
  date_of_birth: '',
  gender: '',
  phone: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  allergies: '',
  current_medications: '',
  medical_conditions: '',
  past_surgeries: '',
  smoking_status: '',
  pregnancy_status: '',
  notes: '',
};

const INITIAL_FORM_STATE: SignupFormData = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  service: 'General',
  medicalIntake: INITIAL_MEDICAL_STATE,
};

// --- Provider Component ---

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const [formData, setFormData] = useState<SignupFormData>(INITIAL_FORM_STATE);

  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone' | null>(null);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationPhone, setVerificationPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [resendCooldownEnd, setResendCooldownEnd] = useState<number | null>(null);
  const [isOAuthFlow, setIsOAuthFlow] = useState(false);
  const [currentAuthUser, setCurrentAuthUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setFormData(data.formData || INITIAL_FORM_STATE);
        setVerificationMethod(data.verificationMethod);
        setVerificationEmail(data.verificationEmail);
        setVerificationPhone(data.verificationPhone);
        setVerificationCode(data.verificationCode);
        setCountryCode(data.countryCode);
        setOtpSentAt(data.otpSentAt);
        setResendAttempts(data.resendAttempts);
        setResendCooldownEnd(data.resendCooldownEnd);
        setIsOAuthFlow(data.isOAuthFlow);
      } catch (e) {
        console.error('Failed to load signup data from localStorage', e);
      }
    }
  }, []);

  useEffect(() => {
    const dataToSave = {
      formData,
      verificationMethod,
      verificationEmail,
      verificationPhone,
      verificationCode,
      countryCode,
      otpSentAt,
      resendAttempts,
      resendCooldownEnd,
      isOAuthFlow,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [formData, verificationMethod, verificationEmail, verificationPhone, verificationCode, countryCode, otpSentAt, resendAttempts, resendCooldownEnd, isOAuthFlow]);

  const updateFormField = (key: keyof SignupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const updateMedicalField = (key: keyof MedicalIntakeData, value: any) => {
    setFormData(prev => ({
      ...prev,
      medicalIntake: {
        ...prev.medicalIntake,
        [key]: value,
      },
    }));
  };

  const clearSignupData = () => {
    setFormData(INITIAL_FORM_STATE);
    setVerificationMethod(null);
    setVerificationEmail('');
    setVerificationPhone('');
    setVerificationCode('');
    setCountryCode('+1');
    setOtpSentAt(null);
    setResendAttempts(0);
    setResendCooldownEnd(null);
    setIsOAuthFlow(false);
    setCurrentAuthUser(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value: SignupContextType = {
    formData,
    setFormData,
    updateFormField,
    updateMedicalField,
    verificationMethod,
    setVerificationMethod,
    verificationEmail,
    setVerificationEmail,
    verificationPhone,
    setVerificationPhone,
    verificationCode,
    setVerificationCode,
    countryCode,
    setCountryCode,
    otpSentAt,
    setOtpSentAt,
    resendAttempts,
    setResendAttempts,
    resendCooldownEnd,
    setResendCooldownEnd,
    isOAuthFlow,
    setIsOAuthFlow,
    currentAuthUser,
    setCurrentAuthUser,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    clearSignupData,
  };

  return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignup() {
  const context = useContext(SignupContext);
  if (context === undefined) {
    throw new Error('useSignup must be used within SignupProvider');
  }
  return context;
}