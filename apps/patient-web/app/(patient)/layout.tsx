import AuthWrapper from './auth-wrapper';

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthWrapper>{children}</AuthWrapper>;
}
