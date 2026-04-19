import { SignupProvider } from '@/lib/signup-context';

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SignupProvider>
      {children}
    </SignupProvider>
  );
}
