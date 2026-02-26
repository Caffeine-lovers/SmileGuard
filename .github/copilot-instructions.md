# Copilot Instructions for SmileGuard

## Project Overview
- SmileGuard is an Expo React Native app using file-based routing (see [app/](app/)).
- Major features are organized by domain in [components/], e.g., dashboard, appointments, auth, billing, landing, and UI.
- Data and service logic are in [lib/] (database, supabase, syncService) and [supabase/functions/].
- The project uses [theme.ts](constants/theme.ts) and custom hooks ([hooks/]) for styling and state.

## Developer Workflows
- **Install dependencies:** `npm install` and `npx expo install firebase` (see README).
- **Start app:** `npx expo start` (for web: `npx expo start --web`, for Android: `npx expo start --android`).
- **Reset project:** `npm run reset-project` (moves starter code to app-example, creates blank app/).
- **Python scripts:** [scripts/image_check.py] and [scripts/reset-project.js] for utility tasks.

## Patterns & Conventions
- **File-based routing:** Pages/components in [app/] are mapped to routes automatically.
- **Component structure:** Use domain folders in [components/] for separation (e.g., dashboard, auth).
- **Theming:** Use `use-theme-color` and `theme.ts` for consistent styling.
- **Hooks:** Custom hooks in [hooks/] for color scheme, theme, auth, and network state.
- **External links:** Use [components/external-link.tsx] for link handling.
- **Parallax/Collapsible UI:** See [components/parallax-scroll-view.tsx] and [components/ui/collapsible.tsx].

## Integration Points
- **Supabase:** Backend integration via [lib/supabase.ts] and [supabase/functions/].
- **Firebase:** Installed via Expo, usage not shown in README but may be present in code.
- **Assets:** Images in [assets/images/].

## Examples
- To add a new dashboard feature, create a component in [components/dashboard/] and link it in [app/tabs/].
- To add a new route, create a file in [app/] (e.g., [app/appointments.tsx]).
- To use theming, import from [constants/theme.ts] and use hooks from [hooks/].

## Key Files & Directories
- [app/] - main app entry and routes
- [components/] - reusable and domain-specific UI
- [lib/] - data/services
- [hooks/] - custom hooks
- [constants/theme.ts] - theming
- [supabase/functions/] - backend logic

## AI Agent Guidance
- Follow domain folder structure for new features.
- Use file-based routing for navigation.
- Prefer custom hooks and theming patterns for state and style.
- Reference existing components for UI conventions.
- Use utility scripts for project maintenance.
