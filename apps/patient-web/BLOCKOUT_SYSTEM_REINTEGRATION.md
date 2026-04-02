# SmileGuard Patient Web — Blockout System Re-Implementation

## Date: March 31, 2026

### Summary

The appointment blockout system has been re-added to the patient web application. This system prevents double-booking by tracking which appointment slots are already taken and displaying them as unavailable when patients attempt to book.

---

## Components Added/Updated

### 1. New Component: `ScheduleBlockoutView.tsx`
**Location:** `apps/patient-web/components/appointments/ScheduleBlockoutView.tsx`

A reusable component that displays the patient's scheduled appointments with filtering by status.

**Features:**
- Shows all scheduled appointments in a table format
- Displays date, time, service type, and status
- Supports compact and full view modes
- Refresh button to sync latest appointments
- Color-coded status badges:
  - 📌 Scheduled (brand-primary)
  - ✓ Completed (green)
  - ✕ Cancelled (brand-danger)
- Uses design system tokens throughout

**Props:**
- `compact?: boolean` — If true, shows sidebar-friendly condensed view (5 items max)

---

### 2. Updated: `AppointmentsPage.tsx`
**Location:** `apps/patient-web/app/(patient)/appointments/page.tsx`

Enhanced to show:
- Left sidebar: Quick view of 5 most recent appointments (compact mode)
- Right column: Book new appointment form
- Bottom section: Full appointment schedule with all details

**Layout:**
```
┌─────────────────────────────────────┐
│  📅 Manage Appointments             │
├──────────────────┬──────────────────┤
│  Your Schedule   │  Book New        │
│  (Compact)       │  Appointment     │
│                  │  (Full Form)     │
├────────────────────────────────────┤
│  Full Schedule View (Table)         │
└────────────────────────────────────┘
```

---

### 3. Updated: `BookAppointment.tsx` (No changes needed)
The component already had blockout logic implemented:
- `getAllBlockedSlots()` — Fetches booked appointments
- `isSlotDisabled()` — Checks if a time slot is available
- `isSlotTaken()` — Utility function to detect conflicts
- Gray out and disable unavailable time slots

---

## How the Blockout System Works

### Booking Flow
1. Patient selects a service, date, and time
2. System fetches all blocked slots (booked appointments) for that date
3. Unavailable time slots appear grayed out and disabled
4. Patient can only select available slots
5. Upon booking, that slot becomes blocked for other patients

### Data Structure
```typescript
interface Appointment {
  id: string;
  patient_id: string;
  dentist_id?: string;
  service: string;
  appointment_date: string;  // DATE format
  appointment_time: string;  // HH:MM format
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at: string;
}
```

### Key Functions (from `lib/appointmentService.ts`)
```typescript
// Get all booked appointments for blocking
getAllBlockedSlots(): Promise<BlockedSlot[]>

// Check if a specific slot is taken
isSlotTaken(slots: BlockedSlot[], date: string, time: string): boolean

// Book a new appointment (blocks the slot)
bookSlot(patientId, dentistId, service, date, time): Promise<{ success: boolean }>
```

---

## Design System Integration

All blockout UI components use the new design tokens:

| Element | Token |
|---------|-------|
| Background | `bg-bg-screen` |
| Cards | `bg-bg-surface` with `border-border-card` |
| Headings | `text-brand-cyan` |
| Primary Text | `text-text-primary` |
| Secondary Text | `text-text-secondary` |
| Status Badges | `bg-brand-primary`, `bg-green-500`, `bg-brand-danger` |
| Borders | `border-card` (default), `border-active` (selected) |
| Buttons | `bg-brand-primary` with pill shape (`rounded-pill`) |

---

## Pages Using Blockout System

1. **Appointments Page** (`/appointments`)
   - Full schedule view with all appointments
   - Book appointment form with blocked slots
   - Compact sidebar showing next 5 appointments

2. **Dashboard** (`/dashboard`)
   - Quick appointment list showing next 5 bookings
   - Uses existing AppointmentCard component

---

## Testing the Blockout System

### To verify blockout is working:

1. **Log in** to patient portal
2. Navigate to **Appointments** page
3. **Book an appointment** (e.g., March 31, 2026 at 10:00 AM)
4. Return to booking form
5. Select the **same date and time** again
6. ✅ The time slot should appear **gray and disabled**
7. Try to select a **different time** on the same date
8. ✅ Other times should be **available**

### Check the schedule view:
1. Go to **Appointments** page
2. Scroll down to see **Full Schedule View**
3. ✅ Your booked appointment should appear in the table
4. ✅ Status should show "📌 Scheduled"

---

## Database Schema

The blockout system relies on the appointments table having these columns:

```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL,
  dentist_id UUID,
  service TEXT NOT NULL,
  appointment_date DATE NOT NULL,        -- Separate date column
  appointment_time TEXT NOT NULL,        -- HH:MM format
  status TEXT DEFAULT 'scheduled',       -- scheduled, completed, cancelled, no-show
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Important:** Date and time are stored separately (not as a single TIMESTAMP). This was the key fix from the blockout system issue.

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/patient-web/components/appointments/ScheduleBlockoutView.tsx` | **NEW** - Schedule display component |
| `apps/patient-web/app/(patient)/appointments/page.tsx` | Updated layout with schedule view |
| `apps/patient-web/app/(patient)/analysis/page.tsx` | Updated colors to use design tokens |
| `apps/patient-web/components/appointments/BookAppointment.tsx` | Already had blockout logic (no changes) |

---

## Status

✅ **Blockout display component created**  
✅ **Appointments page redesigned with schedule view**  
✅ **Design system tokens applied throughout**  
✅ **Compact and full view modes implemented**  
✅ **Ready for testing**

---

## Next Steps

1. **Test appointment booking** to ensure blockout is working
2. **Verify time slot disable** when attempting to book same slot twice
3. **Check schedule view** displays correctly
4. **Test different screen sizes** (mobile, tablet, desktop)
5. **Deploy** to staging environment for QA
