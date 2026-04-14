# Doctor Dashboard - Supabase Integration Guide

## Overview

The Doctor Dashboard has been updated to connect directly to Supabase tables instead of using mock/sample data. Each section of the dashboard now corresponds to specific Supabase tables and queries.

## Key Changes

### 1. **New Service Layer: `dashboardService.ts`**

Created a comprehensive dashboard service (`lib/dashboardService.ts`) that handles all Supabase data fetching:

#### Functions Available:

- **`fetchDoctorAppointments(doctorId)`** - Fetches all appointments for a doctor
  - Table: `appointments`
  - Filters: `dentist_id = doctorId`
  - Returns: Array of Appointment objects

- **`fetchTodayAppointments(doctorId, date)`** - Fetches today's appointments
  - Table: `appointments`
  - Filters: `dentist_id = doctorId` AND `appointment_date = date`
  - Orders by: `appointment_time` (ascending)

- **`getAppointmentStats(doctorId)`** - Gets appointment statistics
  - Counts appointments by status:
    - `scheduled`
    - `completed`
    - `cancelled`
    - `no-show`

- **`fetchDoctorPatients(doctorId)`** - Fetches all patients for a doctor
  - Combines data from `appointments` and `profiles` tables
  - Returns unique patient list with full profile info

- **`fetchAppointmentWithPatientDetails(appointmentId)`** - Gets appointment + patient details
  - Joins `appointments` and `profiles` tables

- **`getBookedTimeSlots(doctorId, date)`** - Checks available time slots
  - Returns list of booked times for a specific doctor/date

## Dashboard Data Mapping

### Dashboard Sections → Supabase Tables

#### 1. **Stats Panel (Top)**
```
Appointments:    stats.scheduled + stats.completed + stats.cancelled + stats.noShow
Scheduled:       stats.scheduled (WHERE status = 'scheduled')
Completed:       stats.completed (WHERE status = 'completed')
```

**Source**: `appointments` table aggregated by status

---

#### 2. **Today's Appointments (Left Column)**
```
Shows: All appointments for today (appointment_date = TODAY)
Filtered by: dentist_id = current_user.id
Sorted by: appointment_time
```

**Source**: `appointments` table

**Fields Displayed**:
- Time: `appointment_time` (HH:MM format)
- Service: `service`
- Status: `status` (color-coded badge)

---

#### 3. **Patient Details (Right Column)**
```
Shows: Details of selected appointment
Displays:
  - Service: appointment.service
  - Time: appointment.appointment_time
  - Status: appointment.status
  - Notes: appointment.notes
```

**Source**: `appointments` table

---

#### 4. **Patient Roster**
```
Lists first 3 unique patients from doctor's appointments
Filtered by: patients associated with doctor's appointments
```

**Source**: `profiles` table (joined via `appointments.patient_id`)

**Fields Displayed**:
- Name: `profiles.name`
- Email: `profiles.email`
- Phone: `profiles.phone`

---

## Database Schema Reference

### `appointments` Table

```sql
id              UUID PRIMARY KEY
patient_id      UUID (REFERENCES profiles)
dentist_id      UUID (REFERENCES profiles)
service         TEXT
appointment_date DATE
appointment_time TEXT
status          TEXT ('scheduled' | 'completed' | 'cancelled' | 'no-show')
notes           TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### `profiles` Table (Referenced)

```sql
id              UUID PRIMARY KEY
name            TEXT
email           TEXT
phone           TEXT
role            TEXT ('patient' | 'doctor')
```

## Component Updates

### `DoctorDashboard.tsx`

**Major Changes**:

1. **Imports**: Added `dashboardService` functions
2. **State Management**:
   - `loadingAppointments`: Boolean flag for loading state
   - `loadingPatients`: Boolean flag for loading state
   - `appointments`: Array of appointments from Supabase
   - `patients`: Array of patients from Supabase
   - `stats`: Object containing appointment statistics
   - `dataFetched`: Flag to prevent duplicate API calls

3. **useEffect Hook**: Initializes dashboard on component mount
   ```typescript
   - Fetches all appointments
   - Fetches today's appointments
   - Fetches appointment statistics
   - Fetches patient list
   - Handles loading/error states
   ```

4. **Loading UI**: Shows ActivityIndicator while data loads

5. **Stats Display**: Now shows real statistics from Supabase
   - Total appointments
   - Scheduled count
   - Completed count

## Data Flow Diagram

```
┌─────────────────────┐
│  DoctorDashboard    │
│   Component         │
└──────────┬──────────┘
           │
           ├─► useEffect on mount
           │
           ├─► dashboardService.fetchDoctorAppointments()
           │   └─► Supabase: SELECT * FROM appointments WHERE dentist_id = ?
           │       └─► setAppointments()
           │
           ├─► dashboardService.getAppointmentStats()
           │   └─► Supabase: SELECT status, COUNT(*) FROM appointments
           │       WHERE dentist_id = ? GROUP BY status
           │       └─► setStats()
           │
           └─► dashboardService.fetchDoctorPatients()
               └─► Supabase: SELECT DISTINCT patient_id FROM appointments
                             WHERE dentist_id = ?
                   └─► Supabase: SELECT * FROM profiles WHERE id IN (...)
                       └─► setPatients()
```

## Usage Example

```typescript
// In component initialization:
const { success, data: appointments } = await fetchDoctorAppointments(doctorId);

if (success) {
  setAppointments(data); // Use appointment data
} else {
  setErrorMessage('Failed to fetch appointments');
}
```

## Updating Appointment Status

Updating an appointment status persists to Supabase:

```typescript
const handleUpdateAppointmentStatus = async (appointmentId, status) => {
  const result = await updateDoctorAppointmentStatus(appointmentId, status, doctorId);
  
  if (result.success) {
    // Update local state
    setAppointments(prev => 
      prev.map(apt => apt.id === appointmentId ? {...apt, status} : apt)
    );
  }
};
```

## Error Handling

- **Network errors**: Displays error message on dashboard
- **Missing data**: Shows "No appointments" or "No patients" messages
- **Loading states**: Displays ActivityIndicator during data fetch
- **Fallback**: Empty arrays if no data found

## Performance Optimizations

1. **Single fetch on mount**: Data fetched once via `dataFetched` flag
2. **Indexed queries**: Supabase indexes on:
   - `dentist_id` (appointments table)
   - `appointment_date` (for today's appointments)
   - `status` (for statistics)

3. **Efficient joins**: Only fetches necessary profile fields

## Configuration

No additional configuration needed. Dashboard uses existing Supabase client from `lib/supabase.ts`

## Testing

To test Supabase integration:

1. Ensure doctor has appointments in Supabase
2. Check browser console for:
   - `✅ Fetched X appointments`
   - `✅ Stats loaded: {...}`
   - `✅ Loaded X patients`

3. Verify data appears in dashboard

## Future Enhancements

1. **Real-time updates**: Use Supabase subscriptions for live appointment updates
2. **Pagination**: Load appointments in batches for better performance
3. **Advanced filtering**: Filter by status, date range, service type
4. **Patient images**: Store patient photos in Supabase Storage
5. **Caching**: Implement local data caching with sync intervals

## Migration from Mock Data

The original mock data (SAMPLE_APPOINTMENTS, SAMPLE_REQUESTS, SAMPLE_PATIENTS) is no longer used. All data now comes from Supabase.

### Old Import (Removed):
```typescript
import {
  SAMPLE_APPOINTMENTS,
  SAMPLE_REQUESTS,
  SAMPLE_PATIENTS,
} from "../../data/dashboardData";
```

### New Import (Added):
```typescript
import {
  fetchDoctorAppointments,
  fetchTodayAppointments,
  getAppointmentStats,
  fetchDoctorPatients,
} from "../../lib/dashboardService";
```

## Troubleshooting

### Empty Dashboard

**Check**:
1. Doctor ID is correct: `console.log(user?.id)`
2. Supabase connection: `console.log('Supabase URL:', SUPABASE_URL)`
3. Appointments exist in Supabase for this doctor
4. Check browser network tab for API errors

### Slow Loading

1. Check network speed
2. Verify Supabase indexes are active
3. Consider pagination for large datasets

### Styling Issues

Dashboard uses the same StyleSheet as before. All styling props are preserved.

## Support Files

- `lib/dashboardService.ts` - Supabase service layer
- `lib/supabase.ts` - Supabase client configuration
- `packages/shared-types/index.ts` - TypeScript type definitions
