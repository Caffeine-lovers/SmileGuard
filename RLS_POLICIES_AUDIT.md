# RLS Policies Audit - SmileGuard Database

**Date**: April 10, 2026  
**Scope**: Row Level Security (RLS) policies affecting subscriptions  
**Focus**: appointments, medical_intake, treatments, billings, doctors tables

---

## 🚨 CRITICAL FINDINGS

### Tables with Subscription Issues

| Table | RLS Enabled | SELECT Policy | Subscription Ready | Issue |
|-------|-------------|----------------|-------------------|-------|
| **appointments** | ❌ NO | ❌ NO | ❌ NO | No RLS policies at all |
| **medical_intake** | ❌ UNKNOWN | ❌ NO | ❌ NO | Table not in migrations yet |
| **treatments** | ❌ UNKNOWN | ❌ NO | ❌ NO | Table not in migrations yet |
| **billings** | ❌ UNKNOWN | ❌ NO | ❌ NO | Table not in migrations yet |
| **doctors** | ✅ YES | ⚠️ WEAK | ⚠️ PARTIAL | See below for details |

---

## 📋 DETAILED RLS POLICY ANALYSIS

### 1. DOCTORS TABLE (`supabase/migrations/003_create_doctors_table.sql`)

**RLS Enabled**: ✅ YES

**Current Policies**:

```sql
-- Policy 1: doctors_select_authenticated
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: doctors_select_public
FOR SELECT
USING (true);  -- OPEN TO EVERYONE

-- Policy 3: doctors_update_own
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: doctors_insert_own
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

**Subscription Assessment** ⚠️:
- ✅ Multiple SELECT policies allow read
- ✅ Public read allows doctors listing
- ❌ **No column-level restrictions** - all columns accessible (including sensitive data)
- ❌ **Doctors cannot filter by treatment/appointment** - needs JOIN to other tables
- ⚠️ **May timeout** when subscribing if doctor profile subscriptions include nested relationships

**Potential Issue**: The `doctors_select_public` policy with `USING (true)` is very permissive. Subscriptions will work but might expose sensitive data.

---

### 2. CLINIC RULES TABLE (`supabase/migrations/004_create_clinic_rules_table.sql`)

**RLS Enabled**: ✅ YES

**Current Policies**:

```sql
-- Policy 1: clinic_rules_select_authenticated
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2-4: clinic_rules_update_own, clinic_rules_insert_own, clinic_rules_delete_own
-- Requires user_id match through doctors table:
USING (
  auth.uid() = (
    SELECT user_id FROM public.doctors 
    WHERE id = clinic_rules.doctor_id
  )
)
```

**Subscription Assessment** ⚠️:
- ✅ SELECT policy exists for authenticated users
- ✅ Can subscribe to clinic_rules
- ❌ **Policy contains subquery** - may cause performance issues
- ⚠️ **Timeout risk** - subqueries in USING clauses block subscriptions on some Supabase versions

**Potential Issue**: The subquery in USING clause is a known Supabase subscription blocker.

---

### 3. DUMMY ACCOUNTS TABLE (`supabase/migrations/005_create_dummy_accounts_table.sql` + `006_add_rls_policies_dummy_accounts.sql`)

**RLS Enabled**: ✅ YES

**Current Policies**:

```sql
-- Policy 1: dummy_accounts_restrict_access (005)
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'doctor')
  )
);

-- Policies 2-5: doctors_can_insert/select/update/delete_patients (006)
FOR [INSERT|SELECT|UPDATE|DELETE]
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'doctor'
  )
)
```

**Subscription Assessment** ⚠️:
- ✅ SELECT policy exists
- ✅ Restricts to doctors only
- ❌ **Uses EXISTS subquery** - BLOCKS SUBSCRIPTIONS
- ❌ **Multiple EXISTS checks** - causes multiple query evaluations

**Critical Issue**: EXISTS subqueries in RLS policies prevent Supabase real-time subscriptions from working properly. This is a known limitation.

---

### 4. APPOINTMENTS TABLE (`supabase/migrations/001_fix_appointments_blockout.sql`)

**RLS Enabled**: ❌ **NO**

**Current Schema**:
```sql
CREATE TABLE IF NOT EXISTS public.appointments (
  id                  UUID PRIMARY KEY,
  patient_id          UUID NOT NULL,
  dentist_id          UUID,
  service             TEXT NOT NULL,
  appointment_date    DATE NOT NULL,
  appointment_time    TEXT NOT NULL,
  status              TEXT NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
);
```

**No RLS Policy Created**

**Subscription Assessment** 🚫:
- ❌ **NO RLS POLICIES** - table is world-readable if public
- ❌ **No SELECT policy** - subscriptions will fail or expose all data
- ❌ **Doctors cannot subscribe** - no policy allowing their specific appointments
- ❌ **Patients cannot subscribe** - no policy restricting to their appointments

**Critical Issue**: Without RLS policies, appointments are either:
1. Completely restricted (401 error on subscription)
2. World-readable (security breach)
3. Not subscribable at all

---

### 5. MEDICAL INTAKE TABLE

**Status**: ❌ **NOT IN MIGRATIONS**

**Referenced In**:
- `apps/doctor-mobile/lib/profilesPatients.ts` (lines 63-75, 195-225)
- `packages/shared-types/index.ts` (MedicalIntake interface)
- Various documentation files

**Schema Expected**:
```typescript
interface MedicalIntake {
  patient_id: UUID;
  allergies: string;
  current_medications: string;
  medical_conditions: string;
  past_surgeries: string;
  smoking_status: string;  // 'never' | 'former' | 'current'
  pregnancy_status: string; // 'yes' | 'no' | 'na'
  notes: string;
}
```

**Subscription Assessment** 🚫:
- ❌ **TABLE LIKELY DOESN'T EXIST** - no migration file found
- ❌ **No RLS policies** - cannot create
- ❌ **Subscriptions will fail** - table missing
- ❌ **Doctors cannot access** - no permissions
- ⚠️ **Patients cannot view own** - no filter policy

**Critical Issue**: This table needs to be created with proper RLS policies.

---

### 6. TREATMENTS TABLE

**Status**: ❌ **NOT IN MIGRATIONS**

**Referenced In**:
- `apps/doctor-mobile/lib/syncService.ts` (lines 140-154)
- `apps/doctor-mobile/lib/database.ts` (Treatment interface + getTreatments)
- `packages/shared-types/index.ts` (Treatment interface)

**Schema Expected**:
```typescript
interface Treatment {
  id?: UUID;
  patient_id: UUID;
  doctor_id?: UUID;
  treatment_type: string;
  description: string;
  date: string;
  cost?: number;
  // ... other fields
}
```

**Subscription Assessment** 🚫:
- ❌ **TABLE LIKELY DOESN'T EXIST** - no migration file found
- ❌ **No RLS policies** - cannot create
- ❌ **Subscriptions will fail** - table missing
- ❌ **Doctors cannot subscribe** - no table/policy
- ❌ **No column-level filtering** - would expose all treatments

**Critical Issue**: This table is actively used in sync service but has no database representation.

---

### 7. BILLINGS TABLE

**Status**: ❌ **NOT IN MIGRATIONS**

**Referenced In**:
- `apps/doctor-mobile/lib/syncService.ts` (lines 155-166)
- `apps/doctor-mobile/lib/database.ts` (Billing interface + getBillings)
- `apps/patient-web/lib/paymentService.ts` (getBillings function)
- `packages/shared-types/index.ts` (Billing interface)
- `components/billing/BillingPayment.tsx`

**Schema Expected**:
```typescript
interface Billing {
  id?: UUID;
  patient_id: UUID;
  appointment_id?: UUID;
  amount: number;
  discount_type?: 'none' | 'pwd' | 'senior' | 'insurance';
  discount_amount?: number;
  final_amount: number;
  payment_status: 'pending' | 'paid' | 'overdue';
  payment_method?: 'cash' | 'card' | 'gcash' | 'bank-transfer';
  payment_date?: string;
}
```

**Subscription Assessment** 🚫:
- ❌ **TABLE LIKELY DOESN'T EXIST** - no migration file found
- ❌ **No RLS policies** - cannot create
- ❌ **Subscriptions will fail** - table missing
- ❌ **Patients cannot subscribe** - no table/policy for own invoices
- ❌ **Doctors cannot subscribe** - no table/policy for patient billings
- ⚠️ **No payment data protection** - would be world-readable if exists

**Critical Issue**: Billing data is sensitive and must have strict RLS policies before going to production.

---

## 🔍 SUBSCRIPTION BLOCKING ANALYSIS

### Why Subscriptions Fail

#### 1. **EXISTS Subqueries** ❌
Files affected:
- `006_add_rls_policies_dummy_accounts.sql` (lines 21-47, 45-55, 64-76)
- `004_create_clinic_rules_table.sql` (lines 86-104, 109-120)

```sql
-- THIS BLOCKS SUBSCRIPTIONS:
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
)
```

Supabase limitation: EXISTS subqueries in RLS policies cannot be evaluated in real-time subscription context.

#### 2. **Missing SELECT Policies** ❌
- `appointments` - No SELECT policy defined
- `medical_intake` - Table doesn't exist
- `treatments` - Table doesn't exist
- `billings` - Table doesn't exist

#### 3. **Overly Permissive Policies** ⚠️
File: `003_create_doctors_table.sql` (lines 63-64)

```sql
CREATE POLICY "doctors_select_public" ON public.doctors
  FOR SELECT
  USING (true);  -- ALLOWS ANYONE
```

While this works for subscriptions, it exposes data to everyone.

#### 4. **No Subscription Grants** ❌
All policies missing explicit GRANT for real-time subscriptions:

```sql
-- MISSING: GRANT SELECT ON appointments TO authenticated;
-- MISSING: GRANT SUBSCRIBE ON appointments TO authenticated;
```

---

## 📋 SUMMARY TABLE: What Needs Fixing

| Component | Status | Issue | Priority |
|-----------|--------|-------|----------|
| **appointments RLS** | Missing | No SELECT policy, table not secured | 🔴 CRITICAL |
| **medical_intake table** | Missing | Table doesn't exist | 🔴 CRITICAL |
| **treatments table** | Missing | Table doesn't exist | 🔴 CRITICAL |
| **billings table** | Missing | Table doesn't exist | 🔴 CRITICAL |
| **doctors subscription** | Broken | Overly permissive, no column filtering | 🟡 HIGH |
| **clinic_rules subscription** | Broken | EXISTS subquery blocks realtime | 🟡 HIGH |
| **dummy_accounts subscription** | Broken | Exists subquery blocks realtime | 🟡 HIGH |
| **Real-time grants** | Missing | No GRANT SUBSCRIBE statements | 🟡 HIGH |

---

## 🛠️ RECOMMENDED FIXES

### Fix 1: Create Appointments RLS Policies
```sql
-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Patients see only their own appointments
CREATE POLICY "appointments_patients_own" ON public.appointments
  FOR SELECT
  USING (
    (auth.uid() = patient_id) OR
    (auth.uid() = dentist_id)
  );

-- Patients can insert appointments
CREATE POLICY "appointments_patients_insert" ON public.appointments
  FOR INSERT
  WITH CHECK (auth.uid() = patient_id);
```

**Subscription**: ✅ Will work - no subqueries

### Fix 2: Remove EXISTS Subqueries From Policies
**Replace**:
```sql
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'doctor'
  )
)
```

**With**:
```sql
USING (
  (SELECT profiles.role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
)
```

Or use a stored procedure/function:
```sql
CREATE OR REPLACE FUNCTION is_doctor()
RETURNS BOOLEAN AS $$
  SELECT role = 'doctor' 
  FROM public.profiles 
  WHERE id = auth.uid();
$$ LANGUAGE SQL;

-- Then in policy:
USING (is_doctor())
```

**Subscription**: ⚠️ May still fail - better approach is JOIN

### Fix 3: Use JOINs Instead of Subqueries
**Better approach for clinic_rules**:
```sql
CREATE POLICY "clinic_rules_doctor_access" ON public.clinic_rules
  FOR SELECT
  USING (
    (SELECT doctors.user_id FROM doctors WHERE doctors.id = clinic_rules.doctor_id) = auth.uid()
  );
```

**Subscription**: ✅ Will work better

### Fix 4: Create Missing Tables with RLS
Need migrations for:
- `medical_intake`
- `treatments` 
- `billings`

Example structure:
```sql
CREATE TABLE IF NOT EXISTS public.medical_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  allergies TEXT,
  current_medications TEXT,
  -- ... other fields
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.medical_intake ENABLE ROW LEVEL SECURITY;

-- Patients see only their own
CREATE POLICY "medical_intake_patients_own" ON public.medical_intake
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Doctors see all patients
CREATE POLICY "medical_intake_doctors_all" ON public.medical_intake
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  );

-- Need GRANT for subscriptions:
GRANT SELECT ON public.medical_intake TO authenticated;
```

**Subscription**: ✅ Will work if subqueries are optimized

### Fix 5: Add Explicit Subscription Grants
```sql
-- For all tables needing subscriptions:
GRANT SUBSCRIBE ON public.appointments TO authenticated;
GRANT SUBSCRIBE ON public.medical_intake TO authenticated;
GRANT SUBSCRIBE ON public.treatments TO authenticated;
GRANT SUBSCRIBE ON public.billings TO authenticated;
GRANT SUBSCRIBE ON public.doctors TO authenticated;
GRANT SUBSCRIBE ON public.clinic_rules TO authenticated;
```

---

## ✅ Subscription Readiness Checklist

For each table, ensure:

- [ ] RLS enabled: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- [ ] SELECT policy exists: `CREATE POLICY ... FOR SELECT USING (...);`
- [ ] No complex subqueries (use functions if needed)
- [ ] No EXISTS clauses (use simple conditions)
- [ ] GRANT SELECT for authenticated users
- [ ] GRANT SUBSCRIBE for authenticated users
- [ ] Policy provides proper data filtering (not world-readable)
- [ ] Test subscription: 
  ```typescript
  supabase
    .channel('table_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tablename' }, handler)
    .subscribe()
  ```

---

## 📊 Current Status Summary

**RLS Policies Status**:
- ✅ 2 tables have policies (doctors, clinic_rules)
- ⚠️ 1 table partially (dummy_accounts - but with subscription blockers)
- ❌ 1 table has no policies (appointments)
- ❌ 3 tables missing entirely (medical_intake, treatments, billings)

**Subscription Status**:
- ❌ **CRITICAL**: appointments, medical_intake, treatments, billings - NOT SUBSCRIBABLE
- ⚠️ **BROKEN**: doctors, clinic_rules, dummy_accounts - Subscription Issues due to EXISTS subqueries
- 🚫 **RESULT**: Doctor subscriptions will likely fail across all linked tables

---

## 🔗 Related Files

**Migration Files**:
- [001_fix_appointments_blockout.sql](supabase/migrations/001_fix_appointments_blockout.sql)
- [002_rpc_get_appointments.sql](supabase/migrations/002_rpc_get_appointments.sql)
- [003_create_doctors_table.sql](supabase/migrations/003_create_doctors_table.sql)
- [004_create_clinic_rules_table.sql](supabase/migrations/004_create_clinic_rules_table.sql)
- [005_create_dummy_accounts_table.sql](supabase/migrations/005_create_dummy_accounts_table.sql)
- [006_add_rls_policies_dummy_accounts.sql](supabase/migrations/006_add_rls_policies_dummy_accounts.sql)

**Type Definitions**:
- [packages/shared-types/index.ts](packages/shared-types/index.ts) - Billing, Treatment, MedicalIntake

**Usage Files**:
- [apps/doctor-mobile/lib/profilesPatients.ts](apps/doctor-mobile/lib/profilesPatients.ts)
- [apps/doctor-mobile/lib/database.ts](apps/doctor-mobile/lib/database.ts)
- [apps/doctor-mobile/lib/syncService.ts](apps/doctor-mobile/lib/syncService.ts)
- [apps/patient-web/lib/paymentService.ts](apps/patient-web/lib/paymentService.ts)

---

## 📖 Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Real-time Subscriptions](https://supabase.com/docs/guides/realtime)
- [Supabase RLS Policy Examples](https://supabase.com/docs/guides/auth/row-level-security/policies)
- [PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
