'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { bookSlot, getAllBlockedSlots, isSlotTaken, getPatientAppointments, getClinicSetup, generateTimeSlots, type ClinicSchedule } from '@/lib/appointmentService';
import { createBilling } from '@/lib/paymentService';
import { SERVICE_PRICES } from '@/lib/outstandingBalanceService';
import type { Appointment } from '@/lib/database';

const SERVICES = [
  { id: 'cleaning',   name: 'Cleaning',             duration: 30, price: 1500,  icon: '' },
  { id: 'whitening',  name: 'Whitening',             duration: 60, price: 5000,  icon: '' },
  { id: 'fillings',   name: 'Fillings',              duration: 45, price: 2000,  icon: '' },
  { id: 'root-canal', name: 'Root Canal',            duration: 90, price: 8000,  icon: '' },
  { id: 'extraction', name: 'Extraction',            duration: 30, price: 1500,  icon: '' },
  { id: 'braces',     name: 'Braces Consultation',   duration: 60, price: 35000, icon: '' },
  { id: 'implants',   name: 'Implants Consultation', duration: 60, price: 45000, icon: '' },
  { id: 'xray',       name: 'X-Ray',                 duration: 15, price: 500,   icon: '' },
  { id: 'checkup',    name: 'Check-up',              duration: 20, price: 300,   icon: '' },
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
  const [userAppointments, setUserAppointments]       = useState<Appointment[]>([]);
  const [loadingUserData, setLoadingUserData]         = useState(true);
  const [currentMonthView, setCurrentMonthView]       = useState(() => new Date());
  const [clinicSchedule, setClinicSchedule]           = useState<ClinicSchedule | null>(null);
  const [timeSlots, setTimeSlots]                     = useState<string[]>([]);
  const [blockedDates, setBlockedDates]               = useState<Set<string>>(new Set());
  const [appointmentRules, setAppointmentRules]       = useState<any | null>(null);
  const [loadingRules, setLoadingRules]               = useState(true);
  const [showRulesModal, setShowRulesModal]            = useState(false);

  console.log('🔴 [DIAGNOSTIC] BookAppointment component RENDERED');
  console.log('🔴 [DIAGNOSTIC] currentUser:', currentUser);

  // Fetch appointment rules on component mount
  useEffect(() => {
    const fetchAppointmentRules = async () => {
      try {
        setLoadingRules(true);
        const { data, error } = await supabase
          .from('appointment_rules')
          .select('*')
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        setAppointmentRules(data || null);
      } catch (error) {
        console.error('Error fetching appointment rules:', error);
        setAppointmentRules(null);
      } finally {
        setLoadingRules(false);
      }
    };

    fetchAppointmentRules();
  }, []);

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

  // Fetch clinic setup and blocked slots on component mount
  useEffect(() => {
    const loadClinicData = async () => {
      setLoadingBlockedSlots(true);
      try {
        const schedule = await getClinicSetup();
        setClinicSchedule(schedule);
        
        const slots = await getAllBlockedSlots(schedule);
        setBlockedSlots(slots);
        
        // Track only the blocked dates (not appointment counts)
        const blocked = new Set<string>();
        
        for (const slot of slots) {
          if (slot.service === 'blocked') {
            blocked.add(slot.date);
          }
        }
        
        setBlockedDates(blocked);
        console.log('📊 [BookAppointment] Blocked dates:', Array.from(blocked));
      } catch (error) {
        console.error('Error loading clinic data:', error);
        setBlockedSlots([]);
        setClinicSchedule(null);
        setBlockedDates(new Set());
      } finally {
        setLoadingBlockedSlots(false);
      }
    };
    
    loadClinicData();
  }, []);

  // Update time slots when selected date changes
  useEffect(() => {
    if (selectedDate && clinicSchedule) {
      // Check if date is blocked or fully booked
      if (blockedDates.has(selectedDate) || isFullyBooked(selectedDate)) {
        console.log(`🚫 [BookAppointment] ${selectedDate} is blocked or fully booked - no time slots available`);
        setTimeSlots([]);
        return;
      }
      
      const [year, month, day] = selectedDate.split('-').map(Number);
      const slots = generateTimeSlots(clinicSchedule, year, month, day);
      setTimeSlots(slots);
      console.log(`⏱️ [BookAppointment] Generated ${slots.length} time slots for ${selectedDate}:`, slots);
    }
  }, [selectedDate, clinicSchedule, blockedDates, blockedSlots]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;
    async function fetchUserAppointments() {
      setLoadingUserData(true);
      try {
        const appointments = await getPatientAppointments(userId);
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

  const isSlotDisabled = (date: string, time: string) => {
    const taken = isSlotTaken(blockedSlots, date, time);
    if (taken) {
      console.log(`🔒 Slot disabled: ${date} @ ${time}`);
    }
    return taken;
  };

  // Check if a date is available based on clinic schedule
  const isDateAvailable = (date: Date): boolean => {
    if (!clinicSchedule) return true; // Default to available if no schedule
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const dayOfWeek = date.getDay();
    const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = DAY_NAMES[dayOfWeek];
    
    const daySchedule = clinicSchedule[dayName as keyof ClinicSchedule];
    if (!daySchedule || !daySchedule.isOpen) {
      console.log(`🚫 Date ${day} is unavailable (clinic closed on ${dayName})`);
      return false;
    }
    
    return true;
  };

  // Count booked appointments for a specific date
  const countBookedAppointments = (dateString: string): number => {
    return blockedSlots.filter(slot => 
      slot.date === dateString && slot.service !== 'blocked'
    ).length;
  };

  // Check if a date is fully booked (3 or more appointments)
  const isFullyBooked = (dateString: string): boolean => {
    return countBookedAppointments(dateString) >= 3;
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !currentUser?.id) {
      alert('Please select service, date, and time');
      return;
    }
    const userId = currentUser.id;
    setIsBooking(true);
    try {
      // Book the appointment
      const result = await bookSlot(userId, '', selectedService.name, selectedDate, selectedTime);
      if (result.success && result.appointmentId) {
        console.log('[handleBooking] Appointment created:', result.appointmentId);
        
        // Get the service price from SERVICE_PRICES
        const servicePrice = SERVICE_PRICES[selectedService.name] || selectedService.price || 0;
        console.log('[handleBooking] Service price:', { service: selectedService.name, price: servicePrice });
        
        // Create billing record
        const billingResult = await createBilling(userId, result.appointmentId, servicePrice);
        
        if (billingResult.success) {
          console.log('[handleBooking] Billing record created:', billingResult.billingId);
          alert('Appointment booked successfully!');
        } else {
          console.warn('[handleBooking] Billing creation failed, but appointment was booked:', billingResult.message);
          alert('Appointment booked, but billing record could not be created. Please contact support.');
        }
        
        if (onSuccess) {
          onSuccess({
            id: result.appointmentId,
            patient_id: userId,
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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-cyan tracking-tight">Book an Appointment</h1>
          <p className="text-text-secondary text-sm mt-1">Complete each card in order to confirm your visit.</p>
        </div>
        {!loadingRules && appointmentRules && (
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors text-sm font-bold flex items-center gap-2 shadow-sm whitespace-nowrap self-start sm:self-auto"
          >
            View Booking Rules
          </button>
        )}
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
              const isClinicClosed = !isDateAvailable(date);
              const isBlockedDate = blockedDates.has(dateString);
              const isFullyBookedDate = isFullyBooked(dateString);
              const isSelected = selectedDate === dateString;
              
              const isDisabled = isPast || isClinicClosed || isBlockedDate || isFullyBookedDate || !step1Complete;

              let cellStyle = 'relative aspect-square flex items-center justify-center rounded-xl transition-all duration-200 bg-bg-notes text-text-primary hover:bg-brand-primary/10 hover:text-brand-primary border border-transparent hover:border-brand-primary/30 cursor-pointer';
              let dateNumStyle = 'text-sm font-semibold text-text-primary';

              if (isSelected) {
                cellStyle = 'relative aspect-square flex items-center justify-center rounded-xl transition-all duration-200 bg-brand-primary text-white shadow-md border-2 border-brand-primary font-bold cursor-pointer';
              } else if (isBlockedDate || isClinicClosed || isFullyBookedDate) {
                // Blocked dates, clinic closed, or fully booked - gray out
                cellStyle = 'relative aspect-square flex items-center justify-center rounded-xl transition-all duration-200 bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300';
                dateNumStyle = 'text-sm font-semibold text-gray-500 line-through';
              } else if (isPast) {
                cellStyle = 'relative aspect-square flex items-center justify-center rounded-xl transition-all duration-200 bg-gray-100 text-gray-400 cursor-not-allowed';
                dateNumStyle = 'text-sm font-semibold text-gray-400';
              }

              return (
                <button
                  type="button"
                  key={dateString}
                  onClick={() => !isDisabled && setSelectedDate(dateString)}
                  disabled={isDisabled}
                  className={cellStyle}
                  title={
                    isBlockedDate
                      ? 'Blocked date - no appointments available'
                      : isFullyBookedDate
                      ? 'Fully booked - 3 appointments already scheduled'
                      : isClinicClosed 
                      ? 'Clinic closed on this day' 
                      : isPast
                      ? 'Date has passed'
                      : ''
                  }
                >
                  <span className={dateNumStyle}>{date.getDate()}</span>
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
            {timeSlots.length > 0 ? (
              timeSlots.map((time) => {
                const disabled = isSlotDisabled(selectedDate, time);
                const active   = selectedTime === time;
                console.log(`⏰ Time ${time} for ${selectedDate}: disabled=${disabled}`);
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
              })
            ) : (
              <p className="col-span-full text-center text-text-secondary text-xs py-4">
                {selectedDate ? 'No available time slots for this date' : 'Select a date first'}
              </p>
            )}
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

      {/* Rules & Policies Modal */}
      {showRulesModal && appointmentRules && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl font-bold">Booking Rules & Policies</h2>
                <p className="text-blue-100 text-sm mt-1">What you need to know before booking</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Cancellation Policy Section */}
              <div className="border-l-4 border-blue-600 pl-4">
                <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                  Cancellation Policy
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="font-semibold text-blue-900">Cancellation Window</p>
                    <p className="text-blue-700 mt-1">
                      You can cancel your appointment up to <span className="font-bold text-lg text-blue-900">{appointmentRules.cancellation_window_hours} hours</span> before the scheduled time.
                    </p>
                  </div>

                  {appointmentRules.grace_period_enabled && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="font-semibold text-green-900">Grace Period (Free Cancellation)</p>
                      <p className="text-green-700 mt-1">
                        Cancel for <span className="font-bold text-lg text-green-900">{appointmentRules.grace_period_hours} hours</span> from booking without any fee.
                      </p>
                    </div>
                  )}

                  {appointmentRules.cancellation_fee_amount > 0 && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="font-semibold text-red-900">Cancellation Fee</p>
                      <p className="text-red-700 mt-1">
                        If you cancel after the grace period, a fee of <span className="font-bold text-lg text-red-900">₱{appointmentRules.cancellation_fee_amount}</span> will be charged.
                      </p>
                    </div>
                  )}

                  {appointmentRules.first_time_cancellation_free && (
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="font-semibold text-purple-900">✨ First Cancellation Free</p>
                      <p className="text-purple-700 mt-1">
                        Your first cancellation will be free, regardless of timing.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reschedule Policy Section */}
              {appointmentRules.reschedule_allowed && (
                <div className="border-l-4 border-indigo-600 pl-4">
                  <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                    Rescheduling
                  </h3>
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="font-semibold text-indigo-900">Reschedule Window</p>
                    <p className="text-indigo-700 mt-1">
                      You can reschedule your appointment up to <span className="font-bold text-lg text-indigo-900">{appointmentRules.reschedule_window_hours} hours</span> before the appointment.
                    </p>
                  </div>
                </div>
              )}

              {!appointmentRules.reschedule_allowed && (
                <div className="border-l-4 border-gray-400 pl-4">
                  <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                    Rescheduling
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-700">
                      Rescheduling is not available. You will need to cancel and create a new booking.
                    </p>
                  </div>
                </div>
              )}

              {/* No-Show Penalty Section */}
              {appointmentRules.no_show_penalty_enabled && appointmentRules.no_show_penalty_amount > 0 && (
                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                    No-Show Penalty
                  </h3>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="font-semibold text-red-900">Important</p>
                    <p className="text-red-700 mt-1">
                      If you don't show up for your appointment without cancelling, a penalty of <span className="font-bold text-lg text-red-900">₱{appointmentRules.no_show_penalty_amount}</span> will be charged to your account.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary Section */}
              <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg p-4 border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">Quick Summary</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>Cancel up to <span className="font-bold">{appointmentRules.cancellation_window_hours}h</span> before appointment</li>
                  {appointmentRules.grace_period_enabled && (
                    <li>Free cancellation within <span className="font-bold">{appointmentRules.grace_period_hours}h</span> of booking</li>
                  )}
                  {appointmentRules.reschedule_allowed && (
                    <li>Reschedule up to <span className="font-bold">{appointmentRules.reschedule_window_hours}h</span> before</li>
                  )}
                  {appointmentRules.no_show_penalty_enabled && appointmentRules.no_show_penalty_amount > 0 && (
                    <li>No-show penalty: <span className="font-bold">₱{appointmentRules.no_show_penalty_amount}</span></li>
                  )}
                </ul>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Got it, Let's Book!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
