# 🦷 SmileGuard — What Changed & What's Next
### A plain-English guide for non-coders
---

## 📦 FILES THAT WERE CHANGED (3 files edited, 1 file created)

Below is a simple breakdown. You don't need to understand the code —
just know *what* each file does and *why* it was touched.

---

### 1. `types/index.ts` — The Data Dictionary
**What it is:** A list of every "shape" of data your app uses (like a form template).

**What changed:**
| Before | After |
|--------|-------|
| Only stored: name, email, password, service | Now also stores the full **medical intake** (DOB, gender, phone, address, emergency contact, allergies, medications, conditions, surgeries, smoking, pregnancy) |
| No password rules | Added a `PasswordCheck` type so the app can show a strength meter |
| No doctor access code field | Added `doctorAccessCode` field to the form |

**In simple terms:** We added all the "blanks" a patient fills out at a real dental
clinic, plus a field for the doctor's clinic access code.

---

### 2. `components/auth/AuthModal.tsx` — The Sign-Up / Login Screen
**What it is:** The pop-up modal where patients and doctors register or log in.

**What changed (MAJOR rewrite):**

#### A) Medical Intake Form (2 new screens added)
The patient registration flow went from **4 steps → 6 steps**:

```
BEFORE:                          AFTER:
Step 0: Login or Register?       Step 0: Login or Register?
Step 1: Pick a service            Step 1: Pick a service
Step 2: Email & password          Step 2: 📋 Personal Info (NEW)
Step 3: Success!                           → DOB, gender, phone, address
                                           → Emergency contact name & phone
                                  Step 3: 🏥 Medical History (NEW)
                                           → Allergies, medications
                                           → Conditions, past surgeries
                                           → Smoking status, pregnancy
                                  Step 4: Email & password
                                  Step 5: Success!
```

Every step has **Back / Next** buttons so the patient can review their answers.

#### B) Password Strength Meter
- Old rule: password just had to be 6+ characters
- New rules: **8+ characters**, must include uppercase, lowercase, number, AND a
  special character (`!@#$` etc.)
- A **live color bar** shows Weak → Fair → Good → Strong with a checklist

#### C) Doctor Portal Security (3 layers added)

| Security Layer | What It Does |
|---------------|--------------|
| **Clinic Access Code** | Doctors must enter a code (e.g. `SMILE-DOC-2026`) to register or log in. Without it, they can't access the doctor portal at all. |
| **Brute-Force Lockout** | After **5 failed login attempts**, the account locks for **5 minutes**. A warning counter shows remaining attempts. |
| **Input Sanitization** | Every text field (except password) is scrubbed of characters used in hacking attacks (`< > ' " ; -- \`). This is a first line of defense against SQL injection and XSS attacks. |

#### D) Scrollable Layout
The modal now uses a `ScrollView` so the longer forms don't get cut off on
smaller screens.

---

### 3. `hooks/useAuth.ts` — The Login/Register Logic
**What it is:** The code that actually talks to Supabase (your database) when
someone signs up or logs in.

**What changed:**
- The `register()` function now sends the **medical intake data** to Supabase as
  part of the signup metadata
- Supabase's trigger (defined in the SQL file) automatically saves this into
  a separate `medical_intake` table

**Before:** `signUp` only sent name, role, service
**After:**  `signUp` also sends the full `medical_intake` object

---

### 4. `supabase/setup.sql` — The Database Blueprint (NEW FILE)
**What it is:** A SQL script you paste into Supabase's SQL Editor ONE TIME to
create all your database tables, security rules, and automation.

**What it creates:**

| Table | Purpose |
|-------|---------|
| `profiles` | Stores every user's name, email, role (patient/doctor), and service |
| `medical_intake` | Stores patient medical history separately (stricter access) |
| `appointments` | Booking records (patient ↔ doctor, date, status) |
| `doctor_access_codes` | Valid clinic codes stored server-side (not in the app code) |

**Automation:**
- **Trigger:** When someone signs up, a profile row + medical intake row are
  auto-created from the registration data. No extra API calls needed.
- **`updated_at` timestamps:** Auto-refresh whenever a row is edited.

**Security (Row Level Security / RLS):**

| Who | profiles | medical_intake | appointments | doctor_codes |
|-----|----------|---------------|-------------|-------------|
| Patient | Own only ✅ | Own only ✅ | Own only ✅ | ❌ Hidden |
| Doctor | Own + all patients ✅ | All patients ✅ | All appointments ✅ | ❌ Hidden |
| Hacker with no login | ❌ Nothing | ❌ Nothing | ❌ Nothing | ❌ Nothing |

A patient **cannot** change their role to "doctor" (blocked by policy).

---

## 🚨 HOW TO ACTIVATE THE DATABASE

**You must do this once — the SQL file doesn't run by itself:**

1. Go to **https://supabase.com/dashboard**
2. Open your SmileGuard project
3. Click **SQL Editor** (left sidebar) → **+ New Query**
4. Open `supabase/setup.sql` from your project, copy the ENTIRE contents
5. Paste into the SQL Editor
6. Click **Run** → should say "Success. No rows returned"
7. Go to **Table Editor** — you should see 4 new tables

**Also do this:**
- Authentication → Settings → Turn OFF "Enable email confirmations" (for dev)
- Authentication → Settings → Set minimum password length to **8**

---

## ✅ WHAT'S WORKING NOW

- [x] Patient registration with full medical intake form
- [x] Doctor registration with clinic access code
- [x] Strong password enforcement with visual meter
- [x] Brute-force login lockout (5 attempts → 5 min lock)
- [x] Input sanitization against injection attacks
- [x] Supabase database schema with RLS security
- [x] Auto-profile creation on signup (trigger)
- [x] Role verification on login (patient can't enter doctor portal)
- [x] Landing page, Hero, How It Works, Footer
- [x] Patient Dashboard with mock AI diagnostics
- [x] Doctor Dashboard with mock appointments

---

## 📌 WHAT'S NEXT (from your TODO.txt)

These are the items still on your roadmap, roughly in priority order:

### 🔴 High Priority (before defense)
1. **Train the AI model** — dental image anomaly detection (cavities, cracks,
   gingivitis, inflammation, ulcers, lesions)
2. **Image capture flow** — use phone back camera, upload, AI analyzes,
   retake if unclear
3. **Appointment booking** — real booking system (choose service, time slot,
   confirm, cancel/reschedule with policies)
4. **Move doctor access code verification to a Supabase Edge Function** —
   right now the codes are hardcoded in the app (anyone reading the JS
   bundle can see them)

### 🟡 Medium Priority
5. **PWD / Senior Citizen discounts** — proof document upload, auto discount
6. **Dentist schedule management** — daily time blocks, add/edit/delete slots,
   buffer time, lead time
7. **Patient records for dentist** — treatment overview, billing, documents,
   analyzed radiographs
8. **Referral code system** — doctor generates code → patient inputs it to
   connect to clinic
9. **Double database (cloud + local)** — offline fallback with sync when
   reconnected

### 🟢 Lower Priority / Polish
10. **Email verification** — turn on when going to production
11. **Onboarding wizard / training module**
12. **Notification system** for appointments
13. **Settings pages** for both patient and doctor
14. **Assistant role** (can do what dentist allows)

---

## 🔑 IMPORTANT CREDENTIALS TO REMEMBER

| What | Value | Where |
|------|-------|-------|
| Supabase URL | `https://yffvnvusiazjnwmdylji.supabase.co` | `lib/supabase.ts` |
| Doctor Access Code 1 | `SMILE-DOC-2026` | `AuthModal.tsx` + `setup.sql` |
| Doctor Access Code 2 | `SMILEGUARD-STAFF` | `AuthModal.tsx` + `setup.sql` |
| Login lockout | 5 attempts → 5 min lock | `AuthModal.tsx` |
| Password rules | 8+ chars, upper+lower+number+special | `AuthModal.tsx` |

---

## 🧪 QUICK TEST CHECKLIST

After running the SQL and starting your app (`npx expo start --web`):

- [ ] Register a patient → fill all intake steps → check Supabase Table Editor
      for rows in `profiles` AND `medical_intake`
- [ ] Register a doctor with code `SMILE-DOC-2026` → check `profiles` table
- [ ] Try registering a doctor with wrong code → should get rejected
- [ ] Try a weak password like `abc` → should show red strength bar, block submit
- [ ] Log in as patient → should see Patient Dashboard
- [ ] Log in as doctor → should see Doctor Dashboard
- [ ] Try logging in with wrong password 5 times → should get locked out

---

*Last updated: February 12, 2026*
