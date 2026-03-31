export interface PasswordStrengthMeterProps {
  strengthPercent: number;
}

/*
  FIX: Weak color #ef4444 → #F05454 (brand-danger exact hex from design guidelines).
  The bar track also moves from bg-gray-300 → bg-border-card to use the design token
  instead of a raw Tailwind gray, keeping the component fully on-brand.
*/
const getStrengthColor = (percent: number) =>
  percent <= 40 ? '#F05454' : percent <= 70 ? '#f59e0b' : '#22c55e';

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
      {/* FIX: bg-gray-300 → bg-border-card (design token for dividers/tracks) */}
      <div className="h-1.5 rounded-full bg-border-card mb-2 overflow-hidden">
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
