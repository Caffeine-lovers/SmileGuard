interface AppointmentCardProps {
  name: string;
  service: string;
  time: string;
  onClick?: () => void;
}

export default function AppointmentCard({ name, service, time, onClick }: AppointmentCardProps) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border-b last:border-b-0"
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm text-gray-800">{name}</p>
        <p className="text-xs text-gray-500">{service}</p>
      </div>
      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{time}</span>
    </div>
  );
}
