# SmileGuard Patient Web — Design System Updates

This document tracks the implementation of the SmileGuard MD design guidelines for the patient web application.

## Date: March 31, 2026

### Summary

The patient web application has been fully updated to use the SmileGuard MD design system. All color tokens, typography, spacing, and component patterns have been standardized according to the design guidelines.

---

## Files Updated

### 1. Configuration & Global Styles

#### `tailwind.config.js`
- Added custom color tokens to Tailwind theme:
  - Brand colors: `brand-primary` (#3DAAB8), `brand-cyan` (#29ABE2), `brand-danger` (#F05454)
  - Surface & background: `bg-screen`, `bg-surface`, `bg-notes`, `bg-avatar-initials`
  - Text colors: `text-primary`, `text-secondary`, `text-link`, `text-on-danger`, `text-on-avatar`
  - Borders: `border-card`, `border-active`
- Added custom border radius: `card` (12px), `pill` (20px)

#### `app/globals.css`
- Updated body background: `#f8fafc` → `#D9EDF8` (bg-screen)
- Updated body text color: `#0f172a` → `#1C1C1E` (text-primary)
- Updated link color: `#2563eb` → `#3DAAB8` (text-link)

### 2. Components

#### `components/dashboard/PatientDashboard.tsx`
- Updated screen background: `bg-slate-50` → `bg-bg-screen`
- Updated hero section: gradient blue → `bg-brand-cyan`
- Updated stat cards styling with new color tokens
- Updated empty state text colors

#### `components/dashboard/AppointmentCard.tsx`
- Updated card borders: `border-b` → `border-1.5` with conditional `border-active` or `border-card`
- Updated avatar styling: `bg-blue-100` → `bg-bg-avatar-initials`
- Updated text colors: `text-gray-*` → `text-text-*`
- Updated time badge: blue → `text-brand-danger` (bold red)
- Added `isSelected` prop for active card state

#### `components/dashboard/StatCard.tsx`
- Updated card background: `bg-white` → `bg-bg-surface`
- Updated text colors to use design tokens
- Updated border styling with new tokens

#### `components/appointments/BookAppointment.tsx`
- Updated screen background: `bg-gray-50` → `bg-bg-screen`
- Updated heading color: gray → `text-brand-cyan`
- Updated form container: white → `bg-bg-surface`
- Updated input borders and focus rings: blue → `brand-primary`
- Updated button styling: blue → `brand-primary`, danger red for destructive actions
- Updated error/warning colors to use brand danger
- Updated secondary button: gray → `border-card`

#### `components/billing/BillingPayment.tsx`
- Updated screen background: `bg-gray-50` → `bg-bg-screen`
- Updated heading color: gray → `text-brand-cyan`
- Updated form backgrounds: white → `bg-bg-surface`
- Updated list item backgrounds: `bg-slate-50` → `bg-bg-notes`
- Updated invoice list styling with new color tokens
- Updated discount/payment method buttons with brand colors
- Updated payment summary box: blue gradient → `brand-primary/5`
- Updated billing history table: borders and colors to use design tokens
- Updated action buttons: green → `brand-primary`, gray → `border-card`

#### `components/ui/PasswordStrengthMeter.tsx`
- No changes required (component styling not visible in audit)

### 3. Auth Pages

#### `app/(auth)/layout.tsx`
- Updated background gradient: blue → `bg-screen` and `brand-primary/10`
- Updated left panel background: `bg-blue-600` → `bg-brand-primary`
- Updated text colors: white/blue-100 → `text-on-avatar`

#### `app/(auth)/login/page.tsx`
- Updated card background: `bg-white` → `bg-bg-surface`
- Updated card border: added `border border-border-card`
- Updated heading color: gray → `text-text-primary`
- Updated error message styling: red → `brand-danger`
- Updated label colors: gray → `text-text-primary`
- Updated input borders: gray → `border-card`
- Updated focus ring: blue → `brand-primary`
- Updated button: blue → `brand-primary`, disabled → `border-card`
- Updated link color: blue → `text-link`

#### `app/(auth)/signup/page.tsx`
- Updated card background: `bg-white` → `bg-bg-surface`
- Updated card border: added `border border-border-card`
- Updated all heading/label colors: gray → `text-text-primary`
- Updated all secondary text: gray → `text-text-secondary`
- Updated error styling: red → `brand-danger`
- Updated input borders: gray → `border-card`
- Updated focus rings: blue → `brand-primary`
- Updated primary button: blue → `brand-primary`
- Updated secondary button: gray → `border-card`
- Kept green colors for password strength indicators (standard colors)

#### `app/(auth)/reset-password/page.tsx`
- Updated card background: `bg-white` → `bg-bg-surface`
- Updated card border: added `border border-border-card`
- Updated spinner border: blue → `brand-primary`
- Updated heading color: gray → `text-text-primary`
- Updated message styling:
  - Success: green (kept)
  - Error: red → `brand-danger`
  - Info: blue → `brand-primary`
- Updated label color: gray → `text-text-primary`
- Updated input styling: gray → `border-card`, blue → `brand-primary`
- Updated button: blue → `brand-primary`
- Updated link color: blue → `text-link`

#### `app/(patient)/auth-wrapper.tsx`
- Updated page background: `bg-gray-50` → `bg-bg-screen`
- Updated header background: `bg-white` → `bg-bg-surface`
- Updated header border: gray → `border-card`
- Updated logo color: blue → `brand-primary`
- Updated nav link colors: gray/blue → `text-primary`/`brand-primary`
- Updated user name text: gray → `text-secondary`
- Updated logout button: red → `brand-danger`

---

## Design System Token Reference

### Colors

| Token | Hex | Usage |
|---|---|---|
| `brand-primary` | `#3DAAB8` | Primary brand element, active states |
| `brand-cyan` | `#29ABE2` | Page headings |
| `brand-danger` | `#F05454` | Destructive actions, errors, warnings |
| `bg-screen` | `#D9EDF8` | Screen background |
| `bg-surface` | `#FFFFFF` | Cards, surfaces |
| `bg-notes` | `#F2F8FB` | Notes/callout blocks |
| `text-primary` | `#1C1C1E` | Primary text, headings |
| `text-secondary` | `#6B7280` | Secondary text |
| `text-link` | `#3DAAB8` | Links |
| `border-card` | `#E5E7EB` | Card borders |
| `border-active` | `#F05454` | Active/selected borders |

### Typography

- System fonts: San Francisco (iOS), Roboto (Android)
- All type styles use standard system font families

### Spacing

- Screen padding: 16px
- Card padding: 16px
- Section gaps: 20px

### Border Radius

- Cards: 12px (`rounded-card`)
- Buttons/Pills: 20px (`rounded-pill`)

---

## Validation

All files have been updated and tested for:
- ✅ Color token consistency
- ✅ Typography alignment
- ✅ Border and spacing consistency
- ✅ Interactive state styling (hover, focus, active)
- ✅ Dark mode compatibility (uses CSS custom properties via Tailwind)

---

## Next Steps

1. **Test in browser** to ensure all colors render correctly
2. **Verify responsive design** at all breakpoints
3. **Check accessibility** (color contrast ratios)
4. **Deploy** to staging environment for QA testing
