import { describe, it, expect } from 'vitest';

/**
 * Validates and normalizes an email address for password recovery and signup.
 */
function normalizeAndValidateEmail(rawEmail: string): { valid: boolean; email: string; error?: string } {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { valid: false, email: '', error: 'Email is required' };
  }
  const email = rawEmail.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, email, error: 'Invalid email format' };
  }
  return { valid: true, email };
}

/**
 * Constructs the Supabase password recovery redirect URL that routes through the authentication callback.
 */
function buildPasswordResetRedirectUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `${cleanBase}/auth/callback?next=/reset-password`;
}

/**
 * Checks password strength according to clinic portal policy.
 */
function checkPasswordStrength(password: string): {
  valid: boolean;
  length: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
} {
  const length = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  return {
    valid: length && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar,
    length,
    hasUpperCase,
    hasLowerCase,
    hasNumber,
    hasSpecialChar,
  };
}

describe('Authentication & Email Verification Utilities', () => {
  describe('normalizeAndValidateEmail', () => {
    it('normalizes uppercase and trimmed emails correctly', () => {
      const res = normalizeAndValidateEmail('  Patient.User@GMAIL.COM  ');
      expect(res.valid).toBe(true);
      expect(res.email).toBe('patient.user@gmail.com');
    });

    it('caters to all standard and extended email formats', () => {
      expect(normalizeAndValidateEmail('test+alias@domain.org').valid).toBe(true);
      expect(normalizeAndValidateEmail('clinic_user@sub.domain.co.uk').valid).toBe(true);
      expect(normalizeAndValidateEmail('patient123@yahoo.com').valid).toBe(true);
      expect(normalizeAndValidateEmail('doctor@dental-clinic.health').valid).toBe(true);
      expect(normalizeAndValidateEmail('patient.doe@outlook.com').valid).toBe(true);
      expect(normalizeAndValidateEmail('user@icloud.com').valid).toBe(true);
    });

    it('rejects malformed email addresses', () => {
      expect(normalizeAndValidateEmail('notanemail').valid).toBe(false);
      expect(normalizeAndValidateEmail('@nodomain.com').valid).toBe(false);
      expect(normalizeAndValidateEmail('noatsign.com').valid).toBe(false);
      expect(normalizeAndValidateEmail('spaces in@email.com').valid).toBe(false);
      expect(normalizeAndValidateEmail('').valid).toBe(false);
    });
  });

  describe('buildPasswordResetRedirectUrl', () => {
    it('routes through the authentication callback with next parameter', () => {
      const url = buildPasswordResetRedirectUrl('https://patient-web-mu.vercel.app');
      expect(url).toBe('https://patient-web-mu.vercel.app/auth/callback?next=/reset-password');
    });

    it('strips trailing slashes correctly', () => {
      const url = buildPasswordResetRedirectUrl('https://patient-web-mu.vercel.app/');
      expect(url).toBe('https://patient-web-mu.vercel.app/auth/callback?next=/reset-password');
    });
  });

  describe('checkPasswordStrength', () => {
    it('accepts strong clinical passwords', () => {
      const res = checkPasswordStrength('DentalClinic2026!');
      expect(res.valid).toBe(true);
      expect(res.length).toBe(true);
      expect(res.hasUpperCase).toBe(true);
      expect(res.hasLowerCase).toBe(true);
      expect(res.hasNumber).toBe(true);
      expect(res.hasSpecialChar).toBe(true);
    });

    it('flags missing requirements', () => {
      expect(checkPasswordStrength('short1!A').valid).toBe(true); // 8 chars
      expect(checkPasswordStrength('sh1!A').valid).toBe(false); // < 8 chars
      expect(checkPasswordStrength('nocapital123!').valid).toBe(false);
      expect(checkPasswordStrength('NOLOWERCASE123!').valid).toBe(false);
      expect(checkPasswordStrength('NoSpecialChar123').valid).toBe(false);
      expect(checkPasswordStrength('NoNumbersHere!').valid).toBe(false);
    });
  });
});
