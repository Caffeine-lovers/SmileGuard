'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { EMPTY_MEDICAL_INTAKE } from '@smileguard/shared-types';

export default function SignupPage() {
  const router = useRouter();
  const { register, loading, error: authError } = useAuth();
  const [step, setStep] = useState(0); // 0: Choose method, 1: Enter email/phone, 2: Verify OTP, 3: Basic info, 4: Medical, 5: Confirm
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone' | null>(null);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationPhone, setVerificationPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('+1');
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [resendCooldownEnd, setResendCooldownEnd] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null); // Track when OTP was last sent

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    service: 'General',
    medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
  });

  // Handle resend cooldown timer
  useEffect(() => {
    if (!resendCooldownEnd) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((resendCooldownEnd - now) / 1000));
      setCooldownRemaining(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
        setResendCooldownEnd(null);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [resendCooldownEnd]);

  const handleGoogleSignUp = async () => {
    setOauthLoading(true);
    setLocalError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        },
      });
      if (oauthError) {
        setLocalError(`Google sign-up failed: ${oauthError.message}`);
        setOauthLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
      setOauthLoading(false);
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setVerificationLoading(true);

    try {
      if (verificationMethod === 'email') {
        // For email, send OTP code (6-digit code via email)
        const { data, error } = await supabase.auth.signInWithOtp({
          email: verificationEmail,
          options: {
            shouldCreateUser: true,
          },
        });

        if (error) {
          setLocalError(`Failed to send verification code: ${error.message}`);
        } else {
          setSessionId(data?.session?.id || null);
          setOtpSentAt(Date.now()); // Track when OTP was sent
          setStep(2); // Move to code entry
        }
      } else {
        // For phone, send OTP code (SMS)
        // Clean phone number: remove all non-digits
        const cleanedPhone = verificationPhone.replace(/\D/g, '');
        
        if (cleanedPhone.length < 7) {
          setLocalError('Phone number must be at least 7 digits');
          setVerificationLoading(false);
          return;
        }
        
        // Format as E.164: +[countrycode][number]
        // Must be: + followed by country code and number (no spaces/dashes)
        const fullPhone = `${countryCode}${cleanedPhone}`;
        
        console.log('Attempting SMS OTP to:', fullPhone);
        
        const { data, error } = await supabase.auth.signInWithOtp({
          phone: fullPhone,
        });

        if (error) {
          console.error('SMS OTP Error:', error);
          // Provide helpful error message
          if (error.message?.includes('SMS')) {
            setLocalError('SMS not configured. Ensure SMS provider is enabled in Supabase. Using email instead is recommended.');
          } else {
            setLocalError(`Failed to send SMS code: ${error.message}`);
          }
        } else {
          setSessionId(data?.session?.id || null);
          setOtpSentAt(Date.now()); // Track when OTP was sent
          setStep(2); // Move to code entry
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setVerificationLoading(true);

    // Set timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setVerificationLoading(false);
      setLocalError('Verification timed out. Please try again.');
    }, 10000); // 10 second timeout

    try {
      if (verificationMethod === 'email') {
        // Email OTP verification - token should be string of digits
        console.log('Verifying email OTP:', { email: verificationEmail, token: verificationCode });
        
        const { data, error } = await supabase.auth.verifyOtp({
          email: verificationEmail,
          token: verificationCode.toString(), // Ensure it's a string
          type: 'email',
        });

        if (error) {
          console.error('Email verification error:', error);
          setLocalError(`Verification failed: ${error.message}`);
          clearTimeout(timeoutId);
          setVerificationLoading(false);
        } else {
          console.log('Email verification successful');
          clearTimeout(timeoutId);
          setVerificationLoading(false); // Clear loading state on success
          // Verification successful, pre-fill email and show success
          setFormData({
            ...formData,
            email: verificationEmail,
          });
          setVerificationSuccess(true);
          // Auto-transition to step 3 after 2 seconds
          setTimeout(() => {
            setStep(3);
            setVerificationSuccess(false);
          }, 2000);
        }
      } else if (verificationMethod === 'phone') {
        // Phone OTP verification with proper E.164 format
        const cleanedPhone = verificationPhone.replace(/\D/g, '');
        const fullPhone = `${countryCode}${cleanedPhone}`;
        
        console.log('Verifying phone OTP:', { phone: fullPhone, token: verificationCode });
        
        const { data, error } = await supabase.auth.verifyOtp({
          phone: fullPhone,
          token: verificationCode.toString(), // Ensure it's a string
          type: 'sms',
        });

        if (error) {
          console.error('Phone verification error:', error);
          setLocalError(`Verification failed: ${error.message}`);
          clearTimeout(timeoutId);
          setVerificationLoading(false);
        } else {
          console.log('Phone verification successful');
          clearTimeout(timeoutId);
          setVerificationLoading(false); // Clear loading state on success
          // Verification successful, pre-fill phone and show success
          setFormData({
            ...formData,
            phone: fullPhone,
          });
          setVerificationSuccess(true);
          // Auto-transition to step 3 after 2 seconds
          setTimeout(() => {
            setStep(3);
            setVerificationSuccess(false);
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Verification catch error:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
      clearTimeout(timeoutId);
      setVerificationLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLocalError(null);
    
    // Check Supabase's 60-second minimum rate limit FIRST
    const timeSinceLastOTP = otpSentAt ? Date.now() - otpSentAt : null;
    if (timeSinceLastOTP && timeSinceLastOTP < 60000) {
      const secondsRemaining = Math.ceil((60000 - timeSinceLastOTP) / 1000);
      setLocalError(`Please wait ${secondsRemaining} seconds before requesting a new code (Supabase rate limit).`);
      return;
    }
    
    // Check if on cooldown (after 2 attempts)
    if (resendCooldownEnd && Date.now() < resendCooldownEnd) {
      setLocalError(`Please wait ${cooldownRemaining} seconds before resending`);
      return;
    }
    
    const newAttempts = resendAttempts + 1;
    setResendAttempts(newAttempts);
    
    // Apply 60-second cooldown after 2 resend attempts
    if (newAttempts >= 2) {
      const cooldownEnd = Date.now() + 60 * 1000; // 60 seconds instead of 5 minutes
      setResendCooldownEnd(cooldownEnd);
      setLocalError('Code resent. You can resend again in 60 seconds.');
      return;
    }
    
    setVerificationLoading(true);
    
    try {
      if (verificationMethod === 'email') {
        const { error } = await supabase.auth.signInWithOtp({
          email: verificationEmail,
          options: {
            shouldCreateUser: true,
          },
        });
        
        if (error) {
          console.error('Resend OTP error:', error);
          setLocalError(`Failed to resend code: ${error.message}`);
        } else {
          setOtpSentAt(Date.now()); // Update OTP sent timestamp
          setLocalError(null);
          setVerificationCode(''); // Clear previous code
          alert('Verification code resent to your email!');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
    } finally {
      setVerificationLoading(false);
    }
  };

  const [passwordCheck, setPasswordCheck] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    length: false,
  });

  // Helper function to check password strength
  const checkPasswordStrength = (password: string) => {
    return {
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      length: password.length >= 8,
    };
  };

  // Countdown timer for OTP cooldown
  const handlePasswordChange = (newPassword: string) => {
    setFormData({ ...formData, password: newPassword });
    setPasswordCheck(checkPasswordStrength(newPassword));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Step 3: Collect Name, Email, Phone & Password
    if (step === 3) {
      if (!formData.name || !formData.password) {
        setLocalError('Please fill in all fields');
        return;
      }

      if (!passwordCheck.length || !passwordCheck.hasUpperCase || !passwordCheck.hasLowerCase || !passwordCheck.hasNumber || !passwordCheck.hasSpecialChar) {
        setLocalError('Password does not meet requirements');
        return;
      }

      setStep(4); // Move to medical details
      return;
    }

    // Step 4: Medical Details
    if (step === 4) {
      setStep(5);
      return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await register(
        {
          ...formData,
          doctorAccessCode: '',
        },
        'patient'
      );
      router.push('/login?registered=true');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      setLocalError(errorMessage);
      console.error("[SignupPage] Registration error:", errorMessage);
    }
  };

  const isAccountConflict = (error: string | null): boolean => {
    if (!error) return false;
    return error.includes('already registered') || error.includes('already exists') || error.includes('try signing in');
  };

  const getStepTitle = () => {
    switch(step) {
      case 0: return 'Verify Your Identity';
      case 1: return 'Enter Email or Phone';
      case 2: return 'Verify Code';
      case 3: return 'Create Account';
      case 4: return 'Medical Details';
      case 5: return 'Confirm & Create';
      default: return 'Create Account';
    }
  };

  const getStepSubtitle = () => {
    switch(step) {
      case 0: return 'Choose how you\'d like to verify';
      case 1: return verificationMethod === 'email' ? 'We\'ll send a code to your email' : 'We\'ll send a code to your phone';
      case 2: return 'Enter the 6-digit code we just sent';
      case 3: return 'Step 1 of 3: Enter your details';
      case 4: return 'Step 2 of 3: Your medical history';
      case 5: return 'Step 3 of 3: Confirm password';
      default: return '';
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        {getStepTitle()}
      </h2>
      <p className="text-center text-text-secondary mb-8">
        {getStepSubtitle()}
      </p>

        {(authError || localError) && (
          <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
            <p className="mb-3">{authError || localError}</p>
            {isAccountConflict(authError || localError) && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: {
                        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
                      },
                    });
                  }}
                  disabled={loading}
                  className="w-full bg-brand-danger hover:bg-brand-danger/90 disabled:bg-brand-danger/50 text-white font-medium py-2 px-3 rounded transition text-xs"
                >
                  Try signing in with Google
                </button>
                <Link 
                  href="/login" 
                  className="w-full bg-text-secondary hover:bg-text-secondary/90 text-white font-medium py-2 px-3 rounded transition text-xs text-center block"
                >
                  Go to Login
                </Link>
              </div>
            )}
          </div>
        )}

      {/* Quick Sign-up Option: Google OAuth */}
      {step === 0 && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setVerificationMethod('email');
              setStep(1);
              setResendAttempts(0);
              setResendCooldownEnd(null);
              setOtpSentAt(null);
            }}
            className="w-full flex items-center justify-center gap-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            ✉️ Verify with Email
          </button>
          <button
            type="button"
            onClick={() => {
              setVerificationMethod('phone');
              setStep(1);
              setResendAttempts(0);
              setResendCooldownEnd(null);
              setOtpSentAt(null);
            }}
            className="w-full flex items-center justify-center gap-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            📱 Verify with OTP
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border-card"></div>
            <span className="text-text-secondary text-sm">or</span>
            <div className="flex-1 h-px bg-border-card"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={oauthLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-border-card text-text-primary font-medium py-2 px-4 rounded-lg transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <g transform="translate(1 1)">
                <path d="M11 11.5v4.5h6.5m-6.5-9v-4.5h6.5M5.5 11H0M11 0v4.5" stroke="currentColor" strokeWidth="2" />
              </g>
            </svg>
            <span>{oauthLoading ? 'Signing up...' : 'Sign up with Google'}</span>
          </button>
        </div>
      )}

      {/* Step 1: Enter Email or Phone */}
      {step === 1 && (
        <form onSubmit={handleRequestOTP} className="space-y-4">
          {verificationMethod === 'email' ? (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={verificationEmail}
                onChange={(e) => setVerificationEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="you@example.com"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2s">
                Phone Number
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-1.5 py-0.5 border border-border-card rounded-md focus:ring-1 focus:ring-brand-primary outline-none bg-white text-xs w-auto"
                >
                  <optgroup label="Americas">
                    <option value="+1">+1 (US/CA)</option>
                    <option value="+52">+52 (Mexico)</option>
                    <option value="+55">+55 (Brazil)</option>
                    <option value="+54">+54 (Argentina)</option>
                    <option value="+56">+56 (Chile)</option>
                    <option value="+57">+57 (Colombia)</option>
                    <option value="+51">+51 (Peru)</option>
                  </optgroup>
                  <optgroup label="Europe">
                    <option value="+44">+44 (UK)</option>
                    <option value="+33">+33 (France)</option>
                    <option value="+49">+49 (Germany)</option>
                    <option value="+39">+39 (Italy)</option>
                    <option value="+34">+34 (Spain)</option>
                    <option value="+31">+31 (Netherlands)</option>
                    <option value="+32">+32 (Belgium)</option>
                    <option value="+41">+41 (Switzerland)</option>
                    <option value="+43">+43 (Austria)</option>
                    <option value="+45">+45 (Denmark)</option>
                    <option value="+46">+46 (Sweden)</option>
                    <option value="+47">+47 (Norway)</option>
                    <option value="+351">+351 (Portugal)</option>
                    <option value="+48">+48 (Poland)</option>
                    <option value="+30">+30 (Greece)</option>
                    <option value="+353">+353 (Ireland)</option>
                    <option value="+358">+358 (Finland)</option>
                    <option value="+40">+40 (Romania)</option>
                    <option value="+36">+36 (Hungary)</option>
                    <option value="+420">+420 (Czech Republic)</option>
                    <option value="+380">+380 (Ukraine)</option>
                    <option value="+7">+7 (Russia)</option>
                  </optgroup>
                  <optgroup label="Asia">
                    <option value="+91">+91 (India)</option>
                    <option value="+86">+86 (China)</option>
                    <option value="+81">+81 (Japan)</option>
                    <option value="+82">+82 (South Korea)</option>
                    <option value="+60">+60 (Malaysia)</option>
                    <option value="+65">+65 (Singapore)</option>
                    <option value="+66">+66 (Thailand)</option>
                    <option value="+84">+84 (Vietnam)</option>
                    <option value="+63">+63 (Philippines)</option>
                    <option value="+62">+62 (Indonesia)</option>
                    <option value="+92">+92 (Pakistan)</option>
                    <option value="+880">+880 (Bangladesh)</option>
                    <option value="+90">+90 (Turkey)</option>
                    <option value="+966">+966 (Saudi Arabia)</option>
                    <option value="+971">+971 (UAE)</option>
                    <option value="+974">+974 (Qatar)</option>
                    <option value="+965">+965 (Kuwait)</option>
                    <option value="+962">+962 (Jordan)</option>
                    <option value="+961">+961 (Lebanon)</option>
                  </optgroup>
                  <optgroup label="Africa">
                    <option value="+27">+27 (South Africa)</option>
                    <option value="+20">+20 (Egypt)</option>
                    <option value="+234">+234 (Nigeria)</option>
                    <option value="+254">+254 (Kenya)</option>
                    <option value="+255">+255 (Tanzania)</option>
                    <option value="+256">+256 (Uganda)</option>
                    <option value="+212">+212 (Morocco)</option>
                    <option value="+213">+213 (Algeria)</option>
                    <option value="+216">+216 (Tunisia)</option>
                    <option value="+260">+260 (Zambia)</option>
                    <option value="+263">+263 (Zimbabwe)</option>
                    <option value="+237">+237 (Cameroon)</option>
                    <option value="+233">+233 (Ghana)</option>
                  </optgroup>
                  <optgroup label="Pacific">
                    <option value="+61">+61 (Australia)</option>
                    <option value="+64">+64 (New Zealand)</option>
                    <option value="+679">+679 (Fiji)</option>
                    <option value="+685">+685 (Samoa)</option>
                    <option value="+676">+676 (Tonga)</option>
                    <option value="+675">+675 (Papua New Guinea)</option>
                  </optgroup>
                </select>
                <input
                  type="tel"
                  value={verificationPhone}
                  onChange={(e) => setVerificationPhone(e.target.value)}
                  required
                  className="flex-1 px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  placeholder="(555) 000-0000"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={verificationLoading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {verificationLoading ? 'Sending...' : 'Send Code'}
            </button>
          </div>
        </form>
      )}

      {/* Success Modal - After verification */}
      {verificationSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center space-y-4 shadow-xl">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-text-primary">Verification Successful! ✓</h3>
            <p className="text-text-secondary">Your {verificationMethod === 'email' ? 'email' : 'phone number'} has been verified.</p>
            <p className="text-sm text-text-secondary">Proceeding to registration...</p>
          </div>
        </div>
      )}

      {/* Step 2: Verify Code - Email or Phone OTP */}
      {step === 2 && !verificationSuccess && (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 8); // Only digits, max 8
                setVerificationCode(val);
                // Auto-submit when 6+ digits are entered
                if (val.length >= 6 && !verificationLoading) {
                  setTimeout(() => {
                    const form = e.currentTarget?.closest('form');
                    if (form) form.requestSubmit();
                  }, 100);
                }
              }}
              required
              className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none text-center text-2xl tracking-widest font-bold transition ${
                verificationCode.length >= 6 && !verificationLoading
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-border-card bg-white text-text-primary focus:border-brand-primary'
              }`}
              placeholder="000000"
              maxLength={8}
              inputMode="numeric"
              autoComplete="off"
            />
            <p className="text-xs text-text-secondary mt-2">
              Enter the verification code sent to {verificationMethod === 'email' ? verificationEmail : verificationPhone}
            </p>
            {verificationCode.length >= 6 && !verificationLoading && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                ✓ Code ready - verifying...
              </p>
            )}
            {verificationCode.length > 0 && verificationCode.length < 6 && (
              <p className="text-xs text-text-secondary mt-2">
                {6 - verificationCode.length} more digit{6 - verificationCode.length !== 1 ? 's' : ''} needed
              </p>
            )}
            
            {/* Resend button with 5-minute cooldown after 2 attempts */}
            <div className="mt-4 pt-4 border-t border-border-card">
              <p className="text-xs text-text-secondary mb-2">Didn't receive the code?</p>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={verificationLoading || (resendCooldownEnd && Date.now() < resendCooldownEnd)}
                className="text-xs text-brand-primary hover:text-brand-primary/80 disabled:text-text-secondary disabled:cursor-not-allowed underline font-medium"
              >
                {resendCooldownEnd && Date.now() < resendCooldownEnd
                  ? `Resend in ${cooldownRemaining}s`
                  : `Resend code (${resendAttempts}/2)`}
              </button>
              {resendCooldownEnd && Date.now() < resendCooldownEnd && (
                <p className="text-xs text-text-secondary mt-1">Too many attempts. Please try again in 60 seconds.</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setVerificationCode('');
                setResendAttempts(0);
                setResendCooldownEnd(null);
                setOtpSentAt(null);
              }}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={verificationLoading || verificationCode.length < 6}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {verificationLoading ? 'Verifying...' : verificationCode.length >= 6 ? 'Verify' : `Enter ${6 - verificationCode.length} digits`}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Basic Info - Name, Password */}
      {step === 3 && (
        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled
              className="w-full px-4 py-2 border border-border-card rounded-lg bg-gray-100 text-text-secondary outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled
              className="w-full px-4 py-2 border border-border-card rounded-lg bg-gray-100 text-text-secondary outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="mt-2 text-sm space-y-1">
              <p className={`${passwordCheck.hasUpperCase ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Uppercase letter
              </p>
              <p className={`${passwordCheck.hasLowerCase ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Lowercase letter
              </p>
              <p className={`${passwordCheck.hasNumber ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Number
              </p>
              <p className={`${passwordCheck.hasSpecialChar ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Special character
              </p>
              <p className={`${passwordCheck.length ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ At least 8 characters
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Loading...' : 'Next: Medical Details'}
            </button>
          </div>
        </form>
      )}

      {/* Step 4: Medical Details */}
      {step === 4 && (
        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Service Type
            </label>
            <select
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
            >
              <option value="General">General Checkup</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Whitening">Whitening</option>
              <option value="Aligners">Aligners</option>
              <option value="Root Canal">Root Canal</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.medicalIntake.has_diabetes || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    medicalIntake: {
                      ...formData.medicalIntake,
                      has_diabetes: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4"
              />
              <span className="ml-2 text-text-primary">I have diabetes</span>
            </label>
          </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.medicalIntake.has_heart_disease || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medicalIntake: {
                        ...formData.medicalIntake,
                        has_heart_disease: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="ml-2 text-text-primary">I have heart disease</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Allergies
              </label>
              <textarea
                value={formData.medicalIntake.allergies || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    medicalIntake: {
                      ...formData.medicalIntake,
                      allergies: e.target.value,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="List any allergies..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
              >
                {loading ? 'Loading...' : 'Next: Set Password'}
              </button>
            </div>
        </form>
      )}

      {/* Step 5: Set Password */}
      {step === 5 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="mt-2 text-sm space-y-1">
              <p className={`${passwordCheck.hasUpperCase ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Uppercase letter
              </p>
              <p className={`${passwordCheck.hasLowerCase ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Lowercase letter
              </p>
              <p className={`${passwordCheck.hasNumber ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Number
              </p>
              <p className={`${passwordCheck.hasSpecialChar ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Special character
              </p>
              <p className={`${passwordCheck.length ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ At least 8 characters
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 text-center">
        <p className="text-text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="text-text-link font-medium hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
