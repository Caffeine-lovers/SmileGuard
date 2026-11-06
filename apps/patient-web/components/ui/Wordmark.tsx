interface WordmarkProps {
  className?: string;
  smileClassName?: string;
}

export default function Wordmark({ className = '', smileClassName = 'text-emerald-400' }: WordmarkProps) {
  return (
    <span className={`group/wordmark relative inline-block ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 160 40"
        fill="none"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute -left-[3%] top-[34%] h-[0.95em] w-[112%] origin-left scale-x-90 opacity-0 transition duration-300 ease-out group-hover/wordmark:scale-x-100 group-hover/wordmark:opacity-60 motion-reduce:transition-none ${smileClassName}`}
      >
        <path d="M6 8C40 40 120 40 154 6" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        <circle cx="154" cy="6" r="5" fill="currentColor" />
      </svg>
      <span className="relative">SmileGuard</span>
    </span>
  );
}
