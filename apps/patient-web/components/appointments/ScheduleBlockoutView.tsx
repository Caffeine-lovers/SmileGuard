'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import { getPatientAppointments } from '@/lib/appointmentService';
import type { Appointment } from '@/lib/database';
import { RefreshCw, Inbox, Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';

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
    if (!currentUser?.id) return;

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="skeuo-badge skeuo-badge-mint">
            <Clock className="w-3 h-3 text-emerald-700" />
            Scheduled
          </span>
        );
      case 'completed':
        return (
          <span className="skeuo-badge skeuo-badge-mint">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="skeuo-badge bg-red-50 text-red-700 border-red-300">
            <XCircle className="w-3 h-3 text-red-600" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="skeuo-badge skeuo-badge-slate">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-slate-50 border-2 border-slate-300 rounded-sm">
        <RefreshCw className="w-5 h-5 text-emerald-700 animate-spin mx-auto mb-2" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading Schedule...</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {appointments.slice(0, 3).map((apt) => (
          <div
            key={apt.id}
            className="skeuo-card p-3 rounded-sm border-2 border-slate-300 flex items-center justify-between"
          >
            <div>
              <p className="font-bold text-xs text-slate-900">{apt.service}</p>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                {formatDate(apt.appointment_date)} @ {formatTime(apt.appointment_time)}
              </p>
            </div>
            {getStatusBadge(apt.status)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="skeuo-panel p-6 border-2 border-slate-300">
      <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-200">
        <div>
          <h2 className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            Confirmed Appointments Ledger
          </h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
            Synchronized clinical bookings
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="skeuo-btn-secondary px-3 py-1.5 text-xs uppercase tracking-wider"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
        </button>
      </div>

      {appointments.length === 0 ? (
        <div className="bg-slate-50 rounded-sm border-2 border-dashed border-slate-300 p-12 text-center">
          <Inbox className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">No appointments scheduled yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Book your first appointment to see it recorded here
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-sm border-2 border-slate-300 overflow-hidden shadow-xs">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-4 bg-slate-100 border-b-2 border-slate-300 p-3 text-xs font-bold uppercase tracking-wider text-slate-600">
            <div>Date</div>
            <div>Time</div>
            <div>Service</div>
            <div>Audit Status</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-200 text-xs">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="grid grid-cols-4 gap-4 p-3 hover:bg-slate-50 transition items-center"
              >
                <div className="text-slate-800 font-mono font-medium">{formatDate(apt.appointment_date)}</div>
                <div className="text-emerald-800 font-mono font-bold">
                  {formatTime(apt.appointment_time)}
                </div>
                <div className="text-slate-900 font-semibold">{apt.service}</div>
                <div>
                  {getStatusBadge(apt.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
