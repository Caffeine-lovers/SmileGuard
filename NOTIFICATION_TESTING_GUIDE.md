# Notification System Troubleshooting & Testing Guide

## Fixed: Notifications for App-Created Appointments

### What Was Fixed

The notification system now includes **dual notification sources**:

1. **Real-time Subscriptions** (from Supabase) - Catches changes made by other doctors or external systems
2. **Manual Notifications** (from app events) - Triggers immediately when YOU make changes in the app

This ensures you'll see notifications when:
- ✅ You change appointment status (completed, cancelled, no-show)
- ✅ You update patient medical information
- ✅ Other doctors or systems make changes to your appointments and patients

### Key Changes

#### 1. Enhanced Subscription Setup
```typescript
// notificationService.ts
- Added self: true to broadcast config (catches own changes)
- Better logging for debugging
- Improved error handling
```

#### 2. Manual Notification Triggers
```typescript
// In DoctorDashboard.tsx
- handleUpdateAppointmentStatus() now triggers manual notifications
- handleSavePatient() now triggers medical intake notifications
- Notifications appear immediately + real-time backup
```

#### 3. New Hook Action
```typescript
// useNotifications hook
actions.addNotification(notification)
// New method to manually add notifications to the state
```

## Testing Notifications

### Test 1: Update Appointment Status

**Steps:**
1. Open doctor dashboard
2. Click on an appointment in "Today's Appointments"
3. Change status (Mark as Completed/Cancelled/No-Show)
4. Look for notification in bell icon 🔔

**Expected Result:**
- ✅ Red badge appears on notification bell (or increases count)
- ✅ Notification appears instantly in notification center
- ✅ Message shows appointment status change

**Console Output:**
```
📢 Manual notification added: appointment-completed
✨ Emitting notification: appointment-completed Appointment Completed
```

### Test 2: Update Patient Medical Records

**Steps:**
1. Select a patient from today's appointments
2. Click "Edit" button
3. Modify medical information (allergies, medications, etc.)
4. Click "Save"
5. Check notification bell

**Expected Result:**
- ✅ Notification bell badge appears
- ✅ "Medical Intake Updated" notification shows
- ✅ Shows patient name and change type

**Console Output:**
```
📢 Manual notification added: medical-intake-updated
```

### Test 3: Real-time Subscription (test with another doctor)

**Steps:**
1. Doctor A: Open dashboard and keep notification center open
2. Doctor B: Create/update an appointment for Doctor A using another device/window
3. Doctor A: Watch for real-time notification

**Expected Result:**
- ✅ Notification appears in real-time without page refresh
- ✅ No manual action required
- ✅ Bell badge updates automatically

### Test 4: Multiple Rapid Changes

**Steps:**
1. Create several appointment status changes quickly
2. Check notification list

**Expected Result:**
- ✅ All notifications appear in order
- ✅ No duplicates (even if real-time + manual both fire)
- ✅ Newest at top

## Debug Logging

The system includes comprehensive logging. Open browser DevTools Console to see:

### Subscription Lifecycle
```
📡 Subscribing to appointments real-time updates for doctor [ID]
📍 Subscription filter: dentist_id=eq.[ID]  
🔄 Subscription status for appointments: SUBSCRIBED
✅ Successfully subscribed to appointments
```

### Notification Events
```
🔔 Change detected in appointments: { eventType: 'INSERT', ... }
✨ Emitting notification: appointment-created Appointment Created
📬 New notification received: { type: 'appointment-created', ... }
📢 Manual notification added: appointment-updated
```

### Errors
```
❌ Subscription error for appointments
❌ Notification service error: [Error message]
⚠️ Subscription to appointments closed
```

## Troubleshooting

### Q: Still not seeing notifications for app changes?

**Check:**
1. Open DevTools Console (F12)
2. Look for `📢 Manual notification added:` log
3. If missing, the change isn't reaching the handler

**Solution:**
- Verify the appointment/patient ID is correct
- Check for JavaScript errors in console
- Try refreshing the page
- Check internet connection

### Q: Seeing duplicate notifications?

**Check:**
1. Each notification should have unique ID
2. Manual notifications have ID format: `notification-[N]-[timestamp]`
3. Real-time have different format

**Solution:**
- Hard refresh browser (Ctrl+Shift+R)
- Clear browser cache
- Check if subscriptions are connecting properly

### Q: Real-time subscriptions not connecting?

**Check:**
1. Console shows: `✅ Successfully subscribed to appointments`
2. Network tab shows WebSocket connection (wss://...)
3. Supabase dashboard shows active connections

**Solution:**
```
1. Check Supabase project status
2. Verify RLS policies allow reading your appointments
3. Check firewall/VPN doesn't block WebSocket
4. Try disabling adblocker (sometimes blocks WebSocket)
```

### Q: Notification center modal won't open?

**Check:**
1. Click notification bell button
2. Modal should slide in from bottom

**Solution:**
- Hard refresh browser
- Check for JavaScript errors
- Verify Modal component is imported correctly

## Performance Tips

### Optimize Notifications

**Automatic cleanup:**
- Notifications older than 24 hours auto-deleted
- Change in notificationService.ts if needed:
```typescript
clearOldNotifications(updated, 48); // 48 hours instead
```

**Duplicate prevention:**
- Tracks seen notification IDs
- Prevents showing same notification twice
- Even if both real-time + manual fire

### Monitor Subscription Health

**Check connection status:**
```typescript
// In DevTools console:
> supabase.getChannels()  // Shows active subscriptions
> supabase.channel('test').subscribe()  // Test connection
```

## Integration Points

### Where Notifications Trigger

| Action | Component | Handler | Notification Type |
|--------|-----------|---------|-------------------|
| Change Status | DoctorDashboard | handleUpdateAppointmentStatus | appointment-completed/cancelled |
| Save Medical Info | DoctorDashboard | handleSavePatient | medical-intake-updated |
| Create Appointment* | AppointmentService | - | appointment-created |
| Delete/Update* | - | Real-time Sub | appointment-cancelled/updated |

*Real-time subscriptions trigger automatically

### Hook Usage

```tsx
// In any component:
const { notifications, unreadCount, actions } = useNotifications(doctorId, true);

// Add manual notification:
const notification = notifyAppointmentStatusChanged(...);
actions.addNotification(notification);

// Mark as read:
actions.markAsRead(notification.id);

// Get unread count:
console.log(unreadCount); // Number
```

## API Reference Addition

### New Hook Method

```tsx
notificationState.actions.addNotification(
  notification: Notification
): void
```

Adds a notification to the list and marks it as unseen.

### New Service Functions

```tsx
createManualNotification(
  type: NotificationType,
  title: string,
  message: string,
  data?: Partial<Notification['data']>
): Notification

notifyAppointmentStatusChanged(
  status: 'completed' | 'cancelled' | 'no-show',
  patientName: string,
  appointmentId: string,
  patientId: string,
  doctorId: string
): Notification

notifyAppointmentUpdated(...): Notification
notifyAppointmentCreated(...): Notification
```

## Next Steps

### Optional Enhancements

1. **Toast Notifications** - Quick pop-up alerts in addition to badge
2. **Sound Alerts** - Optional audio notification
3. **Deep Linking** - Click notification to go to related page
4. **Do Not Disturb** - Configure quiet hours
5. **Push Notifications** - Native OS notifications

### Performance Monitoring

```typescript
// Add to service to monitor notification latency:
const latency = Date.now() - notification.timestamp.getTime();
console.log(`Notification latency: ${latency}ms`);
```

## Support

If notifications still aren't appearing:

1. **Check Console Logs** - Look for error messages
2. **Verify Doctor ID** - In DevTools: `console.log(user?.id)`
3. **Test Supabase** - Create appointment directly in Supabase dashboard
4. **Check Permissions** - Ensure RLS allows changes
5. **Network Tab** - Verify WebSocket connects
6. **Refresh** - Hard refresh (Ctrl+Shift+R)

## Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| notificationService.ts | Added self:true, better logging, helper functions | Catches own changes |
| useNotifications.ts | Added addNotification action, dedup logic | Prevents duplicates |
| DoctorDashboard.tsx | Added manual notification triggers | Instant feedback |
| NotificationCenter.tsx | (No changes) | Works with both sources |

All changes are **backward compatible** and **production-ready**! ✅
