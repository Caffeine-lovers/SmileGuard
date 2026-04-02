'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import { getPatientAppointments } from '@/lib/appointmentService';
import type { Appointment } from '@/lib/database';

interface ScheduleBlockoutViewProps {
  compact?: boolean;
}

export default function ScheduleBlockoutView({ compact = false }: ScheduleBlockoutViewProps) {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, [currentUser?.id]);

  const fetchAppointments = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const appts = await getPatientAppointments(currentUser.id);
      setAppointments(appts);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '—';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-brand-primary text-text-on-avatar';
      case 'completed':
        return 'bg-green-500 text-white';
      case 'cancelled':
        return 'bg-brand-danger text-text-on-danger';
      default:
        return 'bg-text-secondary text-white';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mb-4"></div>
        <p className="text-text-secondary">Loading your appointments...</p>
      </div>
    );
  }

  // Compact view for sidebar
  if (compact) {
    return (
      <div className="space-y-2">
        {appointments.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-text-secondary text-xs">No appointments</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {appointments.slice(0, 5).map((apt) => (
              <div
                key={apt.id}
                className="bg-bg-notes rounded-card p-2 border border-border-card text-xs"
              >
                <p className="font-semibold text-text-primary truncate">{apt.service}</p>
                <p className="text-text-secondary">{formatDate(apt.appointment_date)}</p>
                <p className="text-brand-danger font-bold">{formatTime(apt.appointment_time)}</p>
              </div>
            ))}
            {appointments.length > 5 && (
              <p className="text-text-secondary text-xs text-center py-2">
                +{appointments.length - 5} more
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full view for main content
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Your Scheduled Appointments</h2>
          <p className="text-text-secondary text-sm mt-1">
            {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar rounded-pill font-medium transition"
        >
          {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
        </button>
      </div>

      {appointments.length === 0 ? (
        <div className="bg-bg-notes rounded-card border border-border-card p-12 text-center">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-text-primary font-semibold">No appointments scheduled yet</p>
          <p className="text-text-secondary text-sm mt-2">
            Book your first appointment to see it appear here
          </p>
        </div>
      ) : (
        <div className="bg-bg-surface rounded-card border border-border-card overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-4 bg-bg-notes border-b border-border-card p-4">
            <div className="font-bold text-text-primary text-sm">Date</div>
            <div className="font-bold text-text-primary text-sm">Time</div>
            <div className="font-bold text-text-primary text-sm">Service</div>
            <div className="font-bold text-text-primary text-sm">Status</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border-card">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="grid grid-cols-4 gap-4 p-4 hover:bg-bg-notes transition"
              >
                <div className="text-text-primary font-medium">{formatDate(apt.appointment_date)}</div>
                <div className="text-text-primary font-bold text-brand-danger">
                  {formatTime(apt.appointment_time)}
                </div>
                <div className="text-text-primary">{apt.service}</div>
                <div>
                  <span
                    className={`inline-block text-xs font-bold px-3 py-1 rounded-pill ${getStatusBadgeColor(
                      apt.status
                    )}`}
                  >
                    {apt.status === 'scheduled'
                      ? '📌 Scheduled'
                      : apt.status === 'completed'
                      ? '✓ Completed'
                      : apt.status === 'cancelled'
                      ? '✕ Cancelled'
                      : apt.status?.charAt(0).toUpperCase() + apt.status?.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
