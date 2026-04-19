'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { EMPTY_MEDICAL_INTAKE, MedicalIntake } from '@smileguard/shared-types';

export interface SignupFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  service: string;
  medicalIntake: MedicalIntake;
}

interface SignupContextType {
  // Form data
  formData: SignupFormData;
  setFormData: (data: SignupFormData) => void;
  updateFormField: (key: keyof SignupFormData, value: any) => void;

  // Verification state
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

  // OTP tracking
  otpSentAt: number | null;
  setOtpSentAt: (time: number | null) => void;
  resendAttempts: number;
  setResendAttempts: (attempts: number) => void;
  resendCooldownEnd: number | null;
  setResendCooldownEnd: (time: number | null) => void;

  // OAuth state
  isOAuthFlow: boolean;
  setIsOAuthFlow: (value: boolean) => void;
  currentAuthUser: any;
  setCurrentAuthUser: (user: any) => void;

  // Password state
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;

  // Utility
  clearSignupData: () => void;
}

const SignupContext = createContext<SignupContextType | undefined>(undefined);

const STORAGE_KEY = 'smileguard_signup_data';

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    service: 'General',
    medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
  });

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

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setFormData(data.formData || formData);
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

  // Save to localStorage whenever data changes
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
  }, [
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
  ]);

  const updateFormField = (key: keyof SignupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const clearSignupData = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      service: 'General',
      medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
    });
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

  return (
    <SignupContext.Provider value={value}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const context = useContext(SignupContext);
  if (context === undefined) {
    throw new Error('useSignup must be used within SignupProvider');
  }
  return context;
}
