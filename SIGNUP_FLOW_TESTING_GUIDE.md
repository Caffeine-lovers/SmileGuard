# Signup Flow Testing Guide

## Overview
This guide provides step-by-step instructions for testing both OAuth (Google) and email signup flows with the complete medical intake implementation.

## Prerequisites
- Patient web app running: `corepack pnpm --filter patient-web dev:clean`
- Supabase database with migrations applied
- Google OAuth configured (if testing OAuth flow)
- Browser DevTools open to view console logs

## OAuth (Google) Signup Flow Test

### Step 1: Initiate Google Sign In
1. Navigate to `http://localhost:3000/signup`
2. Click "Sign in with Google"
3. Complete Google authentication in popup/redirect
4. **Expected**: Redirected to `/auth/callback`

### Step 2: Verify Callback Processing
1. On `/auth/callback`, observe the debug logs (should be visible on page)
2. **Expected Debug Messages**:
   ```
   Callback page loaded
   OAuth callback processing...
   Session found for user: [email]
   No medical intake found - routing to register form for OAuth flow
   ```
3. **Expected Navigation**: Redirected to `/signup/register?oauth=true`

### Step 3: Complete Registration Form
1. Fill in basic information (name, email, service type)
2. Click "Next: Medical Details"
3. **Expected**: Navigate to `/signup/medical`

### Step 4: Fill Medical Form
1. Fill in ALL medical fields:
   - Date of Birth
   - Gender
   - Phone Number
   - Address
   - Emergency Contact Name
   - Emergency Contact Phone
   - Allergies
   - Current Medications
   - Medical Conditions
   - Past Surgeries
   - Smoking Status
   - Pregnancy Status
2. Click "Next: Confirm"
3. **Expected**: Navigate to `/signup/confirm`

### Step 5: Review and Submit (OAuth Flow)
1. Review all information displayed
2. Click "Complete Profile" button
3. **Expected Console Logs**:
   ```
   [SignupConfirm] Starting OAuth registration for: [user-id]
   [SignupConfirm] Updating profile...
   [SignupConfirm] Profile updated successfully
   [SignupConfirm] Creating medical intake...
   [SignupConfirm] Medical intake created successfully
   [SignupConfirm] Redirecting to dashboard...
   ```
4. **Expected Navigation**: Redirected to `/dashboard`

### OAuth Flow Success Criteria
- ✅ No console errors
- ✅ No constraint violation errors
- ✅ Successfully redirected to dashboard
- ✅ Medical data visible in Bio Data page (`/bio-data`)

---

## Email/Password Signup Flow Test

### Step 1: Start Signup
1. Navigate to `http://localhost:3000/signup`
2. Click on form or navigate directly to `/signup/register`
3. **Expected**: See registration form

### Step 2: Fill Registration Form
1. Enter email address
2. Enter password and confirm password
3. Enter name
4. Click "Next: Medical Details"
5. **Expected**: Navigate to `/signup/medical`

### Step 3: Fill Medical Form
1. Same as OAuth flow - fill all 12 medical fields
2. Click "Next: Confirm"
3. **Expected**: Navigate to `/signup/confirm`

### Step 4: Review and Submit (Email Flow)
1. Review all information displayed
2. Click "Create Account" button
3. **Expected Console Logs**:
   ```
   [SignupConfirm] Starting email registration...
   [SignupConfirm] Email registration complete
   [SignupConfirm] Session found after registration, creating medical intake...
   [SignupConfirm] Medical intake created successfully
   [SignupConfirm] Redirecting to login...
   ```
4. **Expected Navigation**: Redirected to `/login?registered=true`

### Step 5: Complete Email Verification (if required)
1. Check email for verification link
2. Verify email if needed
3. **Expected**: Can now log in with email/password

### Email Flow Success Criteria
- ✅ No console errors
- ✅ No constraint violation errors
- ✅ Successfully created account
- ✅ Can log in with email/password
- ✅ Medical data visible in Bio Data page after login

---

## Error Handling Tests

### Test 1: Duplicate Profile Creation Detection
**Objective**: Ensure no duplicate profile creation errors

1. Try OAuth signup flow
2. Watch console for error messages
3. **Expected**: NO message like:
   ```
   UNIQUE CONSTRAINT VIOLATION detected
   ```
4. **If seen**: Check that fetchProfile() is only fetching, not creating

### Test 2: Medical Intake Constraint Violations
**Objective**: Ensure medical_intake can be upserted without errors

1. Complete signup flow
2. Go to Bio Data page (`/bio-data`)
3. Click "Edit Profile"
4. Modify medical information
5. Click "Save Changes"
6. **Expected**: Save succeeds without constraint errors
7. **Expected Console**: No 23505 error codes

### Test 3: Missing Medical Data Gracefully Handled
**Objective**: Ensure partial/missing data doesn't break signup

1. Fill only some medical fields (leave others blank)
2. Complete signup
3. **Expected**: Signup succeeds with null values for empty fields
4. **Expected**: Bio Data page shows "Not provided" for empty fields

---

## Console Error Reference

### Error Code 23505 (UNIQUE CONSTRAINT)
If you see:
```
{
  code: "23505",
  message: "duplicate key value violates unique constraint"
}
```

**Means**: A field marked UNIQUE has a duplicate value

**Common Causes**:
- Profile created twice (one by trigger, one by app)
- Medical_intake row already exists for patient
- Email duplicate (shouldn't happen with Supabase auth)

**Fix**: Check that:
1. ✅ fetchProfile() only fetches (never inserts)
2. ✅ medical_intake is upserted (not inserted)
3. ✅ Only trigger creates initial profile

---

## Bio Data Page Testing

### Test 1: View Medical Information
1. After signup, navigate to `/bio-data`
2. All 12 medical fields should display
3. **Expected**: Values show what was entered in signup form

### Test 2: Edit Medical Information
1. On Bio Data page, click "Edit Profile"
2. Modify any field
3. Click "Save Changes"
4. **Expected**: Changes persist and display without errors

### Test 3: Empty Bio Data
1. Create account without filling medical form fields
2. Go to `/bio-data`
3. **Expected**: Shows "Not provided" for all fields
4. Click "Edit Profile" and add information
5. **Expected**: Can still edit and save successfully

---

## Debugging Tips

### Enable Detailed Logs
Add to browser console:
```javascript
// Show all Supabase operations
localStorage.setItem('supabase-debug', 'true');
```

### Check Database State
Query in Supabase dashboard:
```sql
-- Check if profile was created
SELECT id, name, email, role FROM profiles WHERE email = 'test@example.com';

-- Check if medical_intake was created
SELECT patient_id, date_of_birth, gender FROM medical_intake WHERE patient_id = '[user-id]';

-- Check for duplicates
SELECT patient_id, COUNT(*) FROM medical_intake GROUP BY patient_id HAVING COUNT(*) > 1;
```

### Browser DevTools Console
Look for messages starting with:
- `[SignupConfirm]` - Signup confirm page logs
- `[AUTH CALLBACK]` - OAuth callback processing
- `[useAuth]` - Authentication hook logs
- `[BioData]` - Bio Data page logs

---

## Test Checklist

- [ ] OAuth signup completes without errors
- [ ] Email signup completes without errors
- [ ] All 12 medical fields collected
- [ ] Medical data displayed in Bio Data page
- [ ] Bio Data can be edited and saved
- [ ] No 23505 (unique constraint) errors
- [ ] No 406 errors
- [ ] No profile duplication errors
- [ ] Console shows helpful debug messages
- [ ] Partial medical data (some fields empty) works
- [ ] Empty medical data (no fields filled) works

---

## Known Limitations / Future Improvements

1. **Email Verification**: Email flow currently doesn't require verification before login (depends on Supabase config)
2. **Password Reset**: Test password reset flow separately
3. **Account Linking**: OAuth to email account linking not yet tested
4. **Bulk Medical Data**: Very long medical history text might need pagination

---

## Support

If tests fail:
1. Check console for error codes and messages
2. Verify database migrations were applied
3. Check RLS policies on medical_intake table
4. Review Supabase trigger `handle_new_user` exists and works
5. Confirm `.maybeSingle()` is used (not `.single()`)
