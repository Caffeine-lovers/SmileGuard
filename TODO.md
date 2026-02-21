 # SmileGuard — TODO

> Install drawer navigation when ready:
> ```
> npm install @react-navigation/drawer
> ```

---

## 📌 Priority

- [ ] **TRAIN MODEL**

---

## 📌 Suggestions by Ser Che

- [ ] Develop AI-driven anomaly detection for dental images:
  - [ ] Detect cavities, cracks, discoloration, gingivitis, mouth ulcers, lesions, and inflammation.
  - [ ] Highlight affected areas with markers (e.g., crosshair/green target).
  - [ ] Provide AI-driven analysis output that identifies issues clearly.
- [ ] Ensure the AI captures both top and bottom teeth images, including incisors.
- [ ] Train the AI to act like a "first doctor" — preliminary screening before the dentist.
- [ ] Use cellphone BACK camera for capturing mouth images → upload → AI analyzes.
- [ ] Implement a retake mechanism (like Shopee's live feedback) if images are unclear.
- [ ] Generate suggestive outputs (e.g., "possible gingivitis," "needs cleaning") for:
  - [ ] Dentist (to prepare before appointment).
  - [ ] Patient (to understand condition before visiting clinic).
- [ ] Detect if a tooth has been extracted ("nabunutan") and reflect that in analysis.
- [ ] Provide real-time or near real-time feedback where possible.
- [ ] Integrate with appointment scheduling:
  - [ ] Payment modes and discounts (PWD, senior citizen).
  - [ ] Allow upload of proof documents (e.g., PWD/senior ID) → automatic discount application.
- [ ] Ensure dentist sees patient history and AI suggestions before consultation.
- [ ] Decide on backend: Firebase or MongoDB (both acceptable).
- [ ] Implement double database setup:
  - [ ] Cloud database (Firebase/MongoDB).
  - [ ] Local backup database for offline use when internet is down.
  - [ ] Sync mechanism: transactions saved locally → auto-update to cloud once reconnected.
- [ ] Handle transaction errors (e.g., "transaction not completed" when internet drops).
- [ ] Ensure real-time syncing between local and cloud when connection resumes.

---

## 📌 Deliverables & Deadlines

- [ ] Terminal system must be ready before defense.
- [ ] At least two objectives accomplished before defense.
- [ ] Prepare a consultation form documenting progress and features.
- [ ] Prioritize hard parts first (AI detection, appointment/payment integration).
- [ ] Next week: show consultation form and progress on cleaning module.

---

## 📌 App Components

- [x] SmileGuard Doctor Dashboard → `DoctorDashboard`
  - [x] `npm install @react-navigation/drawer`
- [x] Footer Component → `Footer`
- [x] How It Works Section → `HowItWorks` *(Splash Screen)*
- [x] Main App Layout → `_layout`
- [x] SmileGuard Patient Dashboard → `PatientDashboard`
- [ ] Welcome Page
  - [ ] Sign In
  - [ ] Sign Up
  - [ ] Verification Page
- [ ] On-Boarding Wizard (Training Module)

---

## 🖥️ Frontend

### 🦷 For Dentist

- [ ] Dentist Profile Setup
- [ ] Clinic Setup
- [ ] Set Appointment Rules
  - [ ] Appointment Page
  - [ ] Cancellation Settings Policy
    - [ ] Cancellation Window
    - [ ] Fee Amount
    - [ ] Toggle Grace Period
    - [ ] First-Time Cancellation Free
    - [ ] Current Policy
  - [ ] Reschedule Rules
  - [ ] No-Show Penalty
- [ ] Review Dentist and Clinic Information
- [ ] "Your Schedule" Page
  - [ ] Daily Time Block
  - [ ] Schedule Overview
  - [ ] Add Slot
    - [ ] Slot Name
    - [ ] Color Organizer
    - [ ] Show Day and Time
    - [ ] Minimum Lead Time (Hours)
    - [ ] Buffer Time (Minutes)
    - [ ] Save Button
  - [ ] Blocked Slot
  - [ ] Edit Slot
  - [ ] Delete Slot
  - [ ] Daily or Weekly Schedule
- [ ] Clinic Homepage Dashboard
  - [ ] Patients Module
    - [ ] Add New Patient
  - [ ] Filter
    - [ ] Name A-Z, Z-A
    - [ ] Treatment Type
    - [ ] Status
  - [ ] View Record Button → Patient Profile Page
    - [ ] Patient Name
    - [ ] Show Status
    - [ ] Overview Tab
      - [ ] Appointments List
      - [ ] Notes Display
    - [ ] Treatment Overview Page
      - [ ] Ongoing Treatments
      - [ ] Completed Procedures
      - [ ] Pending Recommendations
    - [ ] Billing Page
      - [ ] Insurance Information
      - [ ] Transaction History
      - [ ] Confirm Incoming Payments
    - [ ] Documents Page
      - [ ] Radiographs & Photos
      - [ ] Analyzed Radiographs & Photos
      - [ ] Consent Forms
    - [ ] Generate Referral Code *(if no existing account — mark code as used/expired)*
  - [ ] Appointment Module
    - [ ] Notification Page
    - [ ] Add Appointment Schedule
    - [ ] Sorting by Date
    - [ ] Show Upcoming Appointments
    - [ ] Show Future Appointments
  - [ ] Analyze Module
  - [ ] Settings Module
- [ ] Appointments Page
  - [ ] Today's Appointments
  - [ ] Upcoming Slots
  - [ ] Add Appointment Schedule
  - [ ] Calendar View
  - [ ] Search Patient
  - [ ] Update Appointment Status
- [ ] Image Analyzer Page
  - [ ] Action Buttons
    - [ ] Upload Image
    - [ ] Analyze Now
    - [ ] View History
  - [ ] Recent Image Analyses
  - [ ] Detection Trends
  - [ ] Tabs
    - [ ] All Displays
    - [ ] Analyzed Photos
    - [ ] Pending Lists
    - [ ] Flagged Contents
    - [ ] Patient's Image Analyzer
      - [ ] Detection Summary
      - [ ] Image Comparison
      - [ ] Add Clinical Notes
      - [ ] Record Integration
      - [ ] Image Display Panel
      - [ ] Descriptive Analytics
      - [ ] Summary Tab *(concise overview of AI-detected anomaly, diagnostic details, clinician actions, note-taking)*
      - [ ] History Tab *(chronological record of past detections for the selected patient)*
- [ ] Settings Page *(manage personal profile, clinic info, system preferences, support)*

---

### 🤝 For Assistant

- [ ] Can do whatever the dentist can do, depending on permissions granted by the dentist.

---

### 😊 For Patient

- [ ] Sign In as Patient
- [ ] Sign Up Page
- [ ] Verification Page
- [ ] Enter Referral Code *(patients input the assigned referral code to connect with the clinic)*
  - [ ] Display clinic overview
- [ ] Patient Homepage
  - [ ] Appointment Module
    - [ ] Book an Appointment
      - [ ] Choose Service
      - [ ] Choose Available Time Slot
      - [ ] Add Notes or Request
      - [ ] Confirm Appointment
    - [ ] Show Current Appointment
    - [ ] Appointment Details/Summary
      - [ ] Reschedule
      - [ ] Cancel Appointment *(system displays policy reminder — may incur fee)*
  - [ ] Billing Module *(can make payment; PWD/senior/insurance options)*
  - [ ] Treatment Module
    - [ ] Treatment Summary/Details *(procedure notes, findings, treatment outcomes)*

---

## 🔐 Security Review Fixes *(Code Review — 2026-02-21)*

### 🚨 Critical — Fix before any production/public deployment

- [ ] **`lib/supabase.ts:8-9`** — Move Supabase URL + anon key out of source code into environment variables.
  Currently the credentials are hardcoded and committed to git.
  **How to fix:**
  1. Create `.env` → `SUPABASE_URL=...` and `SUPABASE_ANON_KEY=...`
  2. In `app.json` add: `"extra": { "supabaseUrl": process.env.SUPABASE_URL, ... }`
  3. In `lib/supabase.ts` use: `Constants.expoConfig?.extra?.supabaseUrl`

- [ ] **`components/auth/AuthModal.tsx:244`** — Replace hardcoded `VALID_DOCTOR_CODES` array with a Supabase Edge Function call.
  The codes are embedded in the JS bundle and can be extracted by anyone with a decompiler.
  The `doctor_access_codes` DB table already exists — wire it up via an Edge Function.
  **How to fix:**
  ```ts
  const { data } = await supabase.functions.invoke("verify-doctor-code", {
    body: { code: formData.doctorAccessCode },
  });
  if (!data?.valid) { /* reject */ }
  ```

### ⚠️ Warning — Fix before launch

- [ ] **`hooks/useAuth.ts:12`** — Add `.catch(() => setLoading(false))` to the `getSession()` call.
  A network error or storage corruption currently leaves `loading=true` forever, freezing the app on a blank screen.

- [ ] **`hooks/useAuth.ts:50`** — Replace silent `console.error` in `fetchProfile` catch block with user-facing error handling (e.g., show an alert or set an error state).

- [ ] **`components/auth/AuthModal.tsx:199`** — Persist login lockout state (`lockoutUntil`, `loginAttempts`) to `AsyncStorage` keyed by email.
  Currently stored in React state — closing/reopening the modal resets it to zero, bypassing brute-force protection.
  Alternatively, enable Supabase's built-in Auth rate limiting in the dashboard (Auth → Settings → Rate Limits).

- [ ] **`supabase/setup.sql:319-323`** — Fix RLS self-referencing subquery in the profiles `UPDATE` policy `WITH CHECK` clause.
  The subquery queries `public.profiles` while RLS is active on that table, risking recursion.
  Replace with a `SECURITY DEFINER` helper function or read role from `auth.jwt() -> 'user_metadata' ->> 'role'`.

### 💡 Suggestion

- [ ] **`.gitignore:39`** — Update `.gitignore` to also ignore plain `.env` files.
  Currently only `.env*.local` is ignored — a standard `.env` would be committed.
  **Add:**
  ```
  .env
  .env.*
  !.env.example
```
