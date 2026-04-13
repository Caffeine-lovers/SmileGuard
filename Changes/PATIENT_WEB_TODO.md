# Patient Web Portal — Complete Requirements & TODO

## 📌 Project Overview
- **Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, React 19
- **Backend:** Shared Supabase (same database as doctor-mobile)
- **Scope:** Patient-only portal — no doctor UI visible
- **Auth:** Patient login modal only (no doctor access codes)

---

## 🏗️ Architecture & Setup

### Monorepo Structure
```
smileguard/
├── apps/
│   ├── patient-web/              # Next.js 14 web app
│   │   ├── app/
│   │   │   ├── (auth)/           # Auth pages (guest only)
│   │   │   ├── (patient)/        # Patient pages (protected)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   └── doctor-mobile/            # Expo (this project, mobile only)
│       └── package.json
├── packages/
│   ├── shared-types/             # Common TypeScript types
│   │   └── index.ts
│   ├── shared-hooks/             # useAuth, useSync, etc.
│   │   ├── useAuth.ts
│   │   ├── useNetwork.ts
│   │   └── index.ts
│   └── supabase-client/          # Supabase initialization
│       ├── index.ts
│       └── package.json
└── supabase/                     # Backend (no changes needed)
    ├── setup.sql
    └── functions/
```

### 🎯 Role-Based Entry Logic
- **Patient Web** (`/apps/patient-web`):
  - Detects role from session
  - If `role !== 'patient'` → redirect to doctor portal (separate URL)
  - Only shows patient signup/login
  
- **Doctor Mobile** (`/apps/doctor-mobile`):
  - Detects role from session
  - If `role !== 'doctor'` → redirect to patient portal (separate URL)
  - Only shows doctor signup/login
  
- **Backend (Supabase):**
  - Same database, RLS policies enforce access by role
  - No app-level changes needed

---

## 📋 PHASE 1: Setup & Infrastructure

### 1.1 Monorepo Foundation
- [ ] Create `packages/shared-types/` directory
  - [ ] Export `Appointment`, `Patient`, `User`, `Billing`, `Treatment` types
  - [ ] Create `index.ts` barrel export
  
- [ ] Create `packages/shared-hooks/` directory
  - [ ] Export `useAuth.ts` (adapted from doctor-mobile)
  - [ ] Export `useNetwork.ts` (online/offline detection)
  - [ ] Export `useSyncService.ts` (offline transaction sync)
  - [ ] Create `index.ts` barrel export
  
- [ ] Create `packages/supabase-client/` directory
  - [ ] Export Supabase client initialization
  - [ ] Read from shared `.env` file
  - [ ] Create `index.ts` barrel export
  
- [ ] Create shared `.env.example` at root
  - [ ] `SUPABASE_URL=https://yffvnvusiazjnwmdylji.supabase.co`
  - [ ] `SUPABASE_ANON_KEY=...`

### 1.2 Patient Web Setup
- [ ] Initialize Next.js 14 project in `apps/patient-web/`
  - [ ] TypeScript enabled
  - [ ] Tailwind CSS configured
  - [ ] App Router (not Pages Router)
  
- [ ] Configure `tsconfig.json`
  - [ ] `@/*` alias for `src/` (or app directory)
  - [ ] Path aliases for `@/packages/*` if using monorepo workspaces
  
- [ ] Create `.env.local` pointing to shared Supabase
  - [ ] Copy from root `.env.example`

### 1.3 Doctor Mobile Migration
- [ ] Remove web platform from `app.json`
  - [ ] Delete `web` entry from `expo` → `plugins`
  - [ ] Remove `@react-native-web` from dependencies
  
- [ ] Update `package.json` to reference shared packages
  - [ ] `"@smileguard/shared-types": "workspace:*"`
  - [ ] `"@smileguard/shared-hooks": "workspace:*"`
  - [ ] `"@smileguard/supabase-client": "workspace:*"`
  
- [ ] Move `lib/supabase.ts` to `packages/supabase-client/`
- [ ] Update imports in doctor-mobile to use shared packages

---

## 🔐 PHASE 2: Authentication (Patient-Only)

### 2.1 Patient Login Page
- [ ] Create `apps/patient-web/app/(auth)/login/page.tsx`
  - [ ] Email input
  - [ ] Password input
  - [ ] "Forgot Password?" link
  - [ ] "Sign Up" link
  - [ ] Submit button with loading state
  - [ ] Error message display
  - [ ] Styling: Tailwind, responsive mobile-first
  
### 2.2 Patient Signup Page
- [ ] Create `apps/patient-web/app/(auth)/signup/page.tsx`
  - [ ] Multi-step form (optional):
    - [ ] Step 1: Service selection (General, Cleaning, Whitening, Aligners, etc.)
    - [ ] Step 2: Personal info (name, email, phone, DOB)
    - [ ] Step 3: Medical history (conditions, allergies)
    - [ ] Step 4: Password + confirm
  - [ ] Form validation with error states
  - [ ] Submit button with loading state
  - [ ] Success screen → redirect to login
  
### 2.3 Reset Password Flow
- [ ] Create `apps/patient-web/app/(auth)/reset-password/page.tsx`
  - [ ] Email input → sends reset link
  - [ ] Confirmation message
  - [ ] Create `apps/patient-web/app/(auth)/reset-password/[token]/page.tsx`
    - [ ] New password input + confirm
    - [ ] Validation, submit, success redirect

### 2.4 Session Management
- [ ] Create `lib/auth.ts` (Next.js auth utilities)
  - [ ] `useAuth()` hook — wraps shared `@smileguard/shared-hooks/useAuth`
  - [ ] `getSession()` — server-side session check
  - [ ] `getCurrentUser()` — client-side user state
  
- [ ] Create middleware for route protection
  - [ ] Redirect unauthenticated users to `/login`
  - [ ] Redirect authenticated users away from `/login`
  - [ ] Check `role === 'patient'` (reject doctors)

### 2.5 Referral Code Entry (Onboarding)
- [ ] Create `apps/patient-web/app/(auth)/referral/page.tsx`
  - [ ] Ask: "Do you have a clinic referral code?"
  - [ ] Optional code input
  - [ ] If code provided:
    - [ ] Call Edge Function `verify-referral-code`
    - [ ] Load clinic info → display to patient
    - [ ] Save clinic reference to patient profile
  - [ ] Skip button → go to dashboard

---

## 📊 PHASE 3: Patient Dashboard & Core Pages

### 3.1 Dashboard Layout
- [ ] Create `apps/patient-web/app/(patient)/layout.tsx`
  - [ ] Sidebar navigation (collapsible on mobile)
  - [ ] Top navbar with user menu + logout
  - [ ] Breadcrumbs
  - [ ] Responsive design

### 3.2 Dashboard Home Page
- [ ] Create `apps/patient-web/app/(patient)/page.tsx`
  - [ ] Welcome message
  - [ ] Quick stats:
    - [ ] Upcoming appointment count
    - [ ] Pending treatments
    - [ ] Outstanding balance
  - [ ] Recent appointment card (if exists)
  - [ ] Quick action buttons:
    - [ ] "Book New Appointment"
    - [ ] "View AI Analysis"
    - [ ] "Pay Bill"

### 3.3 Appointments Module
- [ ] Create `apps/patient-web/app/(patient)/appointments/page.tsx`
  - [ ] Appointment list (upcoming + past)
  - [ ] Filter: Status (scheduled, completed, cancelled)
  - [ ] Sort: Date (newest/oldest)
  - [ ] Each appointment card shows:
    - [ ] Clinic name
    - [ ] Service
    - [ ] Date & time
    - [ ] Status badge
    - [ ] "Reschedule" button (if applicable)
    - [ ] "Cancel" button (if applicable)
  
- [ ] Create `apps/patient-web/app/(patient)/appointments/book/page.tsx`
  - [ ] Clinic/dentist dropdown (load from Supabase)
  - [ ] Service dropdown
  - [ ] Date picker (prevent past dates)
  - [ ] Time slot grid (fetch available slots)
  - [ ] Notes/special requests textarea
  - [ ] "Confirm Booking" button
  - [ ] Success confirmation screen
  
- [ ] Create `apps/patient-web/app/(patient)/appointments/[id]/page.tsx`
  - [ ] Full appointment details
  - [ ] Reschedule form (if status = scheduled)
  - [ ] Cancellation with fee warning (if policy exists)
  - [ ] Add/edit patient notes

### 3.4 Billing Module
- [ ] Create `apps/patient-web/app/(patient)/billing/page.tsx`
  - [ ] Account balance display
  - [ ] Invoice/transaction history table:
    - [ ] Date, description, amount, status
    - [ ] Download receipt button (PDF)
  - [ ] Filter: Status (paid, pending, overdue)
  
- [ ] Create `apps/patient-web/app/(patient)/billing/pay/page.tsx`
  - [ ] Amount to pay (auto-calculated from balance)
  - [ ] Discount options:
    - [ ] PWD checkbox + upload ID
    - [ ] Senior citizen checkbox + upload ID
    - [ ] Insurance code input
  - [ ] Payment method dropdown:
    - [ ] Credit card (Stripe integration)
    - [ ] Debit card
    - [ ] GCash (optional)
    - [ ] Bank transfer
  - [ ] Process payment with loading/error states
  - [ ] Payment confirmation screen
  
- [ ] Create `apps/patient-web/app/(patient)/billing/[invoiceId]/page.tsx`
  - [ ] Invoice detail view with print option

### 3.5 AI Analysis / Image Upload
- [ ] Create `apps/patient-web/app/(patient)/analysis/page.tsx`
  - [ ] Image upload zone (drag & drop)
  - [ ] Accepted formats: JPG, PNG, GIF
  - [ ] File size validation (max 10MB)
  - [ ] "Analyze Now" button
  - [ ] Loading spinner during analysis
  - [ ] Recent analysis results list:
    - [ ] Date, image thumbnail, status
    - [ ] Detection summary (cavities, gingivitis, etc.)
    - [ ] View result button
  
- [ ] Create `apps/patient-web/app/(patient)/analysis/[id]/page.tsx`
  - [ ] Full analysis detail:
    - [ ] Original image
    - [ ] Annotated image (with markers)
    - [ ] Detection list (with confidence %)
    - [ ] AI recommendations
    - [ ] Share with dentist button
    - [ ] Add clinical notes button

### 3.6 Treatment History
- [ ] Create `apps/patient-web/app/(patient)/treatments/page.tsx`
  - [ ] Tabs: Ongoing, Completed, Pending
  - [ ] Each treatment shows:
    - [ ] Procedure name
    - [ ] Start/end date
    - [ ] Status
    - [ ] Dentist name
    - [ ] View details button
  
- [ ] Create `apps/patient-web/app/(patient)/treatments/[id]/page.tsx`
  - [ ] Full treatment details
  - [ ] Clinical notes from dentist
  - [ ] Associated images/X-rays
  - [ ] Outcomes

### 3.7 Documents & Records
- [ ] Create `apps/patient-web/app/(patient)/documents/page.tsx`
  - [ ] Categories:
    - [ ] Radiographs (X-rays)
    - [ ] Photos
    - [ ] Consent forms
    - [ ] Prescriptions
  - [ ] File grid/list view
  - [ ] Upload button
  - [ ] Download/view buttons
  - [ ] Share with clinic button
  
- [ ] Upload handler
  - [ ] Drag & drop support
  - [ ] Type validation
  - [ ] File size limit
  - [ ] Progress bar
  - [ ] Success notification

---

## ⚙️ PHASE 4: Services & API Integration

### 4.1 Appointments Service
- [ ] `apps/patient-web/lib/appointmentService.ts`
  - [ ] `getAppointments()` — fetch patient's appointments
  - [ ] `getAvailableSlots(date)` — fetch available time slots
  - [ ] `bookAppointment()` — create new appointment
  - [ ] `rescheduleAppointment(id, newDate, newTime)` — modify appointment
  - [ ] `cancelAppointment(id, reason)` — cancel with reason
  - [ ] Offline support: queue operations if offline

### 4.2 Billing Service
- [ ] `apps/patient-web/lib/billingService.ts`
  - [ ] `getBalance()` — patient's outstanding balance
  - [ ] `getInvoices()` — fetch transaction history
  - [ ] `getDiscount(type, documentId?)` — verify PWD/senior/insurance
  - [ ] `processPayment(amount, method, discountType?)` — initiate payment
  - [ ] `getPaymentStatus(transactionId)` — check payment completion

### 4.3 AI Analysis Service
- [ ] `apps/patient-web/lib/analysisService.ts`
  - [ ] `uploadImage(file)` — upload to storage
  - [ ] `analyzeImage(imageId)` — trigger Edge Function
  - [ ] `getAnalysisResult(imageId)` — fetch result with detections
  - [ ] `listAnalyses()` — patient's analysis history
  - [ ] `shareWithDentist(analysisId, dentistId)` — grant access

### 4.4 Treatment Service
- [ ] `apps/patient-web/lib/treatmentService.ts`
  - [ ] `getTreatments(filter?)` — fetch by status
  - [ ] `getTreatmentDetail(id)` — full treatment with notes

### 4.5 Sync Service (Offline Support)
- [ ] Use shared `@smileguard/shared-hooks/useSyncService`
- [ ] Queue unsent bookings, cancellations, etc.
- [ ] Auto-sync when connection resumes
- [ ] Toast notifications for sync events

---

## 🎨 PHASE 5: UI Components & Styling

### 5.1 Reusable Components
- [ ] `components/Button.tsx` — primary/secondary/danger
- [ ] `components/Input.tsx` — text, email, password, tel
- [ ] `components/DatePicker.tsx` — calendar widget
- [ ] `components/TimePicker.tsx` — slot selection
- [ ] `components/Modal.tsx` — confirm dialogs
- [ ] `components/Card.tsx` — appointment/invoice cards
- [ ] `components/Badge.tsx` — status badges
- [ ] `components/Alert.tsx` — success/error/warning messages
- [ ] `components/Loading.tsx` — spinners, skeletons
- [ ] `components/FileUpload.tsx` — drag & drop upload

### 5.2 Form Components
- [ ] `components/forms/AppointmentForm.tsx`
- [ ] `components/forms/PaymentForm.tsx`
- [ ] `components/forms/ReferralCodeForm.tsx`
- [ ] `components/forms/DiscountDocumentForm.tsx`

### 5.3 Layout Components
- [ ] `components/Sidebar.tsx` — navigation menu
- [ ] `components/Navbar.tsx` — top bar with user menu
- [ ] `components/ProtectedLayout.tsx` — auth boundary wrapper

### 5.4 Styling
- [ ] Tailwind config (colors, spacing, breakpoints)
- [ ] Global CSS variables
- [ ] Responsive breakpoints: mobile (375px), tablet (768px), desktop (1024px)

---

## 🔗 PHASE 6: Supabase Integration & RLS

### 6.1 Row-Level Security (RLS) Policies
- [ ] `profiles` table: Patients see only their own
- [ ] `appointments` table: Patients see only their own appointments
- [ ] `medical_intake` table: Patients see only their own records
- [ ] `billing` table: Patients see only their own invoices
- [ ] `treatments` table: Patients see only treatments assigned to them
- [ ] `image_analyses` table: Patients see only their own uploads

### 6.2 Edge Functions (if needed)
- [ ] `verify-referral-code` — check if code is valid + return clinic
- [ ] `process-payment` — Stripe integration, update billing status
- [ ] `analyze-dental-image` — call ML model (external API)
- [ ] `send-notification` — email/SMS to patient

### 6.3 Database Triggers
- [ ] Auto-create `billing` record when appointment status changes
- [ ] Auto-update `balance` when payment received
- [ ] Auto-delete `image_analyses` after 90 days (configurable)

---

## 🧪 PHASE 7: Testing & QA

### 7.1 Unit Tests
- [ ] `lib/appointmentService.test.ts`
- [ ] `lib/billingService.test.ts`
- [ ] `components/Button.test.tsx`

### 7.2 Integration Tests
- [ ] Auth flow (signup → login → dashboard)
- [ ] Appointment booking (available slots → confirmation)
- [ ] Payment processing

### 7.3 E2E Tests (Cypress/Playwright)
- [ ] Full patient journey

### 7.4 Manual Testing
- [ ] Mobile responsive (375px, 768px, 1024px)
- [ ] Offline scenario (book appointment, go offline, reconnect)
- [ ] Payment errors + retry
- [ ] Session expiry + login prompt

---

## 🚀 PHASE 8: Deployment & DevOps

### 8.1 Build & Deployment
- [ ] Vercel deployment for `patient-web`
- [ ] Docker multi-stage build (optional)
- [ ] Environment variables for staging/production

### 8.2 Monitoring
- [ ] Sentry for error tracking
- [ ] LogRocket for user session replay
- [ ] Supabase analytics dashboard

### 8.3 Documentation
- [ ] Patient portal user guide (help docs)
- [ ] API docs (if publishing API)
- [ ] Developer setup guide (for handoff)

---

## 🔒 Security Checklist

- [ ] `.env` files never committed
- [ ] Supabase credentials in environment variables only
- [ ] No hardcoded API keys in code
- [ ] HTTPS enforced
- [ ] CORS configured properly
- [ ] Rate limiting on payment endpoints
- [ ] Input validation on all forms
- [ ] XSS protection (React auto-escapes, but check markdown rendering)
- [ ] CSRF tokens if using forms (Next.js handles this)
- [ ] File upload validation (type, size, scan for malware)
- [ ] PII logging disabled in production
- [ ] Session timeout after 30 mins inactivity

---

## 🐛 Known Issues & TODOs
- [ ] AI image analysis model not yet selected (TensorFlow.js, AWS Rekognition, custom)
- [ ] Payment gateway not yet integrated (Stripe, PayMongo, GCash)
- [ ] SMS notifications not configured
- [ ] Real-time notifications (WebSocket or polling)
- [ ] Doctor referral system incomplete (Edge Function needed)

---

## 📅 Milestone Timeline (Estimate)
- **Week 1:** Phases 1-2 (Monorepo setup + Auth)
- **Week 2:** Phase 3 (Dashboard pages)
- **Week 3:** Phase 4 (Services + API)
- **Week 4:** Phase 5 (UI Polish) + Phase 6 (Supabase RLS)
- **Week 5:** Phase 7 (Testing) + Phase 8 (Deployment)

