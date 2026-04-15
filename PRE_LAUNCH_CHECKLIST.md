# SmileGuard Pre-Launch Validation Checklist

**Last Updated:** April 15, 2026  
**Status:** 🟡 **Ready for Testing Infrastructure Setup**

This checklist ensures SmileGuard is production-ready before launch. Work through each section systematically.

---

## 🚀 Quick Start: Running Tests

```bash
# 1. Install test dependencies
pnpm install -w

# 2. Run all unit tests
pnpm test

# 3. Run tests in watch mode (auto-rerun on changes)
pnpm test:watch

# 4. Generate coverage report
pnpm test:coverage

# 5. Run type checking across all apps
pnpm type-check

# 6. Run linting
pnpm lint
```

---

## Phase 1: Code Quality Validation ✅

### Unit Tests (Automated)

**Status:** 🆕 NEWLY CREATED

Tests now available in `packages/tests/src/unit/`:

- [ ] **types.test.ts** — Verify shared types are correct
  ```bash
  pnpm test -- types.test.ts
  ```
  Tests:
  - ✓ PWD discount calculation (20% applied)
  - ✓ Senior citizen discount (20% applied)
  - ✓ No discount when type='none'
  - ✓ Billing object structure validation
  - ✓ Appointment status enum enforcement
  - ✓ User role validation (patient|doctor)

- [ ] **services.test.ts** — Verify service logic
  ```bash
  pnpm test -- services.test.ts
  ```
  Tests:
  - ✓ Appointment date/time parsing (YYYY-MM-DD, HH:MM format)
  - ✓ Double-booking detection
  - ✓ Available slots calculation
  - ✓ Password strength validation
  - ✓ Email format validation
  - ✓ Payment method validation
  - ✓ Data validation for booking

### Integration Tests (Simulated)

**Status:** 🆕 NEWLY CREATED

Tests in `packages/tests/src/integration/critical-paths.test.ts`:

Critical paths being tested (simulated, not hitting real DB):

- [ ] **Patient Signup → Login → Dashboard**
  - ✓ Auth user creation
  - ✓ Profile creation in database
  - ✓ Duplicate email prevention
  - ✓ Password strength enforcement
  - ✓ Profile fetch after login
  - ✓ Dashboard renders with user data

- [ ] **Patient Books Appointment**
  - ✓ Fetch available slots
  - ✓ Book appointment with valid data
  - ✓ Double-booking prevention
  - ✓ Confirmation display
  - ✓ Slots list updates

- [ ] **Payment Processing**
  - ✓ Fetch billing information
  - ✓ Apply PWD/senior discounts
  - ✓ Process payment with valid method
  - ✓ Reject invalid payment methods
  - ✓ Update billing status

- [ ] **Doctor Views Appointments**
  - ✓ Fetch clinic appointments
  - ✓ Prevent cross-clinic access (RLS check)
  - ✓ Show patient details
  - ✓ Update appointment status

### Type Checking

- [ ] Run TypeScript type-check across all apps
  ```bash
  pnpm type-check
  ```
  Expected: ✓ Zero TypeScript errors

- [ ] Check patient-web types
  ```bash
  cd apps/patient-web && npm run type-check
  ```
  Expected: ✓ Success

- [ ] Add type-check to doctor-mobile
  ```bash
  cd apps/doctor-mobile && npx tsc --noEmit
  ```
  Expected: ✓ Success (if tsconfig present)

### Linting

- [ ] Run ESLint on doctor-mobile
  ```bash
  pnpm lint
  ```
  Expected: ✓ Zero linting errors

- [ ] Add ESLint to patient-web
  ```bash
  cd apps/patient-web && npm run lint
  ```
  Expected: ✓ Should pass (or identify issues)

---

## Phase 2: Feature Integration Testing (Manual)

Work through each critical path in both apps. **Do not skip steps**.

### 2a. Patient Web - Authentication

- [ ] **Sign Up (New Patient)**
  1. Visit http://localhost:3000/signup
  2. Enter: name, email, password (strong: 8+ chars, upper, lower, number)
  3. Fill medical history form
  4. Click "Sign Up"
  5. ✅ Verify: Redirected to dashboard
  6. ✅ Verify: Your name appears in dashboard header
  7. ✅ Verify: Supabase `profiles` table has new row with correct role='patient'

- [ ] **Login (Existing Patient)**
  1. Visit http://localhost:3000/login
  2. Enter: email and password from signup
  3. Click "Sign In"
  4. ✅ Verify: Redirected to dashboard
  5. ✅ Verify: Your name appears in dashboard header
  6. ✅ Verify: Session persists (refresh page → still logged in)

- [ ] **Logout**
  1. Click logout button
  2. ✅ Verify: Redirected to login page
  3. ✅ Verify: Accessing /dashboard → redirects back to /login
  4. ✅ Verify: No auth token in localStorage

- [ ] **Password Reset**
  1. On login page, click "Forgot Password"
  2. Enter email
  3. ✅ Verify: Success message shown
  4. Check email for reset link (may be in test mailbox)
  5. ✅ If link works: Can set new password and login

- [ ] **Weak Password Rejection**
  1. Try signup with password: "weak"
  2. ✅ Verify: Error message shown ("Password too weak" or similar)

- [ ] **Duplicate Email Prevention**
  1. Sign up with email: test@example.com
  2. Try sign up again with same email
  3. ✅ Verify: Error message shown ("Email already exists" or similar)

### 2b. Patient Web - Appointment Booking

- [ ] **View Available Slots**
  1. Click "Book Appointment" from dashboard
  2. Select date (e.g., tomorrow)
  3. ✅ Verify: List of available times appears (14 total slots normally)
  4. ✅ Verify: Each slot shows time (09:00, 09:30, etc.)
  5. ✅ Verify: Booked slots are disabled/grayed out

- [ ] **Book Appointment Successfully**
  1. Select service type (e.g., "Cleaning")
  2. Select date
  3. Select available time slot
  4. Click "Book"
  5. ✅ Verify: Success message appears
  6. ✅ Verify: Appointment details displayed (date, time, service)
  7. ✅ Verify: Supabase `appointments` table has new row
  8. ✅ Verify: Dashboard shows appointment in "Upcoming Appointments" section

- [ ] **Double-Booking Prevention**
  1. Try to book the same slot again immediately
  2. ✅ Verify: Error message "Slot was just taken!" or similar

- [ ] **View Appointments**
  1. From dashboard, view "My Appointments" section
  2. ✅ Verify: Shows appointment you just booked
  3. ✅ Verify: Shows correct date, time, service, status

### 2c. Patient Web - Billing & Payment

- [ ] **View Outstanding Balance**
  1. Click "Billing" from dashboard
  2. ✅ Verify: Shows outstanding balance amount (PHP ₱)
  3. ✅ Verify: Shows payment history table
  4. ✅ Verify: Shows payment methods available

- [ ] **Apply PWD/Senior Discount** (If discount logic implemented)
  1. On billing page, select "PWD" or "Senior Citizen"
  2. Upload proof document (if required)
  3. ✅ Verify: 20% discount applied to amount
  4. ✅ Verify: Final amount = original * 0.8

- [ ] **Process Payment** ⚠️ **TEST ONLY IN STAGING**
  1. Click "Pay Now" button
  2. Select payment method (GCash, Card, Bank Transfer, Cash)
  3. Complete payment flow (will vary by provider)
  4. ✅ Verify: Payment successful message
  5. ✅ Verify: Supabase `billing` table updated with payment_status='paid'
  6. ✅ Verify: Dashboard balance updated to reflect payment

- [ ] **Failed Payment Handling**
  1. Attempt payment with invalid card/GCash (use test credentials)
  2. ✅ Verify: Error message displayed (not console.error only)
  3. ✅ Verify: Transaction not recorded in database
  4. ✅ Verify: Can retry payment

### 2d. Patient Web - Image Analysis

- [ ] **Image Upload Interface**
  1. Click "Image Analysis" from dashboard
  2. Click "Upload Image"
  3. ✅ Verify: File picker opens
  4. Select dental/mouth image
  5. ✅ Verify: Image preview shown
  6. ✅ Verify: "Analyze" button enabled after upload

- [ ] **Image Analysis**
  1. Click "Analyze"
  2. ✅ Verify: Loading spinner shown
  3. ✅ Verify: After analysis completes: results displayed with detections
  4. ✅ Verify: Supabase `image_analyses` table has new row

- [ ] **Analysis History**
  1. View "Image History" section
  2. ✅ Verify: Shows all previously uploaded images
  3. ✅ Verify: Can click to view analysis details

---

### 2e. Doctor Mobile - Authentication

- [ ] **Doctor Sign In**
  1. Open doctor mobile app
  2. On login screen, tap doctor login button
  3. ✅ Verify: Patient login option NOT visible (role isolation)
  4. Enter doctor email and password
  5. ✅ Verify: Redirected to doctor dashboard
  6. ✅ Verify: "Doctor" role shown in profile, not "patient"

- [ ] **Doctor Profile Setup** (First time)
  1. after login, check if clinic setup shown
  2. ✅ Verify: Can enter clinic name, address, contact
  3. ✅ Verify: Can upload clinic photo
  4. ✅ Verify: Settings saved to `doctors` table

### 2f. Doctor Mobile - Appointments

- [ ] **View Today's Appointments**
  1. Open "Appointments" section
  2. ✅ Verify: Shows appointments for today
  3. ✅ Verify: Shows patient name, service, time
  4. ✅ Verify: Only shows appointments from doctor's clinic (RLS)

- [ ] **View Upcoming Appointments**
  1. Scroll or switch to "Upcoming" tab
  2. ✅ Verify: Shows future appointments
  3. ✅ Verify: Appointments are sorted by date/time

- [ ] **View Patient Details**
  1. Tap an appointment
  2. ✅ Verify: Patient details shown (name, email, phone)
  3. ✅ Verify: Patient medical history displayed
  4. ✅ Verify: Previous appointments listed

- [ ] **Update Appointment Status**
  1. Tap appointment → "Mark Complete" or status dropdown
  2. Select new status (Completed, Cancelled, No-Show)
  3. Click "Save"
  4. ✅ Verify: Status updated immediately
  5. ✅ Verify: Supabase `appointments` table status field updated

- [ ] **Appointment Notifications**
  1. From patient app: book new appointment
  2. ✅ Verify: Doctor app receives notification (or check notifications section)
  3. ✅ Verify: New appointment appears in doctor's list

### 2g. Doctor Mobile - Scheduling

- [ ] **Set Available Hours**
  1. Go to "Schedule" → "Add Slot"
  2. Select days (Mon-Fri)
  3. Set time range (e.g., 09:00-17:00)
  4. Click "Save"
  5. ✅ Verify: Slots saved to `clinic_rules` or `schedules` table
  6. ✅ Verify: Patient sees available times based on these slots

- [ ] **Blockout Date (Doctor Vacation)**
  1. Go to "Schedule" → "Add Blockout"
  2. Select dates (e.g., April 25-28)
  3. Click "Save"
  4. ✅ Verify: Those dates disabled for patient booking
  5. ✅ Verify: Supabase `clinic_blockout_dates` table has entries

### 2h. Cross-App Communication

- [ ] **Real-Time Sync (Patient Books → Doctor Sees)**
  1. Open patient app (patient) and doctor app (simultaneously or on separate device)
  2. Patient: Book appointment for tomorrow
  3. Doctor: Within 2 seconds, new appointment should appear ✅ (Check if real-time enabled)
  4. ⚠️ If not real-time: Doctor must refresh to see new appointment

- [ ] **RLS (Row-Level Security) Enforcement**
  1. **Patient Only Sees Own Data:**
     - Patient A logs in → should NOT see Patient B's appointments
     - Check with `select * from appointments` in Supabase console → verify RLS
  2. **Doctor Only Sees Own Clinic:**
     - Doctor A (Clinic 1) logs in → should NOT see Clinic 2's appointments
  3. **Patient Cannot Access Doctor Routes:**
     - Try manually navigating to `/doctor/dashboard` as patient → should redirect

---

## Phase 3: Error Handling & Edge Cases

### Network Errors

- [ ] **Handle Supabase Timeout**
  1. Disconnect internet while booking appointment
  2. ✅ Verify: User sees error message (not just loading forever)
  3. ✅ Verify: "Retry" button available
  4. Reconnect, click retry
  5. ✅ Verify: Booking completes successfully

- [ ] **Handle Supabase Down**
  1. Disable Supabase (simulate in dev tools)
  2. Try to login
  3. ✅ Verify: Error message shown ("Service unavailable" or similar)
  4. ✅ Verify: No infinite loading state

- [ ] **Handle Payment Network Failure**
  1. Start payment, then disconnect internet mid-process
  2. ✅ Verify: Clear error message shown
  3. ✅ Verify: Can retry without duplicate charges

### Concurrent Operations

- [ ] **Two Patients Book Same Slot Simultaneously**
  1. Verify both patients try to book 10:00 AM slot at same time
  2. ✅ Verify: One succeeds, other gets "Slot taken" error
  3. ✅ Verify: No double-booking occurs

- [ ] **Doctor Cancels While Patient Paying**
  1. Patient begins payment for appointment
  2. Simultaneously, doctor cancels appointment
  3. ✅ Verify: Graceful handling (either payment blocked or appointment shows as cancelled)

---

## Phase 4: Security Checks

- [ ] **Auth Token Validation**
  1. User logs in
  2. In browser DevTools, check localStorage for `sb-*` tokens
  3. ✅ Verify: Tokens present but not sensitive data
  4. Go to `/dashboard`
  5. ✅ Verify: Page loads (token valid)
  6. Manually delete tokens from localStorage
  7. Refresh `/dashboard`
  8. ✅ Verify: Redirected to `/login` (invalid token detected)

- [ ] **SQL Injection Prevention**
  1. Try to book appointment with injectable input:
     ```
     '; DROP TABLE appointments; --
     ```
  2. ✅ Verify: Input treated as literal string, no data lost
  3. ✅ Verify: Supabase parameterized queries prevent injection

- [ ] **XSS (Cross-Site Scripting) Prevention**
  1. In signup form, try entering:
     ```
     <img src=x onerror="alert('XSS')">
     ```
  2. ✅ Verify: Input sanitized, no alert popup
  3. ✅ Verify: Data stored safely

- [ ] **CORS & API Security**
  1. Open browser console
  2. Try to fetch Supabase URL directly:
     ```javascript
     fetch('https://your-project.supabase.co/rest/v1/appointments')
     ```
  3. ✅ Verify: Request blocked (CORS or auth error)
  4. ✅ Verify: Cannot access other patients' data

---

## Phase 5: Performance & Reliability

- [ ] **Page Load Time**
  1. Open patient dashboard
  2. Check network tab (DevTools)
  3. ✅ Verify: Page loads in <3 seconds
  4. ✅ Verify: No waterfall of requests (parallelized)

- [ ] **Image Upload Performance**
  1. Upload 5MB dental image
  2. ✅ Verify: Upload completes in <10 seconds
  3. ✅ Verify: Progress indicator shown
  4. ✅ Verify: Handles up to 50MB (if that's max)

- [ ] **Database Query Performance**
  1. Patient views "My Appointments" with 100+ appointments
  2. ✅ Verify: Page loads in <2 seconds
  3. ✅ Verify: Pagination implemented if large dataset

- [ ] **Memory Leaks**
  1. Open patient dashboard
  2. Navigate between pages 20+ times
  3. Check DevTools Memory tab
  4. ✅ Verify: Memory usage stable (not growing linearly)

- [ ] **Responsive Design**
  1. Patient web: Test on mobile (use DevTools device emulation)
  2. ✅ Verify: Layout responsive (no horizontal scroll)
  3. ✅ Verify: Touch targets >44px²
  4. Doctor mobile: Test on different screen sizes
  5. ✅ Verify: Layouts adapt correctly

---

## Phase 6: Deployment Check

- [ ] **Build for Production**
  ```bash
  pnpm patient:build
  ```
  ✅ Verify: Build succeeds (0 errors)

  ```bash
  cd apps/doctor-mobile && npm run build
  ```
  ✅ Verify: Build succeeds (or Expo build succeeds)

- [ ] **Environment Variables**
  1. Ensure `.env.local` NOT committed (in `.gitignore`)
  2. ✅ Verify: `.env.example` has template variables
  3. ✅ Verify: All required vars documented

- [ ] **Logging & Error Tracking**
  1. Open browser console
  2. Book appointment normally
  3. ✅ Verify: Console has useful debug logs
  4. ✅ Verify: NO sensitive data logged (passwords, tokens)
  5. Check if Sentry logs errors
  6. ✅ Verify: Push test error → appears in Sentry dashboard

- [ ] **Database Backup**
  1. In Supabase dashboard, verify backups enabled
  2. ✅ Verify: Daily backups configured
  3. ✅ Verify: Can restore from backup

---

## Phase 7: UAT (User Acceptance Testing)

Before launch, test with real stakeholders:

- [ ] **Dentist/Clinic Staff UAT**
  1. Doctor updates appointment → realizes UI unclear
  2. Doctor tries to view patient history → easy to find
  3. Doctor tries to set blockout dates → works smoothly
  4. ✅ Collect feedback, iterate

- [ ] **Patient UAT**
  1. Patient signs up → understands flow
  2. Patient books appointment → no confusion
  3. Patient makes payment → feels secure
  4. Patient sees analysis results → finds value
  5. ✅ Collect feedback, iterate

- [ ] **Support Staff UAT**
  1. Support person tries to help patient reset password → process clear
  2. Support tries to handle refund → can provide refund/credit
  3. ✅ Document support procedures

---

## Phase 8: Launch Readiness

- [ ] **Checklist Before Go-Live**
  - [ ] All automated tests passing: `pnpm test`
  - [ ] All type checks passing: `pnpm type-check`
  - [ ] All linting passing: `pnpm lint`
  - [ ] Production environment variables set
  - [ ] Database backups tested
  - [ ] Error monitoring (Sentry/LogRocket) active
  - [ ] SSL certificate valid
  - [ ] DNS pointing to correct servers
  - [ ] Patient web deployed to Vercel (or similar)
  - [ ] Doctor mobile deployed to EAS/AppStore (or internal)
  - [ ] Support team trained
  - [ ] Monitoring dashboards ready
  - [ ] Incident response plan written

---

## Troubleshooting

### Tests Won't Run
```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm test
```

### Type Errors in Doctor Mobile
```bash
cd apps/doctor-mobile
npx tsc --noEmit --listFiles
```

### Payment Not Processing
1. Check `.env.local` has correct payment provider credentials
2. Verify test mode is enabled (not live mode)
3. Check payment provider dashboard for errors
4. Try with test card/account

### Patient Can't See Doctor's Appointments
1. Verify RLS policies in Supabase
2. Check that `dentist_id` is correctly set
3. Verify doctor's `clinic_id` matches appointment's clinic

### Real-Time Updates Not Working
1. Ensure Supabase realtime subscriptions enabled
2. Check that listeners are properly set up in code
3. Try manual refresh (may be polling-based, not true real-time yet)

---

## Success Metrics

**Before Launch, Achieve:**
- ✅ 100% automated test pass rate
- ✅ 0 type errors in production builds
- ✅ 0 linting errors
- ✅ <2s page load time (avg)
- ✅ >99% uptime in staging
- ✅ All critical user paths verified
- ✅ No unhandled errors in production
- ✅ 100% of security checks passed

**After Launch, Monitor:**
- Error rate < 0.1%
- Page load time < 3s (p95)
- User signup conversion > 80%
- Appointment booking success rate > 95%
- Payment success rate > 95%
- Support ticket volume < 5/day for first month

---

## Next Steps

1. **This week:** Run automated tests, fix failures
2. **Next week:** Manual testing of all critical paths
3. **Week 3:** Security audit and performance testing
4. **Week 4:** UAT with real users, gather feedback
5. **Week 5:** Deploy to production, monitor closely

---

**Questions?** Refer to [QA_REPORT.md](./QA_REPORT.md) for detailed findings.
