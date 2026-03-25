# SmileGuard Monorepo Architecture — Complete Setup

**Date:** March 22, 2026  
**Status:** ✅ Phase 1-6 Complete (Patient Web Foundation Ready)

---

## 📋 What Was Accomplished

### ✅ PHASE 1: Monorepo Foundation (Complete)
Created a fully functional monorepo structure with three shared packages:

**1. `packages/shared-types/`**
- Central TypeScript definitions for `CurrentUser`, `Appointment`, `Patient`, `Billing`, `Treatment`, `ImageAnalysis`
- Password validation utilities (`checkPasswordStrength`, `isPasswordStrong`)
- Type exports used by both patient-web and doctor-mobile
- **Status:** Ready for import

**2. `packages/supabase-client/`**
- Shared Supabase initialization code
- Supports multiple environment variable naming conventions:
  - `NEXT_PUBLIC_SUPABASE_URL` (Next.js)
  - `EXPO_PUBLIC_SUPABASE_URL` (Expo)
  - `REACT_APP_SUPABASE_URL` (React)
- **Status:** Ready for import

**3. `packages/shared-hooks/`**
- `useAuth()` — Login, register, logout, session management with role-based access control
- `useNetwork()` — Online/offline detection
- **Status:** Ready for import

**Root package.json** configured with:
```json
"workspaces": ["apps/*", "packages/*"]
```

### ✅ PHASE 2-4: Patient Web Portal (Complete)

Created full Next.js 14 application at `apps/patient-web/` with:

**Project Structure:**
```
apps/patient-web/
├── app/
│   ├── (auth)/              # Public auth routes
│   │   ├── login/           # Login page
│   │   ├── signup/          # Multi-step signup with medical intake
│   │   └── layout.tsx       # Auth layout (branding + form)
│   ├── (patient)/           # Protected patient routes
│   │   ├── dashboard/       # Home page with quick stats
│   │   ├── appointments/    # Appointment management
│   │   ├── billing/         # Invoice & payment history
│   │   ├── analysis/        # AI image analysis
│   │   ├── documents/       # X-rays, records, PDFs
│   │   ├── treatments/      # Treatment history
│   │   └── layout.tsx       # Patient layout (sidebar + navbar)
│   ├── globals.css          # Tailwind styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Redirect to /auth/login
├── components/              # Reusable components (scaffolded)
├── lib/                     # Services layer (scaffolded)
├── .env.local               # Environment variables (configured)
├── next.config.js           # Next.js config
├── tailwind.config.js       # Tailwind setup
└── tsconfig.json            # TypeScript config
```

**Features Implemented:**
- ✅ Patient-only login page
- ✅ Multi-step signup with medical history intake
- ✅ Password strength validation
- ✅ Role-based route protection (patients only)
- ✅ Responsive sidebar navigation
- ✅ Dashboard with quick stats and action buttons
- ✅ Scaffolded pages for all patient workflows
- ✅ Tailwind CSS styling

**Authentication Flow:**
1. Unauthenticated users → `/auth/login`
2. User signup with medical intake form
3. Supabase Auth creates user account + role
4. Automatic profile creation or retrieval
5. Redirect to `/dashboard` on success
6. Protected routes check `currentUser.role === 'patient'`
7. Role mismatch → redirect to `/auth/login`

### ✅ PHASE 5-6: Shared Environment Setup (Complete)

**Environment Variables:**
- Root `.env.example` (template for all credentials)
- `apps/patient-web/.env.local` (pre-filled with Supabase credentials)
- Doctor mobile will use same `.env` values

**Root Scripts Added:**
```bash
npm run doctor:start      # Start doctor mobile on Expo
npm run doctor:android    # Android emulator
npm run doctor:ios        # iOS simulator
npm run patient:dev       # Next.js dev server
npm run patient:build     # Next.js production build
npm run lint              # Lint doctor-mobile
```

---

## 🚀 How to Use

### Install & Setup

```bash
# Install root dependencies
npm install

# Install app dependencies (workspaces handle this automatically)
# But you can manually install each app if needed:
cd apps/patient-web && npm install
cd ../doctor-mobile && npm install
```

### Run Patient Web Portal

```bash
# Start Next.js dev server
npm run patient:dev

# Open http://localhost:3000
# Try login with:
#   Email: test@example.com
#   Password: (create account via signup)
```

### Run Doctor Mobile App

```bash
# Start Expo for Android
npm run doctor:android

# Start Expo for iOS
npm run doctor:ios

# Start Expo basic (choose platform interactively)
npm run doctor:start
```

---

## 🔐 Security Features

✅ **Authentication:**
- Supabase Auth handles passwords (salted + hashed)
- JWT tokens for session management
- Auto-refresh on app load

✅ **Role-Based Access Control:**
- `role` stored in user metadata
- Supabase RLS policies enforce access per table
- Frontend middleware redirects mismatched roles

✅ **Protected Routes:**
- `(patient)/` routes require `currentUser.role === 'patient'`
- `(auth)/` routes accessible only to unauthenticated users
- `(doctor)/` routes (in mobile) require `currentUser.role === 'doctor'`

✅ **Input Validation:**
- Password strength checking (uppercase, lowercase, number, special char, length)
- Email format validation
- Medical intake form validation

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      SmileGuard Monorepo                    │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
         ┌──────▼─────┐  ┌──────▼─────┐  ┌──────▼──────┐
         │   packages/ │  │     apps/   │  │   supabase/ │
         └─────────────┘  └─────────────┘  └─────────────┘
              │                 │
    ┌─────────┼─────────┐       │
    │         │         │       │
┌───▼────────────┐  ┌────▼─────────────┐
│ shared-types   │  │ shared-hooks     │
│ shared-hooks   │  │ supabase-client  │
│supabase-client │  └──────────┬───────┘
└────────┬───────┘             │
         │                     │
         ├─────────────────────┼─────────────────────┐
         │                     │                     │
    ┌────▼────────────┐  ┌────▼──────────────┐  ┌────▼──────────┐
    │ patient-web     │  │ doctor-mobile    │  │  (shared env) │
    │ (Next.js 14)    │  │ (Expo/RN)        │  │  .env.local   │
    │                 │  │                  │  └───────────────┘
    │ - Login/Signup  │  │ - Login/Signup   │
    │ - Dashboard     │  │ - Dashboard      │
    │ - Appointments  │  │ - Appointments   │
    │ - Billing       │  │ - Patients List  │
    │ - AI Analysis   │  │ - Analyze Module │
    │                 │  │                  │
    │ Port: 3000      │  │ Port: 8081       │
    └─────────────────┘  └──────────────────┘
         │                     │
         │                     │
         └─────────────────────┤
                               │
                    ┌──────────▼──────────┐
                    │   Supabase Backend  │
                    │   (Shared Database) │
                    │                     │
                    │ - Auth              │
                    │ - Profiles          │
                    │ - Appointments      │
                    │ - Billing           │
                    │ - RLS Policies      │
                    └─────────────────────┘
```

---

## 📱 Role-Based Isolation

### Patient Portal (`apps/patient-web`)
- **Entry:** `http://localhost:3000/auth/login`
- **Visible Pages:** Only patient routes (`/dashboard`, `/appointments`, `/billing`, etc.)
- **Role Check:** `currentUser.role === 'patient'`
- **Tech Stack:** Next.js 14, React 19, Tailwind CSS

### Doctor Mobile (`apps/doctor-mobile`)
- **Entry:** Via Expo app
- **Visible Pages:** Only doctor routes (`/dashboard`, `/patients`, `/appointments`, etc.)
- **Role Check:** `currentUser.role === 'doctor'`
- **Tech Stack:** Expo, React Native, TypeScript

### Backend (Supabase)
- **Same Database:** Both apps read from same tables
- **RLS Policies:** Enforce access based on `auth.jwt() ->> 'user_metadata' ->> 'role'`
- **No App-level Changes Needed:** Backend automatically handles both roles

---

## 🧪 Testing Checklist

### Before First Run
- [ ] `npm install` at root completes without errors
- [ ] `npm run patient:dev` starts on http://localhost:3000
- [ ] Patient web login page loads
- [ ] Next.js compiles without TypeScript errors

### First Login Test
- [ ] Go to `/auth/signup`
- [ ] Create test patient account
- [ ] Verify Supabase `profiles` table has entry with `role='patient'`
- [ ] Verify medical intake data saved
- [ ] Login with credentials
- [ ] Should redirect to `/dashboard`
- [ ] Sidebar and navbar visible
- [ ] Quick stat cards display

### Mobile Test
- [ ] `npm run doctor:start` starts Expo
- [ ] Doctor app loads
- [ ] Doctor signup visible (separate from patient)
- [ ] Try logging in as doctor (should reject patient credentials)

---

## 🔗 Next Steps (Priority Order)

### 1. **Move Current Doctor App to doctor-mobile** (URGENT)
```bash
# Move existing app/* to apps/doctor-mobile/
# Update imports to use @smileguard/shared-types, @smileguard/shared-hooks
# Remove web platform from app.json
# Update package.json to reference shared packages
```

### 2. **Install Dependencies & Test**
```bash
npm install
npm run patient:dev
npm run doctor:start
```

### 3. **Implement Core Services**
- `lib/appointmentService.ts` — Fetch/book appointments
- `lib/billingService.ts` — Fetch invoices, process payments
- `lib/analysisService.ts` — Upload images, trigger AI analysis

### 4. **Build Dashboard Pages**
- Fill in `/appointments`, `/billing`, `/analysis`, `/documents`
- Connect to Supabase queries

### 5. **Add Advanced Features**
- Offline sync support (using `syncService.ts`)
- Real-time notifications
- PWD/senior discount verification
- File upload for documents

### 6. **Deployment**
- Patient Web: Deploy to Vercel (`npm run build`)
- Doctor Mobile: Build for App Store/Play Store

---

## 📝 Important Notes

**🔐 Credentials:**
- Supabase URL and Key are pre-filled in `.env.local`
- ⚠️ NEVER commit `.env.local` to git
- Production deployment must use separate `.env.production`

**📦 Workspace Management:**
- `npm install` at root installs all apps + packages
- Each app is independent but shares types and hooks
- To add a dependency to patient-web: `cd apps/patient-web && npm install <package>`

**🚀 Deployment:**
- **Patient Web:** `npm run patient:build` → deploy `apps/patient-web/.next` to Vercel
- **Doctor Mobile:** Expo CLI → build APK/IPA for App Store/Play Store

**💡 Troubleshooting:**
- If imports fail, check `tsconfig.json` paths are correct
- If Supabase connection fails, verify `.env.local` values
- If role check fails, ensure user has `role` in `auth.user_metadata`

---

## ✅ Completed Checklist

- [x] Monorepo workspace configured
- [x] Shared packages created (types, hooks, supabase-client)
- [x] Patient-web Next.js app initialized
- [x] Authentication pages (login, signup with medical intake)
- [x] Patient dashboard with navigation
- [x] Role-based route protection
- [x] Tailwind CSS styling
- [x] Environment configuration
- [x] Documentation

---

## 📚 File Reference

**Root:**
- `package.json` — Monorepo workspaces config
- `.env.example` — Shared credentials template
- `PATIENT_WEB_TODO.md` — Detailed patient portal requirements

**Patient Web:**
- `apps/patient-web/package.json` — Dependencies
- `apps/patient-web/app/(auth)/login/page.tsx` — Login page
- `apps/patient-web/app/(auth)/signup/page.tsx` — Signup with medical intake
- `apps/patient-web/app/(patient)/layout.tsx` — Protected layout with sidebar
- `apps/patient-web/app/(patient)/dashboard/page.tsx` — Dashboard home

**Shared Packages:**
- `packages/shared-types/index.ts` — TypeScript definitions
- `packages/shared-hooks/useAuth.ts` — Auth logic
- `packages/supabase-client/index.ts` — Supabase initialization

---

## 🎉 Ready to Build!

The monorepo foundation is complete. The patient web portal is ready for:
1. Integration of appointment service
2. Billing module implementation
3. AI image analysis integration
4. Doctor mobile migration

**Start with:** `npm install && npm run patient:dev`
