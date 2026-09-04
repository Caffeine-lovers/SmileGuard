
interface AppointmentCardProps {
  name: string;
  service: string;
  time: string;
  date?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function AppointmentCard({ name, service, time, date, onClick, isSelected }: AppointmentCardProps) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'SG';

  return (
    <div
      className={`skeuo-card flex items-center gap-4 p-3.5 rounded-sm transition-all duration-150 cursor-pointer border-2 ${
        isSelected 
          ? 'border-emerald-600 bg-emerald-50/40 shadow-sm' 
          : 'border-slate-300 hover:border-slate-400 bg-white'
      }`}
      onClick={onClick}
    >
      <div className="w-11 h-11 rounded-sm bg-gradient-to-b from-emerald-600 to-emerald-800 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 border border-emerald-900 shadow-inner">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-slate-900 truncate">{name}</p>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{service}</p>
      </div>
      <div className="text-right flex flex-col items-end shrink-0">
        {date && <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{date}</span>}
        <span className="text-xs font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-sm border border-emerald-300">
          {time}
        </span>
      </div>
    </div>
  );
}
