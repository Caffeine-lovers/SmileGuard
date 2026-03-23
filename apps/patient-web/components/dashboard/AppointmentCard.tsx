interface AppointmentCardProps {
  name: string;
  service: string;
  time: string;
  imageUrl?: string;
  onClick?: () => void;
}

export default function AppointmentCard({
  name,
  service,
  time,
  imageUrl = 'https://via.placeholder.com/40',
  onClick,
}: AppointmentCardProps) {
  return (
    <div
      className="bg-white rounded-lg p-3 mb-3 flex items-center shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={name}
        className="w-10 h-10 rounded-full bg-gray-200 object-cover"
      />
      <div className="flex-1 ml-3">
        <p className="font-bold text-sm text-gray-800">{name}</p>
        <p className="text-xs text-gray-600">{service}</p>
      </div>
      <p className="text-xs font-bold text-blue-600">{time}</p>
    </div>
  );
}
