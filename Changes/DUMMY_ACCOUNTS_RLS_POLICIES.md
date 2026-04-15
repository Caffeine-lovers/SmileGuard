# Dummy Accounts RLS Policies - Doctor Access Control

## Overview

This document explains the Row Level Security (RLS) policies applied to the `dummy_accounts` table to restrict access to doctors only.

## What RLS Policies Are

RLS (Row Level Security) policies are database-level security rules that:
- Control which rows each user can see, insert, update, or delete
- Execute automatically on every database query
- Cannot be bypassed by application code
- Provide the strongest security guarantee

## Applied Policies

### 1. INSERT Policy - `doctors_can_insert_patients`
**What it does:** Allows doctors to create new patient records

```sql
Allowed: ✅ Doctors can CREATE patients
Blocked: ❌ Patients cannot create records
         ❌ Unauthenticated users cannot create records
```

**Who can use it:**
- User is logged in (authenticated)
- User has role = 'doctor' in the profiles table

### 2. SELECT Policy - `doctors_can_select_patients`
**What it does:** Allows doctors to view/read patient records

```sql
Allowed: ✅ Doctors can VIEW all patients
Blocked: ❌ Patients cannot view patient records
         ❌ Unauthenticated users cannot view records
```

**Who can use it:**
- User is logged in (authenticated)
- User has role = 'doctor' in the profiles table

### 3. UPDATE Policy - `doctors_can_update_patients`
**What it does:** Allows doctors to modify existing patient records

```sql
Allowed: ✅ Doctors can UPDATE patient data
Blocked: ❌ Patients cannot update records
         ❌ Unauthenticated users cannot update records
```

**Who can use it:**
- User is logged in (authenticated)
- User has role = 'doctor' in the profiles table

### 4. DELETE Policy - `doctors_can_delete_patients`
**What it does:** Allows doctors to delete patient records (optional)

```sql
Allowed: ✅ Doctors can DELETE patient records
Blocked: ❌ Patients cannot delete records
         ❌ Unauthenticated users cannot delete records
```

**Who can use it:**
- User is logged in (authenticated)
- User has role = 'doctor' in the profiles table

## Setup Instructions

### Run the Migration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `supabase/migrations/006_add_rls_policies_dummy_accounts.sql`
6. Click **Run**

### Verify Policies Are Applied

Run this query to confirm:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'dummy_accounts'
ORDER BY policyname;
```

You should see 4 policies listed:
- `doctors_can_delete_patients`
- `doctors_can_insert_patients`
- `doctors_can_select_patients`
- `doctors_can_update_patients`

## Security Benefits

✅ **Doctor-only access** - Only authenticated doctors can perform operations
✅ **Database-level security** - Enforced at the database, not just the app
✅ **No accidental access** - Cannot accidentally expose patient data to unauthorized users
✅ **Audit trail ready** - Works with Supabase audit logs
✅ **No bypass possible** - RLS cannot be bypassed by application code

## How It Works

**When a doctor tries to access patients:**
1. Doctor signs in → `auth.uid()` is captured
2. User ID looked up in `profiles` table
3. Role checked: Is it 'doctor'?
4. ✅ YES → Operation allowed
5. ❌ NO → "Permission denied" error

**Example flow for creating a patient:**
```
Doctor clicks "Add Patient"
    ↓
AddPatient component sends INSERT request
    ↓
RLS Policy checks: Is user.id in profiles? Is role='doctor'?
    ↓
✅ YES → Patient record created in dummy_accounts
❌ NO → Error: "new row violates row-level security policy"
```

## Testing the Policies

### Test 1: As a Doctor (Should Work)
```typescript
// Doctor is logged in with role='doctor'
const { data, error } = await supabase
  .from('dummy_accounts')
  .insert([{ patient_name: 'John', email: 'john@example.com', ... }]);
// ✅ Should succeed
```

### Test 2: As a Patient (Should Fail)
```typescript
// Patient is logged in with role='patient'
const { data, error } = await supabase
  .from('dummy_accounts')
  .insert([{ patient_name: 'John', email: 'john@example.com', ... }]);
// ❌ Should get: "new row violates row-level security policy"
```

### Test 3: Unauthenticated (Should Fail)
```typescript
// No user logged in
const { data, error } = await supabase
  .from('dummy_accounts')
  .select('*');
// ❌ Should get: "new row violates row-level security policy"
```

## Troubleshooting

### Issue: "new row violates row-level security policy"
**Cause:** User is not a doctor or not authenticated
**Solution:** 
- Verify user is logged in
- Check user's role in profiles table is 'doctor'
- Run: `SELECT id, email, role FROM profiles WHERE id = auth.uid();`

### Issue: Doctors can't see any patients
**Cause:** Policies not applied or profiles table doesn't have doctor role
**Solution:**
- Verify migration ran successfully
- Check doctor's role: `SELECT role FROM profiles WHERE id = auth.uid();`
- Should return: `doctor`

### Issue: "relation does not exist"
**Cause:** The migration hasn't been run yet
**Solution:** Run the SQL migration in Supabase SQL Editor

## Related Files

- Migration: `supabase/migrations/006_add_rls_policies_dummy_accounts.sql`
- Component: `apps/doctor-mobile/components/patientrecord/AddPatient.tsx`
- RecordsTab: `apps/doctor-mobile/components/navigation/RecordsTab.tsx`

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth Overview](https://supabase.com/docs/guides/auth)
