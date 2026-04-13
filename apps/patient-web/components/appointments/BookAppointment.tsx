'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import { bookSlot, getAllBlockedSlots, isSlotTaken, getPatientAppointments } from '@/lib/appointmentService';
import type { Appointment } from '@/lib/database';

const SERVICES = [
  { id: 'cleaning',   name: 'Cleaning',             duration: 30, price: 1500,  icon: '' },
  { id: 'whitening',  name: 'Whitening',             duration: 60, price: 5000,  icon: '' },
  { id: 'fillings',   name: 'Fillings',              duration: 45, price: 2000,  icon: '🦷' },
  { id: 'root-canal', name: 'Root Canal',            duration: 90, price: 8000,  icon: '' },
  { id: 'extraction', name: 'Extraction',            duration: 30, price: 1500,  icon: '' },
  { id: 'braces',     name: 'Braces Consultation',   duration: 60, price: 35000, icon: '' },
  { id: 'implants',   name: 'Implants Consultation', duration: 60, price: 45000, icon: '' },
  { id: 'xray',       name: 'X-Ray',                 duration: 15, price: 500,   icon: '' },
  { id: 'checkup',    name: 'Check-up',              duration: 20, price: 300,   icon: '' },
];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
];

interface BookAppointmentProps {
  onSuccess?: (appointment: Appointment) => void;
  onCancel?: () => void;
}

// ─── Step badge ───────────────────────────────────────────────────────────────
function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-2 transition-colors ${
        done ? 'bg-brand-primary text-white' : 'bg-border-card text-text-secondary'
      }`}
    >
      {done ? '✓' : n}
    </span>
  );
}

// ─── Locked overlay ───────────────────────────────────────────────────────────
function LockedOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 rounded-2xl bg-white/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
      <p className="text-xs font-semibold text-text-secondary">{message}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BookAppointment({ onSuccess, onCancel }: BookAppointmentProps) {
  const { currentUser } = useAuth();
  const [selectedService, setSelectedService]         = useState<(typeof SERVICES)[0] | null>(null);
  const [selectedDate, setSelectedDate]               = useState<string>('');
  const [selectedTime, setSelectedTime]               = useState<string>('');
  const [notes, setNotes]                             = useState<string>('');
  const [isBooking, setIsBooking]                     = useState(false);
  const [blockedSlots, setBlockedSlots]               = useState<any[]>([]);
  const [loadingBlockedSlots, setLoadingBlockedSlots] = useState(true);
  const [fullyBookedDates, setFullyBookedDates]       = useState<Set<string>>(new Set());
  const [userAppointments, setUserAppointments]       = useState<Appointment[]>([]);
  const [loadingUserData, setLoadingUserData]         = useState(true);
  const [currentMonthView, setCurrentMonthView]       = useState(() => new Date());

  const step1Complete = selectedService !== null;

  const generateCalendarDays = () => {
    const year = currentMonthView.getFullYear();
    const month = currentMonthView.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));
  };
  const step2Complete = step1Complete && selectedDate !== '';
  const step3Complete = step2Complete && selectedTime !== '';

  useEffect(() => { fetchAllBlockedSlots(); }, []);

  useEffect(() => {
    if (!currentUser) return;
    async function fetchUserAppointments() {
      setLoadingUserData(true);
      try {
        if (!currentUser) return;
        const appointments = await getPatientAppointments(currentUser.id);
        const scheduledAppointments = appointments.filter(apt => apt.status === 'scheduled' || apt.status === 'confirmed' || apt.status === 'Scheduled');
        setUserAppointments(scheduledAppointments);
      } catch (err) {
        console.error('Error fetching user appointments:', err);
      } finally {
        setLoadingUserData(false);
      }
    }
    fetchUserAppointments();
  }, [currentUser?.id]);

  const fetchAllBlockedSlots = async () => {
    setLoadingBlockedSlots(true);
    try {
      const slots = await getAllBlockedSlots();
      setBlockedSlots(slots);
      const dateCounts: Record<string, number> = {};
      for (const slot of slots) {
        dateCounts[slot.date] = (dateCounts[slot.date] ?? 0) + 1;
      }
      const full = new Set(
        Object.entries(dateCounts)
          .filter(([, count]) => count >= TIME_SLOTS.length)
          .map(([date]) => date)
      );
      setFullyBookedDates(full);
    } catch (error) {
      console.error('Error fetching blocked slots:', error);
      setBlockedSlots([]);
    } finally {
      setLoadingBlockedSlots(false);
    }
  };

  const isSlotDisabled = (date: string, time: string) => isSlotTaken(blockedSlots, date, time);

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !currentUser) {
      alert('Please select service, date, and time');
      return;
    }
    setIsBooking(true);
    try {
      const result = await bookSlot(currentUser.id, '', selectedService.name, selectedDate, selectedTime);
      if (result.success) {
        alert('Appointment booked successfully!');
        if (onSuccess) {
          onSuccess({
            id: '1',
            patient_id: currentUser.id,
            dentist_id: null,
            service: selectedService.name,
            appointment_date: selectedDate,
            appointment_time: selectedTime,
            notes: notes || '',
            status: 'scheduled',
            created_at: new Date().toISOString(),
          });
        }
        setSelectedService(null);
        setSelectedDate('');
        setSelectedTime('');
        setNotes('');
      } else {
        alert(`Booking failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      alert('Failed to book appointment');
    } finally {
      setIsBooking(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loadingBlockedSlots) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-cyan" />
      </div>
    );
  }

  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T00:00').toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  // ─── BENTO LAYOUT ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-screen p-4 md:p-6">

      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-brand-cyan tracking-tight">Book an Appointment</h1>
        <p className="text-text-secondary text-sm mt-1">Complete each card in order to confirm your visit.</p>
      </div>

      {/* Bento grid — 12-column base */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

        {/* ━━━━ CELL A: Service picker (col 1–8, row 1) ━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="md:col-span-8 bg-bg-surface rounded-2xl border border-border-card shadow-sm p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-4">
            <StepBadge n={1} done={step1Complete} />
            Choose a Service
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SERVICES.map((service) => {
              const active = selectedService?.id === service.id;
              return (
                <button
                  type="button"
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                    active
                      ? 'border-brand-primary bg-brand-primary/5 shadow-md'
                      : 'border-border-card hover:border-brand-primary/40 hover:shadow-sm'
                  }`}
                >
                  <span className="text-2xl block mb-2">{service.icon}</span>
                  <p className={`font-semibold text-sm leading-tight ${active ? 'text-brand-primary' : 'text-text-primary'}`}>
                    {service.name}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">{service.duration} min</p>
                  <p className={`text-xs font-bold mt-2 ${active ? 'text-brand-primary' : 'text-text-secondary'}`}>
                    ₱{service.price.toLocaleString()}
                  </p>
                  {active && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand-primary flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ━━━━ CELL B: Booking summary (col 9–12, rows 1–2) ━━━━━━━━━━━━━━━━━ */}
        <div className="md:col-span-4 flex flex-col gap-4">

          {/* Live snapshot card */}
          <div className="bg-brand-primary rounded-2xl p-5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-4">Your Booking</p>
            <div className="space-y-3">
              {[
                { icon: selectedService?.icon ?? '—', label: 'Service', value: selectedService?.name ?? null },
                { icon: '', label: 'Date',    value: formattedDate },
                { icon: '', label: 'Time',    value: selectedTime || null },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{icon}</span>
                  <div>
                    <p className="text-[10px] text-white/60 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold">
                      {value ?? <span className="text-white/40 italic">Not selected</span>}
                    </p>
                  </div>
                </div>
              ))}
              {selectedService && (
                <div className="border-t border-white/20 pt-3 flex justify-between items-center">
                  <p className="text-xs text-white/60">Estimated fee</p>
                  <p className="text-lg font-bold">₱{selectedService.price.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Prior bookings pill */}
          {!loadingUserData && userAppointments.length > 0 && (
            <div className="bg-bg-surface rounded-2xl border border-border-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-sm flex-shrink-0">
                {userAppointments.length}
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">Existing bookings</p>
                <p className="text-xs text-text-secondary">Already on your schedule</p>
              </div>
            </div>
          )}
        </div>

       {/* ━━━━ CELL C: Date picker (col 1–5, row 2) ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="md:col-span-5 relative bg-bg-surface rounded-2xl border border-border-card shadow-sm p-6 flex flex-col">
          {!step1Complete && <LockedOverlay message="Pick a service first" />}
          
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center">
              <StepBadge n={2} done={step2Complete} />
              Select Date
            </p>
            <div className="grid grid-cols-[1fr_2fr_1fr] bg-bg-notes rounded-lg overflow-hidden border border-border-card w-[200px]">
              <button 
                type="button"
                onClick={handlePrevMonth} 
                disabled={!step1Complete}
                className="py-1.5 text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 transition-colors flex items-center justify-center text-lg"
              >
                &larr;
              </button>
              <div className="py-1.5 text-[11px] font-bold text-text-primary flex items-center justify-center border-x border-border-card uppercase tracking-wider text-center">
                {currentMonthView.toLocaleString('default', { month: 'short', year: 'numeric' })}
              </div>
              <button 
                type="button"
                onClick={handleNextMonth} 
                disabled={!step1Complete}
                className="py-1.5 text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 transition-colors flex items-center justify-center text-lg"
              >
                &rarr;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
              <div key={`${d}-${index}`} className="text-[10px] font-bold text-center text-text-secondary/60">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 flex-1">
            {generateCalendarDays().map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className="aspect-square"></div>;
              
              const yyyy = date.getFullYear();
              const mm = String(date.getMonth() + 1).padStart(2, '0');
              const dd = String(date.getDate()).padStart(2, '0');
              const dateString = `${yyyy}-${mm}-${dd}`;
              
              const isPast = date < new Date(new Date().setHours(0,0,0,0));
              const isFullyBooked = fullyBookedDates.has(dateString);
              const isSelected = selectedDate === dateString;
              const isDisabled = isPast || isFullyBooked || !step1Complete;

              let cellStyle = 'bg-bg-notes text-text-primary hover:bg-brand-primary/10 hover:text-brand-primary border border-transparent hover:border-brand-primary/30 cursor-pointer';

              if (isSelected) {
                cellStyle = 'bg-brand-primary text-white shadow-md transform scale-105 z-10 border border-transparent font-bold';
              } else if (isDisabled) {
                if (isFullyBooked) {
                  cellStyle = 'bg-brand-danger/10 text-brand-danger line-through opacity-70 cursor-not-allowed border border-transparent';
                } else {
                  cellStyle = 'bg-transparent text-text-secondary/30 cursor-not-allowed border border-transparent';
                }
              }

              return (
                <button
                  type="button"
                  key={dateString}
                  onClick={() => setSelectedDate(dateString)}
                  disabled={isDisabled}
                  className={`aspect-square flex items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200 ${cellStyle}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

         {/* ━━━━ CELL D: Time picker (col 6–12, row 2) ━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="md:col-span-7 relative bg-bg-surface rounded-2xl border border-border-card shadow-sm p-6">
          {!step2Complete && <LockedOverlay message="Pick a date first" />}
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-4">
            <StepBadge n={3} done={step3Complete} />
            Select a Time
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {TIME_SLOTS.map((time) => {
              const disabled = isSlotDisabled(selectedDate, time);
              const active   = selectedTime === time;
              return (
                <button
                  type="button"
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  disabled={!step2Complete || disabled}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-brand-primary text-white shadow-sm'
                      : disabled
                        ? 'bg-border-card text-text-secondary cursor-not-allowed line-through opacity-50'
                        : 'bg-brand-primary/10 text-text-primary hover:bg-brand-primary/20'
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>

        {/* ━━━━ CELL E: Notes (col 1–8, row 3) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="md:col-span-8 relative bg-bg-surface rounded-2xl border border-border-card shadow-sm p-6">
          {!step3Complete && <LockedOverlay message="Complete steps 1–3 first" />}
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-4">
            <StepBadge n={4} done={step3Complete && notes.length > 0} />
            Notes{' '}
            <span className="text-text-secondary font-normal normal-case tracking-normal ml-1">(optional)</span>
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!step3Complete}
            placeholder="Any special requests, medical concerns, or conditions we should know about…"
            rows={4}
            className="w-full p-4 border border-border-card rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary bg-bg-notes text-text-primary text-sm resize-none"
          />
        </div>

        {/* ━━━━ CELL F: Confirm CTA (col 9–12, row 3) ━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="md:col-span-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleBooking}
            disabled={isBooking || !step3Complete}
            className={`w-full py-5 rounded-2xl font-bold text-base transition-all duration-200 ${
              step3Complete
                ? 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                : 'bg-border-card text-text-secondary cursor-not-allowed'
            }`}
          >
            {isBooking ? '⏳ Booking…' : step3Complete ? '✓ Confirm Appointment' : '⬆ Complete all steps'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-4 rounded-2xl bg-bg-surface border border-border-card text-text-primary font-semibold text-sm hover:bg-bg-notes transition"
            >
              Cancel
            </button>
          )}

          {/* Progress tracker — shown while steps are incomplete */}
          {!step3Complete && (
            <div className="bg-bg-notes rounded-2xl border border-border-card p-4">
              <p className="text-xs text-text-secondary font-medium mb-2">Progress</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Service', done: step1Complete },
                  { label: 'Date',    done: step2Complete },
                  { label: 'Time',    done: step3Complete },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${s.done ? 'bg-brand-primary' : 'bg-border-card'}`} />
                    <p className={`text-xs ${s.done ? 'text-brand-primary font-semibold' : 'text-text-secondary'}`}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
