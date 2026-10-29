
interface AppointmentCardProps {
  name: string;
  service: string;
  time: string;
  date?: string;
  status?: string;
  clinicName?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function AppointmentCard({ name, service, time, date, status, clinicName, onClick, isSelected }: AppointmentCardProps) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'SG';

  return (
    <div
      className={`skeuo-card flex items-center gap-2.5 sm:gap-4 p-3 sm:p-3.5 rounded-sm transition-all duration-150 cursor-pointer border-2 ${
        isSelected 
          ? 'border-emerald-600 bg-emerald-50/40 shadow-sm' 
          : 'border-slate-300 hover:border-slate-400 bg-white'
      }`}
      onClick={onClick}
    >
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-sm bg-gradient-to-b from-emerald-600 to-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-900 shadow-inner">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="font-bold text-xs sm:text-sm text-slate-900 truncate max-w-[130px] sm:max-w-none">{name}</p>
          {status && (
            <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-xs border shrink-0 ${
              status === 'completed'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : status === 'pending'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : status === 'declined'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : status === 'cancelled'
                ? 'bg-red-100 text-red-800 border-red-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}>
              {status === 'pending' ? 'Pending Approval' : status}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-0.5">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{service}</p>
          {clinicName && (
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-xs border bg-emerald-50 text-emerald-800 border-emerald-200 truncate max-w-[90px] sm:max-w-[130px]">
              {clinicName}
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex flex-col items-end shrink-0 pl-1">
        {date && <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{date}</span>}
        <span className="text-[11px] sm:text-xs font-black text-emerald-700 bg-emerald-100/70 px-1.5 sm:px-2 py-0.5 rounded-sm border border-emerald-300 whitespace-nowrap">
          {time}
        </span>
      </div>
    </div>
  );
}
