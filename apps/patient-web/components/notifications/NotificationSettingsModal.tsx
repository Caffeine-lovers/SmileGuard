'use client';

import { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  X, 
  Calendar, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Laptop
} from 'lucide-react';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  metadata?: any;
  created_at: string;
}

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUnreadChange?: (unreadCount: number) => void;
}

export default function NotificationSettingsModal({
  isOpen,
  onClose,
  currentUser,
  onUnreadChange,
}: NotificationSettingsModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Fetch notifications for the user
  const fetchNotifications = async () => {
    if (!currentUser?.id) return;
    setLoadingNotifs(true);
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`);
      const data = await res.json();
      const list: NotificationItem[] = data.notifications || [];
      setNotifications(list);
      const unread = list.filter((n) => !n.read).length;
      if (onUnreadChange) onUnreadChange(unread);
    } catch (e) {
      console.warn('Error fetching notifications:', e);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, currentUser?.id]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (!currentUser?.id) return;
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      if (onUnreadChange) onUnreadChange(0);
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  // Mark individual notification as read
  const handleMarkSingleRead = async (notifId: string) => {
    if (!currentUser?.id) return;
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, notificationId: notifId }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      const remainingUnread = notifications.filter((n) => n.id !== notifId && !n.read).length;
      if (onUnreadChange) onUnreadChange(remainingUnread);
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment_rescheduled':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'appointment_confirmed':
        return <Calendar className="w-4 h-4 text-emerald-600" />;
      case 'appointment_cancelled':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'billing_paid':
        return <CreditCard className="w-4 h-4 text-emerald-600" />;
      case 'system_update':
        return <Laptop className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="skeuo-modal max-w-lg w-full bg-white rounded-md border-2 border-slate-300 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-800" />
            <h2 id="notifications-modal-title" className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900">
              Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-bold leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notifications Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recent Alerts ({notifications.length})
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 uppercase cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {loadingNotifs ? (
            <div className="py-8 text-center text-xs text-slate-500">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">All caught up</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                You have no new notifications or schedule alerts.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && handleMarkSingleRead(notif.id)}
                  className={`p-3 rounded-sm border transition cursor-pointer ${
                    notif.read
                      ? 'bg-slate-50 border-slate-200 opacity-80 hover:bg-slate-100'
                      : 'bg-emerald-50/60 border-emerald-300 shadow-xs hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-white rounded-xs border border-slate-200 shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-slate-900 tracking-tight truncate">
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">
                        {new Date(notif.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wider rounded-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
