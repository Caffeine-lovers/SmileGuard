interface AppointmentCardProps {
  name: string;
  service: string;
  time: string;
  date?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function AppointmentCard({ name, service, time, date, onClick, isSelected }: AppointmentCardProps) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-card transition-colors cursor-pointer border ${
        isSelected 
          ? 'border-border-active bg-bg-surface' 
          : 'border-border-card bg-bg-surface hover:bg-slate-50'
      }`}
      onClick={onClick}
    >
      <div className="w-12 h-12 rounded-full bg-bg-avatar-initials text-text-on-avatar font-bold text-sm flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-base text-text-primary">{name}</p>
        <p className="text-sm text-text-secondary">{service}</p>
      </div>
      <div className="text-right flex flex-col items-end">
        {date && <span className="text-xs font-medium text-text-secondary mb-0.5">{date}</span>}
        <span className="text-sm font-bold text-brand-danger">{time}</span>
      </div>
    </div>
  );
}
