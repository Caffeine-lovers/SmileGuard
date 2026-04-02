interface StatCardProps {
  number: number | string;
  label: string;
  icon: string;
  accent?: string;
  onClick?: () => void;
  href?: string;
}

export default function StatCard({
  number,
  label,
  icon,
  onClick,
  href,
}: StatCardProps) {
  const isClickable = onClick || href;
  
  if (href) {
    return (
      <a href={href}>
        <div
          className={`bg-bg-surface rounded-card shadow-sm border border-border-card p-5 flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${isClickable ? 'cursor-pointer' : ''}`}
        >
          <div className="text-3xl">{icon}</div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{number}</p>
            <p className="text-sm text-text-secondary mt-0.5">{label}</p>
          </div>
        </div>
      </a>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-bg-surface rounded-card shadow-sm border border-border-card p-5 flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${isClickable ? 'cursor-pointer' : ''}`}
    >
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{number}</p>
        <p className="text-sm text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}
