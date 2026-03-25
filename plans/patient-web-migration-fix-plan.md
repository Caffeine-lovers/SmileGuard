# Patient-Web Migration Fix Plan: React Native → Next.js

## Executive Summary

The SmileGuard patient-web app was migrated from React Native (Expo) to Next.js 16 with App Router. The migration has **structural issues**, **missing features**, and **configuration bugs** that need to be addressed. The most critical problem is that the **dashboard is significantly stripped down** compared to the original, missing key sections like the Edge-AI Diagnostics panel, the Upcoming Appointment highlight card, and proper appointment status badges.

---

## Architecture Overview

```mermaid
graph TD
    A[Root Layout - app/layout.tsx] --> B[Root Page - redirects to /login]
    A --> C[Auth Layout Group]
    A --> D[Patient Layout Group]
    
    C --> C1[/login]
    C --> C2[/signup]
    C --> C3[/reset-password]
    
    D --> D1[/dashboard]
    D --> D2[/appointments]
    D --> D3[/billing]
    D --> D4[/analysis]
    D --> D5[/treatments]
    D --> D6[/documents]
    
    D1 --> PC[PatientDashboard Component]
    D2 --> PA[BookAppointment Component]
    D3 --> PB[BillingPayment Component]
    
    PC --> SH[shared-hooks: useAuth]
    PA --> SH
    PB --> SH
    SH --> SC[supabase-client]
    SC --> SUP[Supabase Backend]
```

---

## Issues Found

### 🔴 Critical Issues

#### 1. Patient Layout Not Using AuthWrapper
- **File**: [`layout.tsx`](apps/patient-web/app/(patient)/layout.tsx:1)
- **Problem**: The patient layout is a passthrough that just renders `{children}`. The [`auth-wrapper.tsx`](apps/patient-web/app/(patient)/auth-wrapper.tsx:1) exists with proper auth guards and navigation header, but it is **never used**.
- **Impact**: All patient pages (dashboard, appointments, billing, etc.) are **completely unprotected** — any unauthenticated user can access them. There is also no navigation header rendered.
- **Fix**: Update `layout.tsx` to wrap children with `AuthWrapper`.

#### 2. client-layout.tsx Uses Invalid Top-Level Await
- **File**: [`client-layout.tsx`](apps/patient-web/app/(patient)/client-layout.tsx:8)
- **Problem**: Line 8 uses `const useAuthModule = await import(...)` at the module top level in a `'use client'` component. Top-level await is not supported in client-side JavaScript modules in Next.js.
- **Impact**: This file will cause a build/runtime error if imported. Currently it appears unused (AuthWrapper is the intended layout), but it should be fixed or removed.
- **Fix**: Delete this file since `auth-wrapper.tsx` serves the same purpose correctly.

#### 3. tsconfig.json Has Wrong JSX Setting for Next.js
- **File**: [`tsconfig.json`](apps/patient-web/tsconfig.json:18)
- **Problem**: Uses `"jsx": "react-jsx"` and `"jsxImportSource": "react"`. Next.js requires `"jsx": "preserve"` because it handles JSX transformation itself.
- **Impact**: May cause compilation issues or double-transformation of JSX.
- **Fix**: Change to `"jsx": "preserve"` and remove `"jsxImportSource"`.

---

### 🟡 Dashboard Feature Parity Issues

The original React Native [`PatientDashboard`](components/dashboard/PatientDashboard.tsx:1) has these sections that are **missing or degraded** in the Next.js [`PatientDashboard`](apps/patient-web/components/dashboard/PatientDashboard.tsx:1):

#### 4. Missing: Upcoming Appointment Highlight Card
- **Original** (lines 115-130): A prominent teal/blue card showing the next upcoming appointment date, time, and service — or a message to book one.
- **Next.js version**: Replaced with a generic `StatCard` grid showing appointment count, balance, and a hardcoded "3 Days Until Next Appointment".
- **Fix**: Add the highlight card back. Compute the actual next upcoming appointment from the fetched data.

#### 5. Missing: Edge-AI Diagnostics Section
- **Original** (lines 132-165): An interactive section with:
  - Intra-oral scan placeholder image
  - Toggle button for "Run Luminosity Analysis"
  - AI overlay with anomaly highlighting
  - Explainable AI report text
- **Next.js version**: Completely absent.
- **Fix**: Port the Edge-AI Diagnostics section to the Next.js dashboard using Tailwind CSS equivalents.

#### 6. Missing: Proper Appointment Activity List with Status Badges
- **Original** (lines 167-194): Shows each appointment with:
  - Service name
  - Formatted date and time
  - Color-coded status badge (Pending/Completed/Cancelled/No Show/Approved)
- **Next.js version**: Uses a simplified `AppointmentCard` component that only shows doctor name (hardcoded "Dr. Smith"), service, and time. No date, no status badge.
- **Fix**: Replace `AppointmentCard` usage with a proper appointment row that includes date, time, and status badges matching the original design.

#### 7. Hardcoded "3 Days Until Next Appointment"
- **File**: [`PatientDashboard.tsx`](apps/patient-web/components/dashboard/PatientDashboard.tsx:82) line 82
- **Problem**: `StatCard number="3" label="Days Until Next Appointment"` is hardcoded.
- **Fix**: Compute from the actual upcoming appointment date.

#### 8. Duplicate Logout Button
- **File**: [`PatientDashboard.tsx`](apps/patient-web/components/dashboard/PatientDashboard.tsx:69) lines 69-75
- **Problem**: The dashboard component renders its own logout button, but the `AuthWrapper` header already has one.
- **Fix**: Remove the logout button from the dashboard component since the AuthWrapper provides it.

---

### 🟢 Minor Issues

#### 9. Appointment Type Missing 'approved' Status
- **File**: [`database.ts`](apps/patient-web/lib/database.ts:9)
- **Problem**: The `Appointment.status` type is `'scheduled' | 'completed' | 'cancelled' | 'no-show'` but the original dashboard handles `'approved'` status too.
- **Fix**: Add `'approved'` to the union type.

#### 10. Supabase Client detectSessionInUrl Should Be True
- **File**: [`index.ts`](packages/supabase-client/index.ts:26)
- **Problem**: `detectSessionInUrl: false` prevents Supabase from picking up auth tokens from URL redirects (e.g., after password reset or OAuth).
- **Fix**: Set to `true` for the web client.

#### 11. AppointmentCard Component Is Too Simplified
- **File**: [`AppointmentCard.tsx`](apps/patient-web/components/dashboard/AppointmentCard.tsx:1)
- **Problem**: Shows a placeholder image, doctor name, service, and time. Missing: appointment date, status badge, proper formatting.
- **Fix**: Rewrite to match the original appointment row design with status badges.

---

## Detailed Fix Plan

### Phase 1: Fix Critical Structural Issues

| # | Task | File |
|---|------|------|
| 1 | Update patient layout to use AuthWrapper | `apps/patient-web/app/(patient)/layout.tsx` |
| 2 | Delete unused client-layout.tsx with invalid top-level await | `apps/patient-web/app/(patient)/client-layout.tsx` |
| 3 | Fix tsconfig.json JSX setting to "preserve" | `apps/patient-web/tsconfig.json` |
| 4 | Fix supabase detectSessionInUrl to true | `packages/supabase-client/index.ts` |

### Phase 2: Restore Dashboard Feature Parity

| # | Task | File |
|---|------|------|
| 5 | Add 'approved' to Appointment status type | `apps/patient-web/lib/database.ts` |
| 6 | Rewrite PatientDashboard to match original sections | `apps/patient-web/components/dashboard/PatientDashboard.tsx` |
| 7 | Add Upcoming Appointment highlight card | Same file |
| 8 | Add Edge-AI Diagnostics section with toggle | Same file |
| 9 | Add proper appointment activity list with status badges | Same file |
| 10 | Compute actual "days until next appointment" | Same file |
| 11 | Remove duplicate logout button from dashboard | Same file |
| 12 | Rewrite AppointmentCard or remove if unused | `apps/patient-web/components/dashboard/AppointmentCard.tsx` |

### Phase 3: Verification

| # | Task |
|---|------|
| 13 | Verify all pages render without errors |
| 14 | Test auth flow: login → dashboard → navigation → logout |
| 15 | Visual comparison: ensure dashboard matches original layout |

---

## Side-by-Side Dashboard Comparison

### Original React Native Dashboard Sections:
1. ✅ **Header** — "Welcome Back, {name}" + Logout button
2. ✅ **Upcoming Appointment Card** — Teal highlight card with next appointment or "No upcoming" message
3. ✅ **Edge-AI Diagnostics** — Interactive scan viewer with AI toggle and explainable report
4. ✅ **Your Activity** — Full appointment list with service, date, time, and color-coded status badges
5. ✅ **Quick Actions** — Floating buttons for Book, Pay, Records

### Current Next.js Dashboard Sections:
1. ✅ **Header** — "Welcome, {name}!" + Logout button *(duplicate with AuthWrapper)*
2. ❌ **Stats Grid** — Generic stat cards *(not in original)*
3. ⚠️ **Recent Appointments** — Simplified cards missing date/status *(degraded)*
4. ✅ **Quick Actions** — Link buttons for Book, Pay, AI Analysis, Treatments *(improved from original)*
5. ❌ **Upcoming Appointment Card** — Missing
6. ❌ **Edge-AI Diagnostics** — Missing

### Target Next.js Dashboard Sections (after fix):
1. ✅ **Header** — Provided by AuthWrapper (no duplicate in dashboard)
2. ✅ **Upcoming Appointment Card** — Teal highlight card, computed from real data
3. ✅ **Edge-AI Diagnostics** — Interactive section with AI toggle
4. ✅ **Your Activity** — Full appointment list with status badges
5. ✅ **Quick Actions** — Link buttons (keep the improved Next.js version)

---

## Files to Modify

| File | Action |
|------|--------|
| `apps/patient-web/app/(patient)/layout.tsx` | Rewrite to use AuthWrapper |
| `apps/patient-web/app/(patient)/client-layout.tsx` | **DELETE** |
| `apps/patient-web/tsconfig.json` | Fix jsx setting |
| `packages/supabase-client/index.ts` | Fix detectSessionInUrl |
| `apps/patient-web/lib/database.ts` | Add approved status |
| `apps/patient-web/components/dashboard/PatientDashboard.tsx` | **Major rewrite** to match original |
| `apps/patient-web/components/dashboard/AppointmentCard.tsx` | Rewrite or remove |
| `apps/patient-web/components/dashboard/StatCard.tsx` | Keep as-is (may still be useful) |
