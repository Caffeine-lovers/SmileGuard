# How SmileGuard Determines Fresh vs Existing Accounts

## Overview
When a user signs up with Google (or other OAuth), the system determines if they have an existing account with records using a **profile completeness check** based on the `role` field in the `profiles` table.

## Sign-Up Flow with Google Button Example

### 1. **Signup Page (`/signup/page.tsx`)** - User Clicks "Sign up with Google"

```typescript
const handleGoogleSignUp = async () => {
  // Mark as OAuth SIGNUP (not signin) - persist in localStorage
  setIsOAuthFlow(true);
  localStorage.setItem('oauth_signup_flow', 'true');
  
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};
```

**Key Action:** Sets `oauth_signup_flow = 'true'` in localStorage to distinguish signup from login flow.

---

### 2. **API Callback (`/api/auth/callback/route.ts`)** - OAuth Redirect Handler

```typescript
// Receives redirect from Google OAuth
// Checks for errors, then redirects to page-based callback
return NextResponse.redirect(new URL('/auth/callback', request.url));
```

**Key Action:** Validates OAuth response and routes to the page callback.

---

### 3. **Auth Callback Page (`/auth/callback/page.tsx`)** - THE CRITICAL DETERMINATION LOGIC

This is where the system determines if the account is **FRESH** or **HAS RECORDS**.

#### Step A: Get Session
```typescript
const { data: { session } } = await supabase.auth.getSession();
```

#### Step B: Check OAuth Signup Flag
```typescript
const isOAuthSignupFlow = localStorage.getItem('oauth_signup_flow') === 'true';

if (isOAuthSignupFlow) {
  // Route to registration flow (not login)
  router.push('/signup/register?oauth=true');
  return;
}
```

#### Step C: **Determine Account Freshness**
```typescript
// Check if profile exists in the profiles table
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single();

if (profileError || !profile) {
  // ❌ FRESH ACCOUNT: No profile record exists
  // Create a new profile with NULL role
  await supabase.from('profiles').insert({
    id: session.user.id,
    email: session.user.email,
    name: session.user.user_metadata?.full_name || 'Patient',
    role: null,  // 🔑 KEY: NULL indicates INCOMPLETE/FRESH
    created_at: new Date().toISOString(),
  });
  
  // Route to registration to complete signup
  router.push('/signup/register?oauth=true');
} else {
  // ✅ PROFILE EXISTS: Check if registration is COMPLETE
  const isComplete = profile.name && profile.name.trim() !== '' && profile.role;
  
  if (!isComplete) {
    // ❌ INCOMPLETE SIGNUP: Profile exists but role is NULL
    router.push('/signup/register?oauth=true');
  } else {
    // ✅ COMPLETE SIGNUP: Profile has role set
    router.push('/dashboard');
  }
}
```

---

## Key Determination Logic

| Condition | Account Status | Action |
|-----------|----------------|--------|
| **No profile in DB** | FRESH | Create profile with `role: null`, route to `/signup/register` |
| **Profile exists, `role = null`** | INCOMPLETE/FRESH | Route to `/signup/register` |
| **Profile exists, `role = 'patient'`** | COMPLETE | Route to `/dashboard` |

---

## The Role Field: The "Freshness Marker"

The `role` field in the `profiles` table serves as the indicator:

### **role = NULL**
- Indicates the account was just created via OAuth
- User has NOT completed the signup flow
- Missing role assignment
- Medical information not yet collected

### **role = 'patient'**
- Indicates the user has COMPLETED the entire signup flow
- All required information has been collected
- Account is fully set up and ready to use

---

## Registration Flow (`/signup/register/page.tsx`)

When routed here with `?oauth=true`, the system:

1. **Detects OAuth Flow**
   ```typescript
   if (params.get('oauth') === 'true') {
     const { data: { user } } = await supabase.auth.getUser();
     // Pre-fill from Google metadata
     updateFormField('name', user.user_metadata?.full_name || '...');
     updateFormField('email', user.email);
   }
   ```

2. **Skips Password Entry** (because OAuth handles auth)
   ```typescript
   {!isOAuthFlow && (
     // Password input only shown for non-OAuth flows
   )}
   ```

3. **Collects Additional Information** → Medical info → Confirmation

---

## Final Confirmation (`/signup/confirm/page.tsx`)

```typescript
if (isOAuthFlow && currentAuthUser) {
  // UPDATE the profile with collected information
  await supabase.from('profiles').update({
    name: formData.name,
    service: formData.service,
    role: 'patient',  // 🔑 Set role to mark as COMPLETE
    updated_at: new Date().toISOString(),
  }).eq('id', currentAuthUser.id);
  
  router.push('/dashboard');
}
```

**Critical:** The `role: 'patient'` update marks the account as having completed signup.

---

## Summary: The Decision Tree

```
User Clicks "Sign up with Google"
    ↓
Google redirects to /auth/callback
    ↓
Check: Does profile exist?
    ├─ NO → Create profile with role: null
    │        ↓ Route to /signup/register
    │
    └─ YES → Check: Is role set?
         ├─ NO (role = null) → Route to /signup/register (FRESH/INCOMPLETE)
         └─ YES (role = 'patient') → Route to /dashboard (COMPLETE)
```

---

## Database View

```sql
-- FRESH ACCOUNT (just signed up with Google)
SELECT * FROM profiles WHERE id = 'user-id-1';
-- Result: id, email, name, role=NULL, created_at

-- EXISTING ACCOUNT (completed signup)
SELECT * FROM profiles WHERE id = 'user-id-2';
-- Result: id, email, name, role='patient', created_at, updated_at
```

---

## Key Files Involved

- **Signup Entry**: [app/(auth)/signup/page.tsx](apps/patient-web/app/(auth)/signup/page.tsx) - Google button handler
- **Determination Logic**: [app/auth/callback/page.tsx](apps/patient-web/app/auth/callback/page.tsx) - Profile check & routing
- **Registration**: [app/(auth)/signup/register/page.tsx](apps/patient-web/app/(auth)/signup/register/page.tsx) - Collect details
- **Confirmation**: [app/(auth)/signup/confirm/page.tsx](apps/patient-web/app/(auth)/signup/confirm/page.tsx) - Finalize & set role
- **API Callback**: [app/api/auth/callback/route.ts](apps/patient-web/app/api/auth/callback/route.ts) - OAuth validation

---

## Caching & State

- **localStorage.oauth_signup_flow**: Persists flag to distinguish signup from login in OAuth flow
- **useSignup() context**: Maintains form state across signup steps
- **Supabase session**: Automatically maintained by Supabase client
