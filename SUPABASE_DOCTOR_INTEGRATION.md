# Supabase Integration Guide - Doctor Mobile

## Overview
The DoctorDashboard and AllAppointments components have been integrated with Supabase to fetch real appointment data from the patient-web backend.

## Files Modified

### 1. `/apps/doctor-mobile/lib/appointmentService.ts`
**New Functions Added:**
- `getDoctorAppointments(dentistId, startDate?, endDate?)` - Fetches all appointments for a doctor
- `getDoctorAppointmentsByDate(dentistId, date)` - Fetches appointments for a specific date
- `getPatientInfo(patientId)` - Fetches patient information from the patients table
- `updateDoctorAppointmentStatus(appointmentId, status)` - Updates appointment status in Supabase
- `getTodayAppointments(dentistId)` - Convenience function for today's appointments
- `getDoctorAppointmentsEnriched(dentistId, startDate?, endDate?)` - Returns appointments with enriched patient data
- `getDoctorStats(dentistId)` - Returns statistics (total patients, appointments, etc.)

**Interfaces:**
```typescript
interface DoctorAppointment {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string;
  status: 'scheduled' | 'arrived' | 'finished' | 'cancelled' | 'no-show';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface PatientInfo {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  medical_conditions?: string;
  allergies?: string;
  created_at?: string;
  updated_at?: string;
}
```

### 2. `/apps/doctor-mobile/components/dashboard/DoctorDashboard.tsx`
**Key Changes:**
- Added `useEffect` hook to fetch appointments on component mount
- Integrated Supabase appointment fetching via `getDoctorAppointments()`
- Patient data enriched with `getPatientInfo()` for each appointment
- Age calculation from date_of_birth
- Real-time status updates via `updateDoctorAppointmentStatus()`
- Added loading state with `ActivityIndicator`
- Stats panel now displays real data from Supabase
- Fallback to placeholder images for patient photos

**New Imports:**
```typescript
import {
  getDoctorAppointments,
  getTodayAppointments,
  getPatientInfo,
  updateDoctorAppointmentStatus,
  getDoctorStats,
} from "../../lib/appointmentService";
```

**Features:**
- Fetches doctor's appointments on mount using `user.id` (dentist_id)
- Transforms Supabase data to match `AppointmentType` format
- Shows loading indicator while fetching
- Displays real patient statistics
- Updates appointment statuses with Supabase persistence

### 3. `/apps/doctor-mobile/components/appointments/AllAppointments.tsx`
**Key Changes:**
- Added Supabase integration for real-time status updates
- Optional `dentistId` prop for fetching from Supabase
- `handleUpdateStatus` now persists to Supabase
- Added loading states
- Integrated `useAuth` hook (though not yet actively used)

**New Props:**
```typescript
interface AllAppointmentsProps {
  appointments: AppointmentType[];
  onUpdateAppointmentStatus?: (appointmentId: string, status: 'scheduled' | 'arrived' | 'finished') => void;
  dentistId?: string; // Optional: for direct Supabase fetching
}
```

**Features:**
- Status updates persist to Supabase database
- Can work with either passed appointments or fetch from Supabase
- Error handling for failed updates

## Data Flow

```
┌─────────────────────────────────────────┐
│     DoctorDashboard Component           │
│  (uses user.id as dentistId)            │
└──────────────┬──────────────────────────┘
               │
               ├─ fetchAppointments() on useEffect
               │
               ├─ getDoctorAppointments(user.id)
               │   └─ Supabase: SELECT * FROM appointments WHERE dentist_id = ?
               │
               ├─ For each appointment:
               │   └─ getPatientInfo(patient_id)
               │       └─ Supabase: SELECT * FROM patients WHERE id = ?
               │
               └─ setAppointments() with enriched data
                   │
                   ├─ Display today's appointments
                   ├─ Show patient statistics
                   │
                   └─ AllAppointments component
                       │
                       ├─ Calendar view of all appointments
                       ├─ Status updates via updateDoctorAppointmentStatus()
                       │   └─ Supabase: UPDATE appointments SET status = ? WHERE id = ?
                       │
                       └─ Real-time sync with database
```

## Supabase Tables Required

### `appointments` table
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL,
  dentist_id UUID NOT NULL,
  service VARCHAR NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### `patients` table
```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  user_id UUID,
  name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  date_of_birth DATE,
  gender VARCHAR,
  address TEXT,
  medical_conditions TEXT,
  allergies TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Usage Example

```typescript
// In DoctorDashboard
const [appointments, setAppointments] = useState<AppointmentType[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const fetchAppointments = async () => {
    if (!user?.id) return;
    
    try {
      const doctorApts = await getDoctorAppointments(user.id);
      // Transform and set appointments
      setAppointments(transformedApts);
    } finally {
      setIsLoading(false);
    }
  };
  
  fetchAppointments();
}, [user?.id]);

// Update status
const handleUpdateStatus = async (aptId: string, status: 'scheduled' | 'arrived' | 'finished') => {
  const result = await updateDoctorAppointmentStatus(aptId, status);
  if (result.success) {
    Alert.alert('Success', result.message);
  } else {
    Alert.alert('Error', result.message);
  }
};
```

## Testing Checklist

- [ ] Verify Supabase URL and anon key are configured in `/lib/supabase.ts`
- [ ] Check that doctor user ID is being passed correctly
- [ ] Test appointment fetching on DoctorDashboard load
- [ ] Test appointment status updates persist to database
- [ ] Verify patient information is enriched correctly
- [ ] Check loading indicators display properly
- [ ] Test error handling when Supabase is unavailable
- [ ] Verify statistics are calculated correctly
- [ ] Test with real appointments in Supabase

## Configuration

### Supabase Credentials
Located in: `/lib/supabase.ts`
```typescript
const SUPABASE_URL = "https://yffvnvusiazjnwmdylji.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

### Environment Variables (Optional)
For better security, configure in `.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Potential Enhancements

1. **Real-time Subscriptions**: Add Supabase real-time listeners for automatic updates
2. **Caching**: Implement local caching with React Query or SWR
3. **Image URLs**: Store patient image URLs in the database
4. **Batch Operations**: Load multiple patients' data more efficiently
5. **Offline Support**: Add offline-first capabilities with AsyncStorage
6. **Search & Filter**: Add advanced filtering options in AllAppointments
7. **Notifications**: Integrate push notifications for appointment changes

## Troubleshooting

### No appointments showing
- Verify `dentist_id` field matches the logged-in doctor's ID
- Check that appointments have `status != 'cancelled'`
- Ensure date format is YYYY-MM-DD

### Slow loading
- Consider adding pagination
- Implement date range filtering to reduce data
- Add caching layer

### Status updates not persisting
- Check Supabase RLS policies allow UPDATE operations
- Verify user has necessary permissions
- Check browser console for error messages

## Related Commands

```bash
# Run doctor-mobile in development
pnpm --filter doctor-mobile dev

# Build for production
pnpm --filter doctor-mobile build

# Type check
pnpm --filter doctor-mobile type-check
```

## Notes
- The system maintains compatibility with existing mock data fallback
- All Supabase operations include error handling and logging
- Patient images currently use placeholder URLs (can be enhanced with storage URLs)
- The integration respects the existing component structure and styling
