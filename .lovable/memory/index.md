# Project Memory

## Core
- Brand is "Centerfrios" (tagline: "Crescendo com você"). UI in Brazilian Portuguese (pt-BR).
- Free tool: No pricing tiers, no billing, no commercial elements.
- Visuals: Strictly borderless aesthetic, pill-shaped UI (rounded-full). Light mode default.
- Primary color: Centerfrios Blue (HSL 217 85% 45%). Accent: Yellow (HSL 45 95% 55%).
- Typography: Bricolage Grotesque for headings (tracking -0.02em), DM Sans for body.
- Mobile-first: min touch target 44px (h-11), full-width inputs, px-4 padding.
- Architecture: Supabase RLS active, role-based edge functions, horizontal top-bar navigation (no sidebars).

## Memories
- [Image handling](mem://style/image-handling) — Flyer images: no crop, object-contain, pinned to top on mobile
- [Registration architecture](mem://tech/registration-architecture) — Hardened Postgres function, max 2 regs/email, 4KB payload limit
- [Registration templates](mem://features/registration-templates) — Minimal, Split Screen, Landing Page with specific image sizing rules
- [Registration layout](mem://style/registration-layout) — Info hierarchy, text-7xl/3xl titles, 80-85% content width
- [Event wizard](mem://features/event-wizard) — 3-step creation flow, live preview, celebration screen
- [Profile settings](mem://features/profile-settings) — Appearance management, dynamic social links, automatic slug generation
- [Event management](mem://features/event-management-interface) — Inline editing workflow, 2-row header, embedded attendee list
- [Public company profile](mem://features/public-company-profile) — /company/:slug routing, list/grid toggle, 40x40px social icons
- [Attendee management](mem://features/attendee-management) — White background for table/controls, mobile column restrictions
- [Theming system](mem://style/theming-system) — Light mode default, dark mode optional via next-themes
- [Database security](mem://tech/database-security) — Multi-layer hardening, role-based access, restricted storage mutations
- [UX patterns](mem://features/ux-patterns) — Scroll to top on global route changes and wizard step transitions
- [Mobile UX](mem://style/mobile-ux) — Standardized padding, touch targets, and responsive stacking behavior
- [Project concept](mem://project/concept) — Centerfrios white-label SaaS, pt-BR localization, non-technical target audience
- [Visual direction](mem://style/visual-direction) — Borderless clean aesthetic, Centerfrios blue primary, pill-shaped elements
- [Typography](mem://style/typography) — Bricolage Grotesque headings, DM Sans body text
- [Landing page](mem://style/landing-page) — Centered hero, fluid typography, overlapping floating cards, confetti bursts
- [Dashboard navigation](mem://features/dashboard-navigation) — Horizontal borderless top-bar system instead of sidebar
- [Event dashboard](mem://features/event-dashboard) — Rounded-xl aspect-[16/10] cards, stacked metadata, inline badges
- [Integrations](mem://features/integrations) — Categorized list layout with neutral outline-style buttons
- [Auth page](mem://style/auth-page) — Centered branding, decorative low-opacity backgrounds, framer-motion animations
- [Features bento](mem://features/landing-page-features-section) — 5xl bento-grid, DOM-based illustrations with dynamic accents
- [Logo component](mem://tech/logo-component) — Centerfrios penguin logo PNG, standardized sm/md/lg size presets
- [Bento color presets](mem://style/landing-page-bento-color-presets) — Playful, Neutral, and Vivid theme configurations
