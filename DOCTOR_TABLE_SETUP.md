# Doctor Details Table Setup Guide

## Overview
A new **public `doctors` table** has been created for storing doctor-specific information in Supabase. This table includes medical license, specialization, clinic details, office hours, and professional credentials.

## 📝 What Was Created

### 1. Migration File
- **Location**: `supabase/migrations/003_create_doctors_table.sql`
- **Purpose**: Creates the doctors table with proper indexes and RLS policies

### 2. TypeScript Types
- **Location**: `packages/shared-types/index.ts`
- **New Interfaces**:
  - `Doctor` — Main doctor profile interface
  - `OfficeHours` — Office hours structure
  - `EMPTY_DOCTOR` — Default empty doctor object

## 🚀 How to Apply (2 Steps)

### Step 1: Run the SQL Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** → **New Query**
3. Open and copy the entire contents of:
   ```
   supabase/migrations/003_create_doctors_table.sql
   ```
4. Paste it into the SQL Editor
5. Click **Run** (or press `Ctrl+Enter`)

✅ The `doctors` table will be created with all RLS policies and indexes

### Step 2: Verify the Table

In Supabase Dashboard:
1. Go to **Table Editor**
2. Look for the new `doctors` table in the sidebar
3. Verify columns:
   - ✅ `id` (UUID primary key)
   - ✅ `user_id` (references profiles table)
   - ✅ `license_number` (TEXT, unique)
   - ✅ `specialization` (TEXT)
   - ✅ `bio` (TEXT)
   - ✅ `clinic_name`, `clinic_address`, `clinic_phone`, `clinic_email`
   - ✅ `office_hours` (JSONB)
   - ✅ `years_of_experience` (INTEGER)
   - ✅ `qualifications` (TEXT[])
   - ✅ `availability_status` (available/on-leave/on-vacation/unavailable)
   - ✅ `is_verified` (BOOLEAN)
   - ✅ `is_available` (BOOLEAN)
   - ✅ `profile_picture_url` (TEXT)
   - ✅ `created_at`, `updated_at` (TIMESTAMPTZ)

## 📊 Table Schema

```sql
CREATE TABLE public.doctors (
  id                  UUID PRIMARY KEY
  user_id             UUID UNIQUE (refs profiles.id)
  license_number      TEXT UNIQUE NOT NULL
  specialization      TEXT NOT NULL
  bio                 TEXT
  clinic_name         TEXT
  clinic_address      TEXT
  clinic_phone        TEXT
  clinic_email        TEXT
  office_hours        JSONB
  years_of_experience INTEGER
  qualifications      TEXT[]
  is_available        BOOLEAN DEFAULT TRUE
  availability_status TEXT (available/on-leave/on-vacation/unavailable)
  profile_picture_url TEXT
  is_verified         BOOLEAN DEFAULT FALSE
  verification_date   TIMESTAMPTZ
  created_at          TIMESTAMPTZ DEFAULT now()
  updated_at          TIMESTAMPTZ DEFAULT now()
)
```

## 🔒 Security Policies (RLS Enabled)

The table has Row Level Security (RLS) enabled with these policies:

| Policy | Effect |
|--------|--------|
| `doctors_select_public` | Any user can **view** all doctor profiles |
| `doctors_select_authenticated` | Authenticated users can **view** all doctor profiles |
| `doctors_update_own` | Doctors can **update** only their own profile |
| `doctors_insert_own` | Doctors can **insert** only their own profile |

**Implication**: ✅ **The table is public for reading** (patients can see doctor profiles)

## 📄 Example Office Hours JSON

```json
{
  "monday": { "open": "09:00", "close": "17:00" },
  "tuesday": { "open": "09:00", "close": "17:00" },
  "wednesday": { "open": "09:00", "close": "17:00" },
  "thursday": { "open": "09:00", "close": "17:00" },
  "friday": { "open": "09:00", "close": "17:00" },
  "saturday": { "isClosed": true },
  "sunday": { "isClosed": true }
}
```

## 🏗️ Using the Doctor Type

### Import:
```typescript
import { Doctor, OfficeHours, EMPTY_DOCTOR } from '@smileguard/shared-types';
```

### Create a new doctor:
```typescript
const newDoctor: Doctor = {
  ...EMPTY_DOCTOR,
  user_id: currentUser.id,
  license_number: "DL12345",
  specialization: "General Dentistry",
  clinic_name: "Smile Dental Clinic",
  years_of_experience: 10,
  qualifications: ["DDS", "Pediatric Dentistry Fellowship"]
};
```

### Query doctors from Supabase:
```typescript
import { supabase } from '@smileguard/supabase-client';

// Get all doctors
const { data: doctors } = await supabase
  .from('doctors')
  .select('*');

// Get specific doctor
const { data: doctor } = await supabase
  .from('doctors')
  .select('*')
  .eq('user_id', doctorId)
  .single();

// Get available doctors
const { data: availableDoctors } = await supabase
  .from('doctors')
  .select('*')
  .eq('is_available', true);
```

### Insert a doctor profile:
```typescript
const { data, error } = await supabase
  .from('doctors')
  .insert([{
    user_id: currentUser.id,
    license_number: "DL12345",
    specialization: "General Dentistry",
    clinic_name: "Smile Dental Clinic",
    office_hours: {
      monday: { open: "09:00", close: "17:00" },
      // ... other days
    }
  }])
  .select();
```

## 🔍 Database Indexes

The following indexes are created for optimal query performance:

- `idx_doctors_user_id` — For quick user lookups
- `idx_doctors_specialization` — For filtering by specialization
- `idx_doctors_clinic_name` — For clinic searches
- `idx_doctors_is_available` — For availability filters
- `idx_doctors_is_verified` — For verification status queries

## ✅ Next Steps

1. ✅ Run the migration in Supabase SQL Editor
2. ✅ Verify the table exists with all columns
3. ✅ Start using the `Doctor` type in your components
4. ✅ Implement doctor profile setup form in `DoctorProfileSetup.tsx`
5. ✅ Create a doctor service for CRUD operations

## 📋 Generated Files

- `supabase/migrations/003_create_doctors_table.sql` — SQL migration
- `packages/shared-types/index.ts` — Updated with Doctor types

---

**Status**: ✅ Ready to deploy to production
