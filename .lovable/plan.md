

# Branding Update: Centerfrios

Replacing the "meuevento" identity with your **Centerfrios** brand throughout the application.

## Brand Identity Extracted

From your brand guide:
- **Name**: CENTERFRIOS — tagline "Crescendo com você"
- **Colors**: Blue (primary) and Yellow (accent) — the current rose-red/blue primary will be replaced
- **Logo**: The uploaded penguin logo will be used

## What Changes

### 1. Logo & Assets
- Copy your uploaded logo (`Logomarca_center_frios.png`) into `src/assets/`
- Update `src/components/Logo.tsx` to use the new logo image and display "CENTERFRIOS" as the brand name

### 2. Color Palette (src/index.css)
- **Primary**: Change from blue (`235 80% 58%`) to Centerfrios blue (~`217 85% 45%`)
- **Accent/Warning**: Update to Centerfrios yellow (~`45 95% 55%`)
- **Ring/sidebar-primary**: Match the new blue
- Dark mode variants updated accordingly

### 3. App Name References (6 files)
- `index.html` — title, og:title, twitter:title
- `src/pages/Landing.tsx` — all "meuevento" text → "Centerfrios"
- `src/pages/Register.tsx` — "Powered by" footer
- `src/components/layout/AppSidebar.tsx` — sidebar brand name
- `src/components/Logo.tsx` — brand text

### 4. Memory Files
- Update `mem://index.md` core rules and relevant memory files to reflect new brand identity

## Technical Notes
- The Logo component will use an `<img>` tag with the full Centerfrios logo (which already contains the penguin + text), sized appropriately per the existing sm/md/lg presets
- CSS variable changes propagate automatically to all components using the design system
- No database or backend changes needed

