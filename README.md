# 🦷 SmileGuard: An Automated Anomaly Detection Application with Dental Appointment

> **Client:** Ivy King Dental Clinic  
> **Architecture:** Multi-Client PNPM Monorepo (`apps/` & `packages/`)  
> **Current Milestone:** Integration & Stabilization Phase (Pre-Defense)  

[![Tests](https://img.shields.io/badge/Vitest-53%2F53%20Passing%20(100%25)-success?style=flat-square&logo=vitest)](./packages/tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20(0%20Errors)-blue?style=flat-square&logo=typescript)](./tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-16.2%20(Turbopack)-black?style=flat-square&logo=next.js)](./apps/patient-web)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.5%20%7C%20Expo%20SDK%2054-61DAFB?style=flat-square&logo=react)](./apps/doctor-mobile)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015%20%7C%20RLS-3ECF8E?style=flat-square&logo=supabase)](./supabase)
[![Stripe](https://img.shields.io/badge/Stripe-Payments%20API-635BFF?style=flat-square&logo=stripe)](./apps/patient-web)
[![Modal](https://img.shields.io/badge/AI%20Inference-YOLOv8m%20on%20Modal%20GPU-green?style=flat-square)](./apps/modal-inference)

---

## 📖 1. Project Overview

**SmileGuard** is a two-sided digital dental healthcare platform designed to streamline dental clinic operations while providing patients with pre-diagnostic AI oral health screening, appointment scheduling, and statutory billing deductions.

### Core Objectives:
* **Pre-Diagnostic Oral Screening (AI / Computer Vision):** Enables patients to capture and submit intraoral photos. A custom **YOLOv8m** model deployed on cloud GPUs scans for 5 oral conditions (Caries, Cavities, Calculus/Tartar, Gingivitis, and Tooth Discoloration) with Explainable AI (XAI) bounding box annotations.
* **Dual-Client Portals:**
  * **Patient Web Portal:** Fast, browser-based responsive application for booking, payments, and medical history.
  * **Doctor Mobile App:** Android/iOS tactile application for dentists and clinic staff to approve/decline appointments, block out dates, and review dental charts chairside.
* **Statutory Compliance & Legal Protections:**
  * **Philippine Data Privacy Act (RA 10173):** Complete patient health record segregation and consent controls.
  * **Statutory Senior & PWD Discounts (RA 9994 / RA 10754):** Mandatory 20% discount engine with ID verification.

---

## 🏛️ 2. Repository Architecture (PNPM Monorepo)

The repository is structured as a high-performance monorepo using **PNPM Workspaces**, isolating client applications while sharing business logic and contracts.

```
SmileGuard/
├── apps/
│   ├── patient-web/          # Next.js 14/16 (App Router), React 19, Tailwind CSS, HeroUI, Stripe Elements
│   ├── doctor-mobile/        # React Native 0.81.5, Expo SDK 54, Neumorphic UI, Expo Router
│   └── modal-inference/      # YOLOv8m inference pipeline, Modal.com serverless GPU, XAI rendering
├── packages/
│   ├── shared-types/         # Unified TypeScript data contracts (User, Appointment, Billing, calculateDiscount)
│   ├── shared-hooks/         # Common React hooks (useAuth, useNetwork)
│   ├── supabase-client/      # Shared PostgreSQL & Auth client configurations
│   └── tests/                # Centralized Vitest automated test suite (53 tests)
├── supabase/
│   └── migrations/           # Database migrations (001–020) including RLS policies
├── EXECUTIVE_SUMMARY.md      # Comprehensive Testing, Security, and Defense Summary
└── README.md
```

---

## ✨ 3. Feature Highlights

| Module | Features |
|---|---|
| **Patient Web Portal** | • Role-isolated authentication with email verification<br>• Real-time appointment slot booking with conflict detection<br>• Decoupled medical intake submission (allergies, medications, conditions)<br>• Stripe card payments with automatic 20% Senior/PWD statutory deductions<br>• Pre-diagnostic AI photo upload with instant XAI annotated scan feedback |
| **Doctor Mobile App** | • Tactile Neumorphic UI with clinical mint-green theme<br>• Chairside schedule management (Approve, Decline, Complete appointments)<br>• Clinic blockout date calendar engine<br>• Real-time Supabase table subscription push notification center<br>• Comprehensive patient dental records and treatment history viewing |
| **AI Inference Backend** | • YOLOv8m object detection running on Nvidia T4 cloud GPUs via Modal.com<br>• Calibrated recall threshold (0.10–0.30) to minimize false negatives on early lesions<br>• Explainable AI (XAI) bounding box annotations overlaid directly on patient intraoral images |
| **Security & Privacy** | • Passwords salted and hashed via adaptive Bcrypt (cost factor 10)<br>• Signed JWT tokens (HS256) enforcing role separation (`patient` vs `doctor`)<br>• PostgreSQL Row-Level Security (RLS) policies enforcing `auth.uid() = patient_id`<br>• Zero-knowledge Stripe card tokenization (PCI-DSS compliant) |

---

## 🧪 4. Automated Testing & Verification

The repository includes a centralized automated test suite running on **Vitest**:

```bash
# Run all automated tests
pnpm run test

# Run tests with V8 coverage report
pnpm run test:coverage

# Run TypeScript type check across web & mobile
pnpm run type-check

# Run ESLint linter
pnpm run lint
```

### Test Performance Metrics:
* **Total Tests:** **53 / 53 Passed (100%)**
* **Execution Duration:** **~707–783 ms** (Sub-second execution)
* **Pure Assertion Time:** **~34–48 ms**

| Suite | Tests | Status | Scope |
|---|---|---|---|
| **Critical Paths** | 20 | 🟢 Passed | End-to-end simulated flows: Signup, Login, Booking, Schedule, Invoices |
| **Services & Math** | 17 | 🟢 Passed | Double-booking collision detection, 14-slot math, state machine transitions |
| **Type Safety & Discounts** | 16 | 🟢 Passed | RA 9994 / RA 10754 20% discount precision, centavo rounding, interface compliance |

---

## 🚀 5. Getting Started

### Prerequisites
* **Node.js:** `>= 20.0.0`
* **Package Manager:** `pnpm` (`npm install -g pnpm@9.0.0`)
* **Expo CLI:** `npx expo`
* **Python:** `>= 3.10` (for `apps/modal-inference`)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Caffeine-lovers/SmileGuard.git
   cd SmileGuard
   ```

2. **Install all workspace dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables:**
   * Create `.env.local` inside `apps/patient-web/`
   * Ensure `apps/doctor-mobile/app.json` has your target Supabase project configuration

---

### Running Development Servers

#### Patient Web Portal (Next.js):
```bash
pnpm patient:dev
# Accessible at http://localhost:3000
```

#### Doctor Mobile App (Expo / React Native):
```bash
# Start Expo Metro Bundler
pnpm doctor:start

# Run on Android Emulator / Connected Device
pnpm doctor:android

# Run via Expo Go (QR Code scanning)
pnpm doctor:android:expogo

# Run on iOS Simulator (macOS only)
pnpm doctor:ios
```

#### Building for Production:
```bash
# Production build for Patient Web
pnpm run patient:build

# Production Android bundle compilation for Doctor Mobile
pnpm --filter doctor-mobile exec expo export --platform android
```

---

## 🔐 6. Security, Hashing & Compliance

* **Password Security:** Handled exclusively via Supabase Auth using **Bcrypt with 10 salt rounds**. Raw passwords never touch database rows or application logs.
* **Database RLS Policies:** Strict PostgreSQL policies prevent unauthorized cross-tenant data access. Patients can only query and mutate records where `auth.uid() = patient_id`.
* **Medical Data Privacy:** Health information is decoupled from profile tables into [`public.medical_intake`](./supabase/migrations/018_create_medical_intake_table.sql) in compliance with RA 10173.
* **Payment Security:** Credit/debit card numbers are tokenized client-side through Stripe Elements. The backend only handles opaque PaymentIntent tokens.

For an in-depth security and cryptographic breakdown, refer to [**`EXECUTIVE_SUMMARY.md`**](./EXECUTIVE_SUMMARY.md).

---

## 👥 7. Research & Development Team

**Ivy King Dental Clinic Research Project**  
* **Developers & Researchers:**
  * Jendri
  * Kyler
  * Mariel
  * Mart (Lead / Duoiz)
* **Institution:** STI College Caloocan

---

## 📚 8. Documentation References

* [**Executive Testing & Security Summary**](./EXECUTIVE_SUMMARY.md) — Benchmark numbers, cryptographic details, and defense Q&A.
* [**RLS Policies Audit**](./RLS_POLICIES_AUDIT.md) — Comprehensive Row-Level Security evaluation and subscription policies.
* [**Signup Flow Testing Guide**](./SIGNUP_FLOW_TESTING_GUIDE.md) — Step-by-step patient intake registration walkthrough.
