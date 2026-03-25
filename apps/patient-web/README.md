# SmileGuard Patient Web Portal

A modern Next.js web application for dental patients to manage appointments, billing, and dental health.

## Features

- **Dashboard**: View upcoming appointments, outstanding balance, and quick action links
- **Appointment Booking**: Schedule dental appointments with available time slots
- **Payment & Billing**: Manage payments, view billing history, and apply discounts
- **AI Oral Analysis**: Upload photos for AI-powered oral health analysis
- **Treatment History**: Track past treatments and ongoing care
- **Medical Documents**: Access X-rays, prescriptions, and medical reports
- **Authentication**: Secure patient login with email verification

## Tech Stack

- **Framework**: Next.js 16.2.1 with Turbopack (build optimization)
- **UI Framework**: React 19 with Tailwind CSS
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth (email + password)
- **Language**: TypeScript
- **Package Manager**: pnpm (monorepo)

## Project Structure

```
apps/patient-web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Public authentication pages (route group)
│   │   ├── login/
│   │   ├── signup/
│   │   └── reset-password/
│   └── (patient)/         # Protected patient pages (requires auth)
│       ├── dashboard/
│       ├── appointments/
│       ├── billing/
│       ├── analysis/
│       ├── treatments/
│       └── documents/
├── components/            # Reusable React components
│   ├── dashboard/        # Dashboard-specific components
│   ├── appointments/     # Appointment booking components
│   ├── billing/          # Payment and billing components
│   └── ui/               # Shared UI components
├── lib/                  # Services and utilities
│   ├── appointmentService.ts   # Appointment booking logic
│   ├── paymentService.ts       # Payment processing
│   ├── database.ts             # Type definitions and helpers
│   └── supabase.ts             # Supabase client
└── public/               # Static assets
```

## Prerequisites

- Node.js 20+
- pnpm 10+
- Supabase account with configured database
- `.env.local` file with environment variables

## Environment Setup

Create `.env.local` in `apps/patient-web/`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these values from your Supabase project settings:
1. Go to https://supabase.com
2. Select your project
3. Copy URL and anon key from Project Settings → API

## Installation

### From Root Directory

```bash
# Install all dependencies (root + workspaces)
pnpm install

# Navigate to patient-web if working only on this app
cd apps/patient-web
```

## Running the Application

### Development Server

```bash
# From root directory
npm run patient:dev

# Or directly in apps/patient-web
npm run dev
```

The application will start at `http://localhost:3001` (or available port if 3000 is in use).

### Production Build

```bash
# Build for production
npm run build

# Start production server (requires build first)
npm start
```

## Authentication Flow

### Signup
1. User navigates to `/signup`
2. Enters name, email, password, and dental service preference
3. Completes medical intake form (diabetes, heart disease, allergies)
4. Account is created in Supabase

### Login
1. User navigates to `/login`
2. Enters email and password
3. Authenticated and redirected to `/dashboard`

### Password Reset
1. User clicks "Forgot password?" on login page
2. Receives email with reset link
3. Clicks link to `/reset-password?access_token=...`
4. Sets new password

### Protected Routes
- All routes under `(patient)/` require authentication
- Unauthenticated users are redirected to `/login`
- Authentication state is managed via `useAuth` hook from `@smileguard/shared-hooks`

## Services

### Appointment Service (`lib/appointmentService.ts`)

```typescript
// Check available slots for a date
getBookedSlots(date: string): Promise<string[]>

// Book an appointment
bookSlot(
  patientId: string,
  dentistId: string,
  service: string,
  appointmentDate: string,
  appointmentTime: string
): Promise<{ success: boolean; message: string }>

// Get patient's appointments
getPatientAppointments(patientId: string): Promise<Appointment[]>

// Cancel appointment
cancelAppointment(appointmentId: string): Promise<{ success: boolean; message: string }>
```

### Payment Service (`lib/paymentService.ts`)

```typescript
// Process payment
processPayment(
  billingId: string,
  amount: number,
  paymentMethod: string
): Promise<{ success: boolean; message: string }>

// Get patient's billing records
getBillings(patientId: string): Promise<Billing[]>

// Get outstanding balance
getBalance(patientId: string): Promise<number>
```

## Available Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Redirects to `/login` or `/dashboard` |
| `/login` | Public | Patient login page |
| `/signup` | Public | Patient registration page |
| `/reset-password` | Public | Password recovery page |
| `/dashboard` | Protected | Main patient dashboard |
| `/appointments` | Protected | Book new appointments |
| `/billing` | Protected | Payment and billing management |
| `/analysis` | Protected | AI oral health analysis |
| `/treatments` | Protected | Treatment history |
| `/documents` | Protected | Medical documents and X-rays |

## Common Tasks

### Adding a New Page

1. Create directory in `app/(patient)/page-name/`
2. Add `page.tsx`:
```tsx
'use client';
export default function PageName() {
  return <div>Your content</div>;
}
```
3. Add navigation link to dashboard or other pages
4. Page is automatically routed to `/page-name`

### Adding a Component

1. Create component in `components/feature-name/ComponentName.tsx`
2. Use Tailwind CSS for styling (avoid React Native styles)
3. Export and import in pages:
```tsx
import ComponentName from '@/components/feature-name/ComponentName';
```

### Using Authentication

```tsx
import { useAuth } from '@smileguard/shared-hooks';

export default function MyComponent() {
  const { currentUser, logout } = useAuth();
  
  return (
    <div>
      Welcome, {currentUser?.name}!
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Calling Services

```tsx
import { getPatientAppointments } from '@/lib/appointmentService';
import { getBalance } from '@/lib/paymentService';

// In a component
const [appointments, balance] = await Promise.all([
  getPatientAppointments(userId),
  getBalance(userId),
]);
```

## Troubleshooting

### Port Already in Use
The app will automatically use the next available port (3001, 3002, etc.)

### Build Errors
```bash
# Clean and rebuild
rm -rf .next node_modules
pnpm install
npm run build
```

### TypeScript Errors
- Ensure all imports use proper paths: `@/` for relative, `@smileguard/` for workspace
- Run `npm run build` to check for errors
- Check `tsconfig.json` path configuration

### Supabase Connection Issues
- Verify `.env.local` has correct URL and anon key
- Check Supabase project is active and not paused
- Test connection: `npm run dev` should show "✓ Ready"

## Development Tips

- **Hot Reload**: Changes to files automatically reload in browser
- **TypeScript**: Full type checking prevents runtime errors
- **Debugging**: Use browser DevTools or VS Code debugger
- **Tailwind Classes**: Use `className` instead of `style` for styling
- **Components**: Keep components small and reusable

## Links & Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review component implementations in similar pages
3. Check Supabase dashboard for database status
4. Review browser console for error messages

## Next Steps

- [ ] Set up Supabase project and database
- [ ] Configure environment variables
- [ ] Run development server
- [ ] Test login and signup flow
- [ ] Book an appointment
- [ ] Test payment flow
- [ ] Deploy to production (Vercel recommended)

---

**Last Updated**: 2024
**Project**: SmileGuard Patient Web Portal
  - `(auth)/` - Public auth pages (login, signup, reset-password)
  - `(patient)/` - Protected patient dashboard pages
- `components/` - Reusable React components
- `lib/` - Service layer (API calls, database queries)
- `public/` - Static assets
