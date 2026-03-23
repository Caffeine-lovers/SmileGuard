interface StatCardProps {
  number: number | string;
  label: string;
}

export default function StatCard({ number, label }: StatCardProps) {
  return (
    <div className="flex-1 min-w-[120px] bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <p className="text-3xl font-bold text-blue-600">{number}</p>
      <p className="text-sm text-gray-600 mt-2">{label}</p>
    </div>
  );
}
