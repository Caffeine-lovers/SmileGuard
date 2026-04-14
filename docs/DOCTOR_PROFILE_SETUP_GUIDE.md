# Doctor Registration Flow with Profile Setup

## Overview

The doctor registration flow has been enhanced to include:
1. ✅ Password confirmation verification (2 identical passwords)
2. ✅ Comprehensive doctor profile setup form
3. ✅ Automatic checking for existing doctor profiles
4. ✅ Seamless progression from registration to profile completion

---

## 📊 Registration Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Step 0: Portal Choice                                   │
│ - Login or Register button                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│ Step 1: Credentials                                     │
│ - Full Name (register only)                             │
│ - Email                                                 │
│ - Password (with strength meter)                        │
└────────────────────┬────────────────────────────────────┘
                     │
               [Register clicked]
                     │
                     ↓ (success)
┌─────────────────────────────────────────────────────────┐
│ Create Supabase Auth User & Profile                     │
│ - Create in profiles table                              │
│ - Verify doctor role is set                             │
│ - Check if doctor profile exists                        │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   [Has Profile]          [No Profile]
        │                         │
        ↓                         ↓
    Step 2:                   Step 3:
    Success                   Doctor Profile
                              Setup
```

---

## 🔐 Step 3: Doctor Profile Setup (NEW!)

### Part A: Password Confirmation (Security Layer)

**Purpose**: Re-verify the user set the correct password

**Fields**:
- **Password 1**: User re-enters their password
- **Password 2**: User confirms/re-enters password again
- Both must match exactly
- Minimum 8 characters
- Shows match/mismatch status

**Validation**:
```
✓ Valid if:
  - Both fields filled
  - Passwords match character-for-character
  - Password >= 8 characters
  
✗ Invalid if:
  - Either field empty
  - Passwords don't match
  - Password < 8 characters
```

**User Experience**:
- Eye icon to toggle password visibility (separate for each field)
- Real-time feedback: ✓ Passwords match / ✗ Passwords do not match
- Next button disabled until valid
- Can go back to edit password if needed

---

### Part B: Doctor Details Form (Professional Information)

Once password is confirmed, user proceeds to detailed doctor profile.

#### Section 1: License & Credentials (Required)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| License Number | Text | ✅ Yes | Must be unique in database |
| Specialization | Text | ✅ Yes | e.g., "General Dentistry", "Orthodontics" |
| Years of Experience | Number | ❌ No | Integer value |
| Professional Bio | Text (Multiline) | ❌ No | Up to 500 characters |

#### Section 2: Clinic Information (Required)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Clinic Name | Text | ✅ Yes | Physical clinic location |
| Clinic Address | Text | ❌ No | Full address |
| Clinic Phone | Phone | ❌ No | Contact number |
| Clinic Email | Email | ❌ No | Clinic email address |

#### Section 3: Availability (Status)

| Field | Type | Default |
|-------|------|---------|
| Currently Available | Toggle | True |
| Availability Status | Auto-set | "available" if toggle on |

#### Section 4: Profile

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Profile Picture URL | Text | ❌ No | Link to uploaded image |

---

## 💾 Data Saving Process

### 1. Password Confirmation → Step 2

```typescript
// User passes password confirmation
// → Proceed to doctor details form
// → Store password confirmation in memory (state)
```

### 2. Doctor Details Form → Supabase

When user clicks "Save Profile & Continue":

```typescript
// Validate all required fields
// → Call createDoctorProfile()
// → Insert new record in "doctors" table with:

const new_doctor = {
  id: (UUID auto-generated),
  user_id: current_user.id,           // Links to profiles table
  license_number: "DL12345",          // Unique
  specialization: "General Dentistry",
  bio: "...",
  clinic_name: "Smile Dental",
  clinic_address: "123 Main St",
  clinic_phone: "(555) 123-4567",
  clinic_email: "clinic@example.com",
  office_hours: {...},                // Optional
  years_of_experience: 10,
  qualifications: [...],              // Optional
  is_available: true,
  availability_status: "available",
  profile_picture_url: "https://...",
  is_verified: false,                 // Requires admin
  verification_date: null,
  created_at: (now),
  updated_at: (now)
}
```

### 3. Success

```
✅ Doctor profile created
→ Step 2: Success screen
→ "Enter Dashboard" button
→ User enters doctor app
```

---

## 🔄 Modified Files

### 1. **DoctorProfileSetup.tsx** (NEW)

**Location**: `apps/doctor-mobile/components/auth/DoctorProfileSetup.tsx`

**Exports**:
```typescript
export interface DoctorProfileSetupProps {
  userId: string;          // Current doctor's user ID
  onSuccess: () => void;   // Callback when profile saved
  onCancel?: () => void;   // Callback if user cancels
}

export default function DoctorProfileSetup({
  userId,
  onSuccess,
  onCancel,
}: DoctorProfileSetupProps)
```

**Features**:
- ✅ 2-step wizard (password confirmation → details form)
- ✅ Form validation with required fields highlighting
- ✅ Integration with `doctorService.createDoctorProfile()`
- ✅ Error handling and user feedback
- ✅ Responsive design for mobile

---

### 2. **AuthModal.tsx** (UPDATED)

**Changes**:
1. Added import: `import DoctorProfileSetup from "./DoctorProfileSetup";`
2. Added import: `import { getDoctorProfile } from "@/lib/doctorService";`
3. Added state: `const [currentUserId, setCurrentUserId] = useState<string | null>(null);`
4. Updated STEP MAP comment: Added Step 3 description
5. Modified `performRegister()`: 
   - After registration, checks if doctor profile exists
   - If exists → Go to Step 2 (Success)
   - If not → Go to Step 3 (Profile Setup) + store userId
6. Added Step 3 rendering: Shows `<DoctorProfileSetup />` component
7. Updated close button logic: Hide when on Step 3

**Modified Registration Flow**:
```typescript
// Before
register() → ensureRoleSet() → Step 2 (Success)

// After
register() → ensureRoleSet() → getDoctorProfile()
  ├─ Has profile → Step 2 (Success)
  └─ No profile → Step 3 (Setup) → Step 2 (Success)
```

---

## 🎯 User Journey Examples

### Example 1: New Doctor Registration

```
1. Open app → Step 0 (Portal Choice)
2. Click "New to SmileGuard? (Register)"
3. Fill email, name, password (with strength meter)
4. Click "Complete Registration"
   └─ Supabase creates auth user
   └─ Profile with role "doctor" created
   └─ Check doctorProfile: NOT FOUND
5. → Step 3 (Doctor Profile Setup)
6. Part A: Re-enter password twice
   └─ Passwords match → Unlock Part B
7. Part B: Fill professional details
   └─ License Number: "DL123456"
   └─ Specialization: "General Dentistry"
   └─ Clinic Name: "Smile Clinic"
   └─ Fill other optional fields
8. Click "Save Profile & Continue"
   └─ Saved to "doctors" table
9. → Step 2 (Success!)
10. Click "Enter Dashboard"
    └─ Doctor portal opens
```

### Example 2: Existing Doctor Without Profile

```
1. Doctor registered earlier without profile setup
2. Login → Step 0 → Click "I have an account (Login)"
3. Enter email & password
4. Dashboard opens normally
5. Can edit profile from settings later
```

---

## 🧪 Testing Checklist

### Password Confirmation (Step 3 Part A)

- [ ] Entering empty password 1 shows error
- [ ] Entering empty password 2 shows error  
- [ ] Password < 8 characters disabled next button
- [ ] Mismatched passwords show "✗ Passwords do not match"
- [ ] Matched passwords show "✓ Passwords match" + enable next
- [ ] Eye icon toggles password 1 visibility
- [ ] Eye icon toggles password 2 visibility (independently)
- [ ] Back button goes back to Step 1

### Doctor Details Form (Step 3 Part B)

- [ ] License Number field required (shows error if empty on save)
- [ ] Specialization field required 
- [ ] Clinic Name field required
- [ ] Optional fields (bio, address, etc.) can be left empty
- [ ] "Currently Available" toggle works
- [ ] Years of Experience only accepts numbers
- [ ] Save button disabled if any required field empty
- [ ] Save button shows spinner while loading
- [ ] Success shows "All Set!" screen on Step 2
- [ ] Back button returns to password confirmation

### Integration with AuthModal

- [ ] Login bypasses profile setup (goes straight to dashboard)
- [ ] Register with new email goes through profile setup
- [ ] Register with existing email in system shows error
- [ ] Cancel button on profile setup returns to Step 0
- [ ] Exit button unavailable during Step 3
- [ ] Exit button works on other steps

---

## 🐛 Error Handling

| Scenario | Handling |
|----------|----------|
| Password mismatch | ✗ validation message, next button disabled |
| License already exists | Alert: "License number already in use" |
| Network error on save | Alert with error message, stay on form |
| Admin verification required | Auto-set `is_verified: false` (pending admin) |
| Missing required fields | Alert + indicate which fields needed |

---

## 📱 Component Structure

```
AuthModal
├─ Step 0: Portal Choice
├─ Step 1: Credentials  
├─ Step 2: Success
├─ Step 3: DoctorProfileSetup ✨ NEW
│  ├─ Password Confirmation (Part A)
│  └─ Doctor Details Form (Part B)
├─ Step 6: Forgot Password
└─ Step 7: Reset Email Sent
```

---

## 🔌 API Integration

### `doctorService.createDoctorProfile(doctor: Doctor)`

Creates a new doctor profile in Supabase:

```typescript
const newDoctorProfile = await createDoctorProfile({
  user_id: currentUser.id,
  license_number: "DL12345",
  specialization: "General Dentistry",
  clinic_name: "Smile Clinic",
  // ... other fields
});

// Returns: Doctor object with ID or null if error
```

### `doctorService.getDoctorProfile(userId: string)`

Checks if a doctor already has a profile:

```typescript
const doctorProfile = await getDoctorProfile(userId);
// Returns: Doctor object or null if not found
```

---

## ✅ Success Criteria

- ✅ Password confirmation works with 2 identical fields
- ✅ Doctor details form has all required fields
- ✅ Data saves to `doctors` table successfully
- ✅ Existing doctor profiles bypass setup
- ✅ Users can edit profiles later from settings
- ✅ Responsive mobile UI
- ✅ Proper error handling and user feedback

---

**Status**: ✅ Ready for Testing & Deployment
