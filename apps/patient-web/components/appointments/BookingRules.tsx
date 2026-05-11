'use client';

interface BookingRulesProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentRules: any;
}

export default function BookingRules({ isOpen, onClose, appointmentRules }: BookingRulesProps) {
  if (!isOpen || !appointmentRules) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 pt-24 pb-8 overflow-hidden">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[calc(100vh-8rem)] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-start sm:items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Booking Rules & Policies</h2>
            <p className="text-blue-100 text-sm mt-1">What you need to know before booking</p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
          <div>
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
            <div>
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
            <div>
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
            <div>
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
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Got it, Let's Book!
          </button>
        </div>
      </div>
    </div>
  );
}
