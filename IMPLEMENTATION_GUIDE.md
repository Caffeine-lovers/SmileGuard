# SmileGuard Complete Implementation Guide

**Version:** 1.0  
**Date:** March 22, 2026  
**Status:** ✅ Ready for Development

---

## 🎯 Executive Summary

### What's Done
✅ **Monorepo architecture** with shared packages (types, hooks, Supabase client)  
✅ **Patient web portal** (Next.js 14) with full auth flow and dashboard scaffolding  
✅ **Shared authentication** system with role-based access control  
✅ **UI components** and responsive design  
✅ **Dependency audit** - all packages current and secure  
✅ **Import structure** - all paths configured and working  

### What's Next
1. Migrate existing doctor-mobile to `apps/doctor-mobile/`
2. Implement core services (appointments, billing, analysis)
3. Fill in dashboard pages with real data
4. Add offline sync support
5. Deploy to Vercel (patient-web) and App Store/Play Store (doctor-mobile)

---

## 📁 Project Structure Reference

```
smileguard/
│
├── 📂 apps/
│   ├── patient-web/                 # Next.js 14 Patient Portal
│   │   ├── app/
│   │   │   ├── (auth)/              # Public auth pages
│   │   │   │   ├── login/
│   │   │   │   ├── signup/
│   │   │   │   └── layout.tsx
│   │   │   ├── (patient)/           # Protected patient pages
│   │   │   │   ├── dashboard/
│   │   │   │   ├── appointments/
│   │   │   │   ├── billing/
│   │   │   │   ├── analysis/
│   │   │   │   ├── treatments/
│   │   │   │   ├── documents/
│   │   │   │   └── layout.tsx
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/              # Reusable React components
│   │   ├── lib/                     # Service layer (API calls)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   └── .env.local               # Pre-filled with credentials
│   │
│   └── doctor-mobile/               # Expo React Native App
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── package.json
│       ├── app.json                 # (remove web platform)
│       └── .env.local               # Same as patient-web
│
├── 📂 packages/
│   ├── shared-types/                # TypeScript definitions
│   │   ├── index.ts                 # All type exports
│   │   └── package.json
│   │
│   ├── shared-hooks/                # Custom React hooks
│   │   ├── index.ts                 # Barrel export
│   │   ├── useAuth.ts               # Authentication
│   │   ├── useNetwork.ts            # Online/offline detection
│   │   └── package.json
│   │
│   └── supabase-client/             # Supabase initialization
│       ├── index.ts                 # Client setup
│       └── package.json
│
├── 📂 supabase/
│   ├── setup.sql                    # Database schema
│   ├── functions/                   # Edge Functions
│   │   ├── verify-doctor-code/
│   │   └── Payment/
│   └── migrations/
│
├── 📂 assets/
│   └── images/
│
├── package.json                     # Root monorepo config
├── .env.example                     # Credential template
├── MONOREPO_SETUP.md                # This guide
├── PATIENT_WEB_TODO.md              # Patient portal requirements
├── DEPENDENCY_AUDIT.md              # Deprecation report
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd /path/to/SmileGuard
npm install
```
This installs all root, app, and package dependencies via workspaces.

### 2. Run Patient Web Portal
```bash
npm run patient:dev
```
Opens `http://localhost:3000`

### 3. Test Authentication
```
Login Page:
  - Click "Sign Up"
  - Create test account with:
    - Email: test@example.com
    - Password: Test@123456
    - Service: General Checkup
    - Medical info: Optional
  - Click "Create Account"
  - Login with credentials
  - Should see Dashboard with sidebar
```

### 4. Run Doctor Mobile
```bash
npm run doctor:start
# Choose platform (Android/iOS)
```

---

## 🔐 Authentication Flow (Complete)

### Patient Web Login
```
User visits http://localhost:3000
    ↓
Redirect check (useAuth hook)
    ↓
Check session in Supabase Auth
    ├─ Session exists → Fetch profile → currentUser set → Redirect to /dashboard
    └─ No session → Redirect to /auth/login
    
User clicks "Sign Up"
    ↓
Multi-step form:
  1. Enter name, email, password, service
  2. Medical history (optional)
  3. Submit
    ↓
Supabase Auth creates user (JWT tokens)
    ↓
Create profile record in DB
    ↓
Create medical_intake record (if patient)
    ↓
Success → Redirect to /auth/login
    ↓
User logs in with credentials
    ↓
Check role === 'patient'
    ├─ Match → /dashboard
    └─ Mismatch → /auth/login (error)
```

### Role-Based Protection
```typescript
// In (patient)/layout.tsx
if (!currentUser || currentUser.role !== 'patient') {
  redirect('/auth/login')  // Automatic redirect
}
```

---

## 💾 Database Integration

### Current Tables (Already Set Up)
1. `auth.users` — Supabase Auth (managed)
2. `public.profiles` — User profiles with role
3. `public.medical_intake` — Patient medical history
4. `public.appointments` — Booking records
5. `public.billing` — Invoices & payments
6. `public.treatments` — Treatment records

### RLS Policies (Already Configured)
- ✅ Patients see only their own data
- ✅ Doctors see only assigned appointments
- ✅ Billing records tied to patient ID
- ✅ Medical intake tied to patient ID

---

## 🔌 Service Layer (To Implement)

### `apps/patient-web/lib/appointmentService.ts`
```typescript
export async function getAppointments(): Promise<Appointment[]>
export async function getAvailableSlots(date: string): Promise<string[]>
export async function bookAppointment(...): Promise<{ success: boolean }>
export async function rescheduleAppointment(id, newDate, newTime)
export async function cancelAppointment(id, reason)
```

### `apps/patient-web/lib/billingService.ts`
```typescript
export async function getBalance(): Promise<number>
export async function getInvoices(filter?): Promise<Billing[]>
export async function processPayment(amount, method, discount?): Promise<TransactionId>
```

### `apps/patient-web/lib/analysisService.ts`
```typescript
export async function uploadImage(file: File): Promise<ImageId>
export async function analyzeImage(imageId): Promise<Detection[]>
export async function listAnalyses(): Promise<ImageAnalysis[]>
```

---

## 🎨 Component Structure (To Build)

### Reusable UI Components
```
components/
├── Button.tsx              # Primary, secondary, danger variants
├── Input.tsx               # Text, email, password, tel
├── Modal.tsx               # Confirm dialogs
├── Card.tsx                # Data cards
├── Badge.tsx               # Status badges
├── Alert.tsx               # Error/success messages
├── Loading.tsx             # Spinners, skeletons
└── FileUpload.tsx          # Drag & drop upload
```

### Form Components
```
components/forms/
├── AppointmentForm.tsx     # Book appointment
├── PaymentForm.tsx         # Process payment
└── DiscountForm.tsx        # PWD/senior verification
```

---

## 🔧 Configuration Reference

### Environment Variables (`.env.local`)
```env
# Supabase credentials (same for patient-web and doctor-mobile)
NEXT_PUBLIC_SUPABASE_URL=https://yffvnvusiazjnwmdylji.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional (add as needed)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### TypeScript Paths (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@smileguard/*": ["../../packages/*"]
    }
  }
}
```

### Tailwind Config
```javascript
theme: {
  extend: {
    colors: {
      primary: '#2563eb',
      secondary: '#64748b',
      success: '#16a34a',
      warning: '#ea580c',
      danger: '#dc2626',
    }
  }
}
```

---

## 📱 Responsive Breakpoints

```css
Mobile:   <640px   (default)
Tablet:   ≥768px   (md:)
Desktop:  ≥1024px  (lg:)
```

Example Tailwind classes:
```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* Full width on mobile, half on tablet, third on desktop */}
</div>
```

---

## 🧪 Testing Checklist

### Setup Phase
- [ ] `npm install` completes
- [ ] `npm run type-check` passes
- [ ] No TypeScript errors in IDE

### Patient Web Phase
- [ ] `npm run patient:dev` starts
- [ ] http://localhost:3000 loads
- [ ] Signup page displays correctly
- [ ] Create test account succeeds
- [ ] User data saved to Supabase
- [ ] Login succeeds with new account
- [ ] Dashboard displays correctly
- [ ] Sidebar navigation works
- [ ] All protected routes require auth
- [ ] Unauthenticated redirect to login

### Doctor Mobile Phase
- [ ] `npm run doctor:start` starts
- [ ] Expo app builds without errors
- [ ] Doctor signup visible (separate)
- [ ] Rejecting patient login for doctor role
- [ ] Doctor dashboard loads

### Integration Phase
- [ ] Both apps use same Supabase database
- [ ] Patient data appears in doctor app
- [ ] Role isolation enforced
- [ ] Offline data syncs when online (future)

---

## 🚀 Deployment

### Patient Web → Vercel

```bash
# Build
npm run patient:build

# Deploy
cd apps/patient-web
vercel
```

**Environment Variables on Vercel:**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Doctor Mobile → App Store/Play Store

```bash
# Android
cd apps/doctor-mobile
eas build --platform android

# iOS
eas build --platform ios
```

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module '@smileguard/shared-types'"
**Solution:**
```bash
# Ensure workspaces are installed
npm install

# Check tsconfig.json has correct paths
# Restart IDE TypeScript server
```

### Issue: "Supabase connection failed"
**Solution:**
```bash
# Verify .env.local exists and has values
cat apps/patient-web/.env.local

# Check credentials in Supabase dashboard
https://supabase.com/dashboard
```

### Issue: "Role mismatch - cannot access patient dashboard as doctor"
**Solution:**
```typescript
// Check user metadata has role set
const { data: { user } } = await supabase.auth.getUser()
console.log(user.user_metadata.role)  // Should be 'patient' or 'doctor'
```

### Issue: "Cannot find Expo binary"
**Solution:**
```bash
# Install globally
npm install -g expo-cli

# Or use npx
npx expo start
```

---

## 📊 Progress Tracking

| Phase | Task | Status | ETA |
|-------|------|--------|-----|
| 1 | Monorepo setup | ✅ Done | - |
| 2 | Patient-web foundation | ✅ Done | - |
| 3 | Auth flows | ✅ Done | - |
| 4 | Dashboard scaffolding | ✅ Done | - |
| 5 | Service layer | ⏳ Next | Week 1 |
| 6 | Dashboard implementation | ⏳ Next | Week 2 |
| 7 | AI integration | ⏳ Next | Week 3 |
| 8 | Doctor mobile migration | ⏳ Next | Week 1-2 |
| 9 | Offline sync | ⏳ Later | Week 4 |
| 10 | Deployment | ⏳ Later | Week 5 |

---

## 📞 Support & Documentation

**Files to Read:**
- `MONOREPO_SETUP.md` — Architecture overview
- `PATIENT_WEB_TODO.md` — All requirements
- `DEPENDENCY_AUDIT.md` — Packages & versions
- `README.md` — Project overview

**External Resources:**
- [Next.js 14 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [React 19 Docs](https://react.dev)
- [Expo Docs](https://docs.expo.dev)
- [Tailwind CSS](https://tailwindcss.com)

---

## ✅ Implementation Readiness

**Status: 🟢 READY TO BUILD**

All infrastructure is in place. The next developer can:
1. Run `npm install`
2. Start working on service layer
3. Connect dashboard pages to real data
4. Deploy without major refactoring

**Estimated Feature Completion:**
- Appointments: 3 days
- Billing: 2 days
- AI Analysis: 1 week (depends on ML model)
- Complete Portal: 2-3 weeks

---

**Project Lead Notes:**
- ✅ Clean separation between patient and doctor
- ✅ Shared code reduces duplication
- ✅ All credentials pre-configured
- ✅ Role-based security enforced
- ✅ Ready for team handoff

**Next Meeting Agenda:**
1. Confirm deployment strategy
2. Assign service layer development
3. Discuss AI model selection
4. Plan payment gateway integration

---

*This document is the source of truth for SmileGuard architecture and implementation status. Update weekly.*
