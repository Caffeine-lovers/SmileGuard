import Link from 'next/link';

export default function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-center text-xs text-slate-500 ${className}`}>
      <span>© {new Date().getFullYear()} SmileGuard</span>
      <span className="mx-2">·</span>
      <Link href="/terms" className="hover:text-brand-primary underline-offset-2 hover:underline">Terms and Conditions</Link>
      <span className="mx-2">·</span>
      <Link href="/privacy" className="hover:text-brand-primary underline-offset-2 hover:underline">Privacy Policy</Link>
    </footer>
  );
}
