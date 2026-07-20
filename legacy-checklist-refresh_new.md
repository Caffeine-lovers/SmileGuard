# SmileGuard Legacy Checklist Refresh

## Core foundation
- [x] Monorepo structure exists and is usable
- [x] Shared packages are in place
- [x] Root workspace scripts exist
- [x] Patient and doctor apps are separated and running from the same codebase

## Patient side
- [x] Patient login/signup flow exists
- [x] Patient dashboard exists
- [x] Patient profile and medical intake flow exists
- [x] Patient booking flow is working well
- [ ] Patient billing/payment flow is still not fully reliable

## Doctor side
- [x] Doctor mobile app shell exists
- [x] Doctor dashboard exists
- [x] Doctor profile completion flow exists
- [ ] Doctor workflow is still only mostly complete
- [ ] Clinic setup and scheduling rules are still incomplete in practice

## Shared platform features
- [x] Supabase integration exists
- [x] Authentication and role-based structure are present
- [ ] Image/profile media flow is still only mostly stable
- [ ] Appointment availability logic is consistent across UI and backend
- [ ] Security and production hardening are not fully complete

## Legacy / advanced feature gaps
- [ ] AI dental analysis
- [ ] Cancellation/reschedule policy handling
- [ ] Advanced billing/payment polish
- [ ] Full patient-doctor daily workflow polish

## Priority order from here
1. Fix patient billing reliability
2. Harden doctor workflow usability
3. Stabilize profile/media handling
4. Make appointment logic consistent
5. Polish advanced product features
