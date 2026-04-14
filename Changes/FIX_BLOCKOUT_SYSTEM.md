# Fix: Appointment Blockout Feature Not Working

## Issue
The blockout system wasn't working because of a **schema mismatch** between:
- **Database schema** (setup.sql): Used single `date` column with TIMESTAMPTZ
- **Application code**: Expected `appointment_date` (DATE) and `appointment_time` (TEXT) as separate fields

## What Was Fixed

### 1. Updated Database Schema
**File:** `supabase/setup.sql`

Changed appointments table from:
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  patient_id UUID,
  doctor_id UUID,
  service TEXT,
  date TIMESTAMPTZ,        -- ❌ Single date column
  status TEXT,
  ...
)
```

To:
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  patient_id UUID,
  dentist_id UUID,         -- ✓ Renamed from doctor_id
  service TEXT,
  appointment_date DATE,   -- ✓ Separate date field
  appointment_time TEXT,   -- ✓ Separate time field (HH:MM)
  status TEXT,
  ...
)
```

### 2. Fixed Query Logic
**File:** `lib/appointmentService.ts`

- `getAllBlockedSlots()` now correctly queries `appointment_date` and `appointment_time` columns
- Removed unnecessary `.split('T')[0]` since date is already DATE type

### 3. Updated Status Values
Changed from: `'Pending' | 'Completed' | 'Cancelled'`
To: `'scheduled' | 'completed' | 'cancelled' | 'no-show'`

## How to Apply the Fix

### Option A: Fresh Database Setup (Easiest)
1. Go to your Supabase dashboard
2. Delete the old `appointments` table
3. Run `supabase/setup.sql` again
4. Test booking an appointment

### Option B: Migrate Existing Data
1. Go to Supabase → SQL Editor → New Query
2. Copy the entire contents of `supabase/migrations/001_fix_appointments_blockout.sql`
3. Run the query
4. The migration will:
   - Backup old data
   - Create new table with correct schema
   - Migrate data automatically
   - Drop the old table

## Testing the Fix

1. Open **BookAppointment** component
2. Select a service, date, and time
3. Book an appointment
4. Try to book the **same date and time** again
5. ✓ The time slot should now show as **grey** and **disabled**
6. ✓ It should display "- Unavailable" in the time picker

## Files Modified

- `supabase/setup.sql` - Updated appointments table schema
- `lib/appointmentService.ts` - Fixed query and data mapping
- `components/dashboard/ScheduleBlockoutView.tsx` - Fixed date formatting
- `supabase/migrations/001_fix_appointments_blockout.sql` - Migration file (NEW)

## Status

✅ **Schema fixed**
✅ **Queries updated**
✅ **Component logic verified**
✅ **Ready to deploy**

