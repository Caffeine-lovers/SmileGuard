interface StatCardProps {
  number: number | string;
  label: string;
  icon: string;
  accent?: string;
}

export default function StatCard({ number, label, icon, accent = 'border-blue-500' }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${accent} flex items-center gap-4`}>
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{number}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
