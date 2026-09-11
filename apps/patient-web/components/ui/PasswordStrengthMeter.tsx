export interface PasswordStrengthMeterProps {
  strengthPercent: number;
}

const getStrengthColor = (percent: number) =>
  percent <= 40 ? '#ef4444' : percent <= 70 ? '#f59e0b' : '#10b981';

const getStrengthLabel = (percent: number) => {
  if (percent <= 40) return 'Weak';
  if (percent <= 70) return 'Fair';
  if (percent < 100) return 'Good';
  return 'Strong';
};

export default function PasswordStrengthMeter({
  strengthPercent,
}: PasswordStrengthMeterProps) {
  const strengthColor = getStrengthColor(strengthPercent);
  const strengthLabel = getStrengthLabel(strengthPercent);

  return (
    <>
      <div className="h-1.5 rounded-xs bg-slate-200 border border-slate-300 mb-1.5 overflow-hidden">
        <div
          className="h-full rounded-xs transition-all duration-300"
          style={{
            width: `${strengthPercent}%`,
            backgroundColor: strengthColor,
          }}
        />
      </div>
      <p
        className="text-[11px] font-bold uppercase tracking-wider mb-1"
        style={{ color: strengthColor }}
      >
        Strength: {strengthLabel}
      </p>
    </>
  );
}
