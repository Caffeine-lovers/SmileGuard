export interface PasswordStrengthMeterProps {
  strengthPercent: number;
}

const getStrengthColor = (percent: number) =>
  percent <= 40 ? '#ef4444' : percent <= 70 ? '#f59e0b' : '#22c55e';

const getStrengthLabel = (percent: number) => {
  if (percent <= 40) return 'Weak';
  if (percent <= 70) return 'Fair';
  if (percent < 100) return 'Good';
  return 'Strong ✓';
};

export default function PasswordStrengthMeter({
  strengthPercent,
}: PasswordStrengthMeterProps) {
  const strengthColor = getStrengthColor(strengthPercent);
  const strengthLabel = getStrengthLabel(strengthPercent);

  return (
    <>
      <div className="h-1.5 rounded-full bg-gray-300 mb-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${strengthPercent}%`,
            backgroundColor: strengthColor,
          }}
        />
      </div>
      <p
        className="text-xs font-semibold mb-1"
        style={{ color: strengthColor }}
      >
        {strengthLabel}
      </p>
    </>
  );
}
