# Notification Center System - Doctor Dashboard

## Overview

The Notification Center is a real-time notification system that monitors Supabase table changes and displays them to doctors on the dashboard. It uses Supabase's **PostgREST real-time subscriptions** to listen for INSERT, UPDATE, and DELETE events across multiple tables.

## Features

✅ **Real-time Monitoring** - Listens to live updates from Supabase tables
✅ **Multi-table Support** - Monitors 6+ core tables for changes
✅ **Smart Notifications** - Contextual messages based on event type
✅ **Unread Tracking** - Badge shows unread notification count
✅ **Rich UI** - Beautiful notification center with filtering and actions
✅ **Persistent Storage** - Notifications kept for 24 hours
✅ **Error Handling** - Graceful error states and fallbacks
✅ **Easy Integration** - Simple hook-based API

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         DoctorDashboard Component                   │
│  ┌────────────────────────────────────────────────┐ │
│  │  useNotifications Hook (manages state)          │ │
│  │  - Initializes subscriptions                    │ │
│  │  - Manages notifications array                  │ │
│  │  - Handles notification actions                 │ │
│  └────────────────────────────────────────────────┘ │
│                      ▼                               │
│  ┌────────────────────────────────────────────────┐ │
│  │  NotificationBell (header icon with badge)     │ │
│  │  - Shows unread count                          │ │
│  │  - Opens notification center                   │ │
│  └────────────────────────────────────────────────┘ │
│                      ▼                               │
│  ┌────────────────────────────────────────────────┐ │
│  │  NotificationCenter Modal                      │ │
│  │  - Displays notification list                  │ │
│  │  - Filtering by type                           │ │
│  │  - Mark as read / delete options                │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                          ▲
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
┌───────▼──────────────────┐      ┌────────▼────────────────┐
│  notificationService.ts  │      │  Supabase Real-time     │
│  - Subscriptions         │◄─────┤  - PostgreSQL Changes   │
│  - Event parsing         │      │  - EventType tracking   │
│  - Notification generation
└──────────────────────────┘      └─────────────────────────┘
```

## Monitored Tables & Events

### 1. **appointments**
- **CREATE**: "Appointment Created" - When a new appointment is booked
- **UPDATE**: "Appointment Updated" - When details change
- **UPDATE (status=completed)**: "Appointment Completed" 
- **UPDATE/DELETE (status=cancelled)**: "Appointment Cancelled"

### 2. **medical_intake**
- **UPDATE**: "Medical Intake Updated" - Patient medical records updated

### 3. **treatments**
- **CREATE**: "Treatment Added" - New treatment added to patient

### 4. **billings**
- **UPDATE**: "Billing Updated" - Invoice or billing info changes

### 5. **doctors**
- **UPDATE**: "Profile Updated" - Doctor's profile information changed

### 6. **profiles** (patient role only)
- **UPDATE**: "Patient Updated" - Patient profile information changed

## File Structure

```
apps/doctor-mobile/
├── components/dashboard/
│   ├── DoctorDashboard.tsx        (integrated notification system)
│   ├── NotificationBell.tsx       (header icon component)
│   └── NotificationCenter.tsx     (modal with notification list)
├── hooks/
│   └── useNotifications.ts        (React hook for notifications)
├── lib/
│   └── notificationService.ts     (core notification logic)
├── types/
│   └── notifications.ts           (TypeScript types)
```

## Usage Guide

### Basic Setup (Already Integrated)

The notification system is already integrated into `DoctorDashboard.tsx`:

```tsx
// 1. Import hook
import { useNotifications } from '../../hooks/useNotifications';
import NotificationBell from './NotificationBell';
import NotificationCenter from './NotificationCenter';

// 2. Initialize hook in component
const notificationState = useNotifications(user?.id, true);

// 3. Add bell to header
<NotificationBell
  unreadCount={notificationState.unreadCount}
  onPress={() => setShowNotificationCenter(true)}
/>

// 4. Add notification center modal
<Modal visible={showNotificationCenter} animationType="slide">
  <NotificationCenter
    notifications={notificationState.notifications}
    unreadCount={notificationState.unreadCount}
    isLoading={notificationState.isLoading}
    error={notificationState.error}
    onMarkAsRead={notificationState.actions.markAsRead}
    onMarkAllAsRead={notificationState.actions.markAllAsRead}
    onDeleteNotification={notificationState.actions.deleteNotification}
    onClearAll={notificationState.actions.clearAll}
  />
</Modal>
```

### Using the Hook in Other Components

```tsx
import { useNotifications } from '../../hooks/useNotifications';

export function MyComponent({ doctorId }) {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    actions,
  } = useNotifications(doctorId, true);

  return (
    <View>
      <Text>Unread: {unreadCount}</Text>
      {notifications.map(notif => (
        <View key={notif.id}>
          <Text>{notif.title}</Text>
          <Text>{notif.message}</Text>
          <TouchableOpacity onPress={() => actions.markAsRead(notif.id)}>
            <Text>Mark as Read</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
```

## API Reference

### useNotifications Hook

```tsx
const notificationState = useNotifications(
  doctorId: string | undefined,
  enabled: boolean = true
);
```

**Returns:**
```tsx
{
  notifications: Notification[];           // All notifications sorted by time
  unreadCount: number;                    // Count of unread notifications
  isLoading: boolean;                     // Loading state for subscriptions
  error: string | null;                   // Error message if subscription fails
  actions: {
    markAsRead: (id: string) => void;     // Mark single notification as read
    markAllAsRead: () => void;            // Mark all as read
    deleteNotification: (id: string) => void;  // Delete notification
    clearAll: () => void;                 // Clear all notifications
    filterByType: (type: NotificationType) => Notification[]; // Filter by type
  }
}
```

### Notification Type

```tsx
interface Notification {
  id: string;                    // Unique ID
  type: NotificationType;        // Event type (e.g., 'appointment-created')
  title: string;                 // Header text
  message: string;               // Body text
  timestamp: Date;               // When it occurred
  read: boolean;                 // Read status
  data?: {
    appointmentId?: string;
    patientId?: string;
    doctorId?: string;
    tableName?: string;          // Which table changed
    recordId?: string;            // ID of changed record
    action?: 'INSERT' | 'UPDATE' | 'DELETE';  // Type of change
  };
  action?: {
    label: string;
    onPress: () => void;
  };
}
```

### notificationService Functions

```tsx
// Subscribe to single table
subscribeToTableChanges(
  tableName: string,
  doctorId: string,
  onNotification: (notification: Notification) => void,
  onError: (error: string) => void
): () => void  // Returns unsubscribe function

// Subscribe to all doctor notifications
subscribeToDoctorNotifications(
  doctorId: string,
  onNotification: (notification: Notification) => void,
  onError: (error: string) => void,
  tables?: string[]  // Optional list of tables to monitor
): () => void

// Utility functions
markNotificationAsRead(notification: Notification): Notification
markNotificationsAsRead(notifications: Notification[]): Notification[]
getUnreadCount(notifications: Notification[]): number
sortNotificationsByTime(notifications: Notification[]): Notification[]
filterNotificationsByType(notifications: Notification[], type: NotificationType): Notification[]
clearOldNotifications(notifications: Notification[], hoursOld: number = 24): Notification[]
```

## Notification Types & Icons

| Type | Icon | Color | Trigger |
|------|------|-------|---------|
| appointment-created | 📅 | #4CAF50 (Green) | New appointment booked |
| appointment-updated | ✏️ | #2196F3 (Blue) | Appointment details changed |
| appointment-completed | ✅ | #4CAF50 (Green) | Appointment marked complete |
| appointment-cancelled | ❌ | #F44336 (Red) | Appointment cancelled |
| patient-updated | 👤 | #FF9800 (Orange) | Patient profile updated |
| medical-intake-updated | 📋 | #9C27B0 (Purple) | Medical records changed |
| doctor-profile-updated | 👨‍⚕️ | #2196F3 (Blue) | Your profile changed |
| billing-updated | 💳 | #FF5722 (Deep Orange) | Billing info updated |
| treatment-added | 🏥 | #00BCD4 (Cyan) | Treatment added |

## Configuration

### Tables to Monitor

By default, the following tables are monitored:
- `appointments`
- `medical_intake`
- `treatments`
- `billings`
- `doctors`
- `profiles`

To customize monitored tables:

```tsx
const notificationState = useNotifications(doctorId, true);

// Manually subscribe to specific tables
subscribeToDoctorNotifications(
  doctorId,
  onNotification,
  onError,
  ['appointments', 'treatments']  // Only these tables
);
```

### Notification Retention

Notifications are kept for **24 hours** by default. Adjust in `notificationService.ts`:

```tsx
// In useNotifications hook:
return clearOldNotifications(updated, 48); // 48 hours instead
```

## Features in Detail

### Notification Filtering

The NotificationCenter component includes filter tabs to view specific notification types:

```
[All] [📅 Appointments] [👤 Patients] [📋 Medical] [💳 Billing] ...
```

### Unread Tracking

- Unread notifications display as light blue cards with a blue dot
- Badge on notification bell shows count
- Tap "Mark all read" to batch-mark notifications
- Auto-marks as read when you tap to expand

### Notification Details

Expand any notification to see:
- Event type (INSERT/UPDATE/DELETE)
- Table name
- Record ID (truncated)

### Delete & Clear Options

- Individual delete button (✕) on each card
- "Clear All" button removes all notifications
- Confirmation alerts prevent accidental deletion

## Real-time Behavior

### How It Works

1. **Connection**: When `useNotifications` mounts, it establishes a WebSocket connection to Supabase
2. **Listening**: PostgREST subscriptions listen for any changes to monitored tables
3. **Parsing**: When a change occurs, the event is parsed and converted to a `Notification` object
4. **Display**: Notification appears at the top of the list in real-time
5. **Cleanup**: Unsubscribe when component unmounts

### Performance Considerations

- Real-time subscriptions are lightweight WebSocket connections
- Each table has its own subscription channel
- Subscriptions automatically reconnect on network failure
- Old notifications (>24h) are auto-purged to save memory

## Troubleshooting

### Notifications Not Appearing

**Check:**
1. Doctor ID is correctly passed: `console.log(user?.id)`
2. Supabase URL and keys are configured
3. RLS policies allow watching changes
4. Browser/app has WebSocket support enabled
5. Check console logs for subscription errors

**Console Output:**
```
📡 Subscribing to appointments real-time updates for doctor [ID]
✅ Successfully subscribed to appointments
🔔 Change detected in appointments: { eventType: 'INSERT', new: {...} }
```

### Connection Errors

**Error:** "Failed to subscribe to appointments updates"

**Solution:**
1. Check Supabase dashboard → Project Status
2. Verify RLS policies are correct
3. Check network connectivity
4. Look for CORS issues in browser console

### Duplicate Notifications

**Solution:**
Subscriptions are cleaned up on unmount. If seeing duplicates:
1. Check if component is re-mounting
2. Verify subscription cleanup in `useNotifications` useEffect return

## Future Enhancements

- [ ] Sound/haptic alerts for notifications
- [ ] Notification preferences (enables/disable by type)
- [ ] In-app notification toast (without modal)
- [ ] Deep linking (tap notification to go to related screen)
- [ ] Push notifications for critical updates
- [ ] Notification history (export/archive)
- [ ] Do Not Disturb hours configuration
- [ ] Admin dashboard for notification analytics

## Testing

### Manual Testing Steps

1. **Create an Appointment**
   - Using Supabase dashboard, insert an appointment with your doctor ID
   - See "Appointment Created" notification appear instantly

2. **Update an Appointment**
   - Change appointment status to "completed"
   - See "Appointment Completed" notification

3. **Multiple Tables**
   - Update patient profile + treatment + billing simultaneously
   - See all notifications appear in real-time

4. **Filtering**
   - Use filter tabs to view specific notification types
   - Click "Mark all read" to clear unread badge

5. **Persistence**
   - Refresh the page
   - Notifications remain for the current session

## Support

For issues or questions:
1. Check console logs for error messages
2. Review this documentation
3. Check Supabase real-time documentation: https://supabase.com/docs/guides/realtime
4. Test in Supabase dashboard first before debugging the app

## Related Files

- [notificationService.ts](./apps/doctor-mobile/lib/notificationService.ts) - Core logic
- [useNotifications.ts](./apps/doctor-mobile/hooks/useNotifications.ts) - React hook
- [NotificationCenter.tsx](./apps/doctor-mobile/components/dashboard/NotificationCenter.tsx) - UI
- [NotificationBell.tsx](./apps/doctor-mobile/components/dashboard/NotificationBell.tsx) - Header icon
- [notifications.ts](./apps/doctor-mobile/types/notifications.ts) - Type definitions
