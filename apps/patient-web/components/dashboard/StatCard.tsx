interface StatCardProps {
  number: number | string;
  label: string;
  icon: string;
  accent?: string;
}

export default function StatCard({
  number,
  label,
  icon,
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-5  flex items-center gap-4 
        transition-all duration-300 hover:shadow-lg hover:shadow-blue-300 hover:-translate-y-1`}
    >
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{number}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
