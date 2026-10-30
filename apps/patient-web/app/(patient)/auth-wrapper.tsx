'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import { 
  CalendarPlus, 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
  Sparkles, 
  CreditCard, 
  User, 
  FileText, 
  Stethoscope,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const { currentUser, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && (!currentUser || currentUser.role !== 'patient')) {
      router.push('/login');
    }
  }, [currentUser?.id, currentUser?.role, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      // Small delay to ensure auth state is cleared
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Still redirect even if logout fails
      router.push('/login');
    }
  };

  // Full-screen wizard view for onboarding - always render immediately
  if (pathname === '/onboarding') {
    return <main className="min-h-screen">{children}</main>;
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/appointments', label: 'Appointments', icon: CalendarPlus },
    { href: '/billing', label: 'Billing', icon: CreditCard },
    { href: '/analysis', label: 'Analysis', icon: Sparkles },
    { href: '/treatments', label: 'Treatments', icon: Stethoscope },
    { href: '/documents', label: 'Documents', icon: FileText },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  const bottomNavItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/appointments', label: 'Book', icon: CalendarPlus },
    { href: '/analysis', label: 'AI Scan', icon: Sparkles },
    { href: '/billing', label: 'Billing', icon: CreditCard },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-bg-screen">
      <header className="bg-bg-surface shadow-xs border-b border-border-card sticky top-0 z-50">
        {loading && (
          <div className="h-0.5 bg-emerald-500 animate-pulse w-full" />
        )}
        <div className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <span className="text-xl sm:text-2xl font-black text-brand-primary tracking-tight">
                SmileGuard
              </span>
              <span className="skeuo-badge skeuo-badge-mint text-[9px] hidden sm:inline-flex">
                Patient
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-5 lg:gap-6">
              {navLinks.filter(l => l.href !== '/appointments').map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link 
                    key={link.href}
                    href={link.href}
                    data-tour={link.href === '/analysis' ? 'nav-analysis' : link.href === '/billing' ? 'nav-billing' : undefined}
                    className={`text-sm font-semibold transition hover:text-brand-primary ${
                      isActive ? 'text-brand-primary border-b-2 border-brand-primary pb-0.5' : 'text-slate-700'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Book CTA */}
            <Link 
              href="/appointments" 
              className="skeuo-btn-primary py-2 px-3.5 text-xs uppercase tracking-wider hidden md:inline-flex"
            >
              <span className="flex items-center gap-2">
                <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                <span>Book Appointment</span>
              </span>
            </Link>

            <span className="text-xs font-semibold text-slate-600 hidden lg:block truncate max-w-[150px]">
              {currentUser?.name || ''}
            </span>

            {/* Desktop Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="skeuo-btn-secondary py-1.5 px-2.5 sm:py-2 sm:px-3 text-xs uppercase tracking-wider text-red-600 hover:text-red-700 hidden sm:inline-flex"
              title="Logout"
            >
              <span className="flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">Logout</span>
              </span>
            </button>

            {/* Mobile Quick Book Button */}
            <Link
              href="/appointments"
              className="skeuo-btn-primary p-2 text-xs md:hidden"
              title="Book Appointment"
            >
              <CalendarPlus className="w-4 h-4 shrink-0" />
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-sm border border-slate-300 bg-slate-100 text-slate-700 hover:text-slate-900 md:hidden transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Down Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/98 backdrop-blur-md px-4 py-4 space-y-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
            {currentUser?.name && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-300">
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-none">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">SmileGuard Patient</p>
                  </div>
                </div>
                <span className="skeuo-badge skeuo-badge-mint text-[9px]">Active</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
                      <span>{link.label}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <Link
                href="/onboarding"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Onboarding Guide</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="skeuo-btn-secondary py-1.5 px-3 text-xs uppercase tracking-wider text-red-600 hover:text-red-700 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content with bottom padding to avoid bottom nav clipping on mobile */}
      <main className="flex-1 overflow-auto pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto w-full">{children}</div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] safe-area-bottom"
        aria-label="Mobile Navigation"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-sm transition-all min-w-[56px] ${
                  isActive
                    ? 'text-emerald-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className={`p-1 rounded-sm transition ${isActive ? 'bg-emerald-100 text-emerald-800' : ''}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5 leading-none tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
