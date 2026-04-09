# Clinic Rules Setup Guide

**Last Updated:** April 9, 2026  
**Status:** ✅ Complete

---

## Overview

The `clinic_rules` table stores operational rules, policies, and configurations for each doctor's clinic. This enables granular control over how appointments are booked, cancelled, and managed.

### What Gets Stored

- **Appointment Rules**: Booking windows, duration limits, daily caps
- **Cancellation Policies**: Notice required, penalty fees
- **No-Show Policies**: Penalties and enforcement
- **Break & Buffer Times**: Between appointments, lunch breaks
- **Notification Rules**: Reminder timing and preferences
- **Patient Rules**: Max per slot, walk-ins, forms required
- **Payment Rules**: Upfront payment, accepted methods
- **Operational Details**: Notes, policies URL

---

## Database Structure

### Table: `clinic_rules`

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | ✅ | auto | Unique identifier |
| `doctor_id` | UUID | ✅ | - | Foreign key to doctors table |
| `min_advance_booking_hours` | INT | ❌ | 24 | Hours minimum to book ahead |
| `max_advance_booking_days` | INT | ❌ | 90 | Days maximum to book ahead |
| `min_appointment_duration_mins` | INT | ❌ | 30 | Minimum slot duration |
| `max_daily_appointments` | INT | ❌ | 20 | Max appointments per day |
| `cancellation_policy_text` | TEXT | ❌ | null | Policy description for patients |
| `cancellation_fee_percentage` | DECIMAL | ❌ | 0 | Fee % if cancelled |
| `min_hours_to_cancel` | INT | ❌ | 24 | Hours before appointment to cancel |
| `min_hours_to_reschedule` | INT | ❌ | 24 | Hours before appointment to reschedule |
| `allow_no_show_penalty` | BOOLEAN | ❌ | true | Enable no-show charges |
| `no_show_penalty_percentage` | DECIMAL | ❌ | 50 | No-show fee % |
| `break_between_appointments_mins` | INT | ❌ | 15 | Buffer between appointments |
| `buffer_before_lunch_mins` | INT | ❌ | 30 | Time before lunch starts |
| `lunch_start_time` | TIME | ❌ | null | Lunch start (HH:MM format) |
| `lunch_end_time` | TIME | ❌ | null | Lunch end (HH:MM format) |
| `send_appointment_reminders` | BOOLEAN | ❌ | true | Auto-send reminders |
| `reminder_before_hours` | INT | ❌ | 24 | When to send reminder |
| `max_patients_per_slot` | INT | ❌ | 1 | Concurrent appointments |
| `allow_walk_ins` | BOOLEAN | ❌ | false | Accept without booking |
| `require_new_patient_form` | BOOLEAN | ❌ | true | New patients fill form |
| `auto_approve_appointments` | BOOLEAN | ❌ | false | Auto-confirm bookings |
| `require_payment_upfront` | BOOLEAN | ❌ | false | Payment before appointment |
| `accepted_payment_methods` | TEXT[] | ❌ | ['card','cash','insurance'] | Accepted payment types |
| `clinic_notes` | TEXT | ❌ | null | Internal clinic notes |
| `policies_url` | TEXT | ❌ | null | Link to full policies |
| `created_at` | TIMESTAMPTZ | ✅ | now() | Created timestamp |
| `updated_at` | TIMESTAMPTZ | ✅ | now() | Last updated timestamp |

---

## Row Level Security (RLS)

The table has RLS enabled with the following policies:

### `clinic_rules_select_authenticated`
- **Action**: SELECT
- **Who**: Any authenticated user
- **Purpose**: Allow reading clinic rules for display

### `clinic_rules_update_own`
- **Action**: UPDATE
- **Who**: Doctor who owns the clinic (via `doctors.user_id`)
- **Purpose**: Only doctors can update their own rules

### `clinic_rules_insert_own`
- **Action**: INSERT
- **Who**: Doctor creating their own rules
- **Purpose**: Only doctors can create rules for their clinic

### `clinic_rules_delete_own`
- **Action**: DELETE
- **Who**: Doctor who owns the clinic
- **Purpose**: Only doctors can delete their own rules

---

## Usage Examples

### 1. Get Clinic Rules for a Doctor

```typescript
import { getClinicRulesByDoctorId } from '@repo/supabase-client';

const doctorId = '123e4567-e89b-12d3-a456-426614174000';
const rules = await getClinicRulesByDoctorId(doctorId);

if (rules) {
  console.log(`Clinic allows bookings ${rules.min_advance_booking_hours} hours in advance`);
  console.log(`Cancellation fee: ${rules.cancellation_fee_percentage}%`);
} else {
  console.log('No rules found for this doctor');
}
```

### 2. Create Default Rules for New Clinic

```typescript
import { createClinicRules, DEFAULT_CLINIC_RULES } from '@repo/supabase-client';

const doctorId = 'abc123...';
const rules = await createClinicRules({
  doctor_id: doctorId,
  ...DEFAULT_CLINIC_RULES,
  // Override defaults as needed:
  cancellation_fee_percentage: 25,
  max_daily_appointments: 15,
});

console.log('Rules created:', rules.id);
```

### 3. Update Clinic Rules

```typescript
import { updateClinicRules } from '@repo/supabase-client';

const doctorId = '123e4567-e89b-12d3-a456-426614174000';
const updated = await updateClinicRules(doctorId, {
  cancellation_fee_percentage: 50,
  lunch_start_time: '12:00',
  lunch_end_time: '13:00',
  allow_walk_ins: true,
});

console.log('Updated at:', updated.updated_at);
```

### 4. Get or Create with Activity Pattern

```typescript
import { getOrCreateClinicRules } from '@repo/supabase-client';

const rules = await getOrCreateClinicRules(doctorId, {
  // Custom overrides for creation
  max_daily_appointments: 25,
  cancellation_fee_percentage: 10,
});
```

### 5. Validate Rules Before Saving

```typescript
import { validateClinicRules } from '@repo/supabase-client';

const input = {
  cancellation_fee_percentage: 150, // Invalid: > 100
  min_appointment_duration_mins: 0,  // Invalid: must be > 0
};

const { isValid, errors } = validateClinicRules(input);

if (!isValid) {
  console.error('Validation errors:', errors);
  // Output: 
  // - "Cancellation fee percentage must be between 0 and 100"
  // - "Minimum appointment duration must be greater than 0"
}
```

---

## Integration with ClinicSetup Component

### Updated ClinicSetup.tsx Interface

The existing `ClinicData` interface should be updated to include rules:

```typescript
interface ClinicData {
  logo_url?: string;
  address: string;
  city: string;
  phone: string;
  gallery_images?: string[];
  services: Service[];
  schedule: Schedule;
  rules?: Partial<ClinicRules>; // Add this
}
```

### Setup Flow Pattern

```typescript
export default function ClinicSetup() {
  const {doctor} = useAuth();

  // Load existing rules on mount
  useEffect(() => {
    const loadRules = async () => {
      const rules = await getOrCreateClinicRules(doctor.id);
      setClinicRules(rules);
    };
    loadRules();
  }, [doctor.id]);

  // Save updated rules
  const handleSaveRules = async (updatedRules: UpdateClinicRulesInput) => {
    const { isValid, errors } = validateClinicRules(updatedRules);
    if (!isValid) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }
    
    try {
      await updateClinicRules(doctor.id, updatedRules);
      Alert.alert('Success', 'Clinic rules updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to save rules');
    }
  };

  return (
    // ... existing clinic setup UI ...
    // Add clinic rules section here
  );
}
```

---

## Appointment Booking Logic Example

Use clinic rules to validate appointment requests:

```typescript
export function validateAppointmentBooking(
  requestedDateTime: Date,
  clinicRules: ClinicRules,
  existingAppointments: Appointment[]
): { valid: boolean; reason?: string } {
  const now = new Date();
  const hoursDifference = (requestedDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Check advance booking window
  if (hoursDifference < clinicRules.min_advance_booking_hours) {
    return {
      valid: false,
      reason: `Must book at least ${clinicRules.min_advance_booking_hours} hours in advance`,
    };
  }

  // Check max advance booking
  const daysDifference = hoursDifference / 24;
  if (daysDifference > clinicRules.max_advance_booking_days) {
    return {
      valid: false,
      reason: `Cannot book more than ${clinicRules.max_advance_booking_days} days in advance`,
    };
  }

  // Check daily appointment limit
  const appointmentsOnDay = existingAppointments.filter(
    (apt) => isSameDay(new Date(apt.scheduled_time), requestedDateTime)
  ).length;

  if (appointmentsOnDay >= clinicRules.max_daily_appointments) {
    return {
      valid: false,
      reason: `No more appointments available on this day`,
    };
  }

  return { valid: true };
}
```

---

## Common Use Cases

### Scenario 1: Strict Cancellation Policy
```typescript
{
  min_hours_to_cancel: 48,           // 2 days notice
  cancellation_fee_percentage: 50,   // Charge 50% of appointment fee
  allow_no_show_penalty: true,
  no_show_penalty_percentage: 100,   // Full charge for no-shows
}
```

### Scenario 2: Flexible, Walk-in Friendly
```typescript
{
  min_advance_booking_hours: 0,      // Book same-day
  allow_walk_ins: true,
  cancellation_fee_percentage: 0,    // No penalties
  auto_approve_appointments: true,   // Auto-confirm
}
```

### Scenario 3: Premium Concierge Service
```typescript
{
  max_daily_appointments: 8,         // Limited slots
  require_payment_upfront: true,
  max_patients_per_slot: 1,
  require_new_patient_form: true,
  accepted_payment_methods: ['card'], // Card only
  reminder_before_hours: 48,
}
```

---

## Indexes & Performance

The following indexes are created for optimal query performance:

- `idx_clinic_rules_doctor_id` — Primary lookup by doctor
- `idx_clinic_rules_created_at` — Sorting by creation date
- `idx_clinic_rules_updated_at` — Sorting by update date

---

## Migration Instructions

### Step 1: Run the SQL Migration

1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Create a new query
3. Copy and paste the contents of:
   ```
   supabase/migrations/004_create_clinic_rules_table.sql
   ```
4. Click "Run"

### Step 2: Verify Table Creation

```sql
SELECT * FROM clinic_rules LIMIT 1;
```

### Step 3: Test with Sample Data

```sql
INSERT INTO public.clinic_rules (doctor_id)
VALUES ('00000000-0000-0000-0000-000000000000')
ON CONFLICT (doctor_id) DO NOTHING
RETURNING *;
```

---

## Troubleshooting

### "Permission denied" error when updating rules

**Cause**: User is not the doctor who owns the clinic  
**Solution**: Verify `auth.uid()` matches the `doctors.user_id` for the rules being updated

### "Unique violation" on insert

**Cause**: Rules already exist for this doctor_id  
**Solution**: Use `getOrCreateClinicRules()` or update existing rules instead

### No rows returned when fetching rules

**This is normal!** New doctors don't have rules until created. Use:
```typescript
const rules = await getOrCreateClinicRules(doctorId);
```

---

## Related Documentation

- [Doctor Profile Setup Guide](DOCTOR_PROFILE_SETUP_GUIDE.md)
- [Supabase Integration](SUPABASE_DASHBOARD_INTEGRATION.md)
- [Database Schema](DOCTOR_TABLE_SETUP.md)
