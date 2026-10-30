import Link from 'next/link';
import React from 'react';

interface StatCardProps {
  number: number | string;
  label: string;
  icon?: React.ReactNode;
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
  const isClickable = Boolean(onClick || href);
  
  const content = (
    <div
      onClick={onClick}
      className={`skeuo-card p-4 sm:p-5 lg:p-6 flex items-center gap-3.5 sm:gap-4 lg:gap-5 border-2 border-slate-300 rounded-sm transition-all duration-200 ${
        isClickable ? 'cursor-pointer hover:border-emerald-600 hover:-translate-y-0.5' : ''
      }`}
    >
      {icon && (
        <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-sm bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-700 shadow-inner shrink-0">
          {icon}
        </div>
      )}
      <div>
        <p className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">{number}</p>
        <p className="text-[11px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider text-slate-500 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block no-underline">{content}</Link>;
  }

  return content;
}
