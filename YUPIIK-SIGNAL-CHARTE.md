# Yupiik Signal — proposed visual design system

Status: design proposal for review, not an approved corporate brandbook.
Scope: the Yupiik Open Source landing page (`public/index.html`) and optional static project landing pages.
Source baseline reviewed: https://github.com/yupiik/yupiik.github.io/blob/main/public/index.html (2026-11-14).

## Product and brand intent

**Positioning:** An engineering-first open source ecosystem: pragmatic Java, Kubernetes, MCP, and data engineering solutions.

**Voice:** Precise, calm, competent, welcoming. Avoid exaggerated promises and fake metrics.

**Editorial headline:** `Build boldly. Ship openly.`

**Support text:** `Pragmatic open source tools for Java, Kubernetes, AI integrations, and data engineering.`

**Visual identity:** high-contrast green signal over deep pine-black / warm cloud-white; subtle technical grid; meaningful diagrams and code rather than stock photos or excessive gradients.

Keep the official Yupiik logo. The hand-drawn chevron mark in the preview is only a temporary illustrative placeholder, not a replacement logo.

## Brand palette

| Semantic token | Dark | Light | Meaning |
| --- | --- | --- | --- |
| `--color-bg` | `#0B1210` | `#F5F8F4` | Page background |
| `--color-surface` | `#111C17` | `#FFFFFF` | Card background |
| `--color-surface-raised` | `#17241D` | `#EAF2E9` | Interactive surface |
| `--color-border` | `#2B3D33` | `#CAD9CA` | Fine strokes |
| `--color-text` | `#EEF7EF` | `#16301E` | Body text |
| `--color-muted` | `#A7B9AD` | `#546B5A` | Muted body text |
| `--color-accent-text` | `#62E83B` | `#277A1D` | Accessible accent text |
| `--color-accent-fill` | `#62E83B` | `#62E83B` | CTA fill with dark foreground |
| `--color-accent-foreground` | `#0D2B0D` | `#0D2B0D` | Text on accent fill |

Contrast ratios (calculated against the primary background, not a substitute for testing every component):
- Dark foreground: 17.31:1.
- Dark muted: 9.19:1.
- Dark accent: 11.84:1.
- Light foreground: 13.29:1.
- Light muted: 5.41:1.
- Light accent text: 5.05:1.
- Dark text on lime CTA: 9.59:1.

Do not use `#62E83B` as small text on a white background; use `#277A1D` there.

## Typography

- Headlines: `Space Grotesk`, 700-800 weight, system-ui fallback.
- Body: `Inter`, 400-600 weight, system-ui fallback.
- Short metadata and technical labels: `JetBrains Mono`, 500-700 weight, ui-monospace fallback.
- Preferred font loading: self-host under `public/assets/fonts/` if fonts can be licensed for redistribution; otherwise use system-ui fallbacks. Do not introduce a font CDN as a runtime requirement.
- Desktop H1: clamp 44-77px; H2 32-45px; card titles 19-25px; body 16-18px.
- Mobile H1: 42-48px; H2 30-36px; body 16px.
- Body line-height: 1.55-1.7.

## Layout and spacing

- Content max-width: 1280px; desktop side margins: 32px; mobile 18px.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80 / 96px.
- Default border radius: 10px buttons, 15px project cards, 20px prominent visual.
- Project grid: 3 columns >=1100px, 2 at tablet widths, 1 column on phones.
- Featured: visually distinct 3-card selection; keep the full searchable catalog below.
- Hero: concise left-aligned text, one primary CTA, one secondary CTA, informative diagram to the right on desktop.
- No automatic carousels, parallax, unnecessary motion, video headers, or large decorative bitmaps.

## Site information architecture

Header: `Projects | Featured | Ecosystem | Community | GitHub`.
Hero: clear mission + project CTA.
Featured projects: Fusion, BundleBee, Fusion MCP Server (editable curated selection).
Catalog: all verified projects, accessible category filter and text search.
Story: short explanation of why the OSS ecosystem exists and how to contribute.
Footer: GitHub organization, company site, license/contribution links where appropriate.

The project cards remain semantic HTML authored in `public/index.html`. JavaScript progressively enhances filtering and theme choice. Do not introduce a static site generator, Maven build for the site, framework, remote GitHub discovery, or project-level `oss.json` files.

## Card content contract

Every card should have:
1. One short category label.
2. Project name (H3).
3. One-sentence benefit-oriented description, based on verified documentation.
4. Two or three technology tags.
5. Distinct text links for Documentation and GitHub.

Optional after verification: latest release date/version, `Get started` section, related project links.
Never fabricate project maturity, usage statistics, GitHub stars, contributors, roadmap, version, or performance numbers.

## Theme behavior

**Dark mode is the default** for first-time visitors and when no valid saved theme exists. Do **not** default to the operating system preference (`prefers-color-scheme` must not override this product decision). Keep the light mode available with a visible theme switch.

- Persist an explicitly chosen `dark` or `light` theme in `localStorage`; preserve the existing production storage key when implementing the redesign, rather than silently resetting users' previous choices.
- On first visit, when storage is unavailable, or when the saved value is invalid: use `dark`.
- Apply the persisted preference before initial paint (a minimal inline script in `<head>` is acceptable) to avoid a flash of the wrong theme.
- Keep `color-scheme` in sync with the active palette for native controls.
- Update the toggle's accessible label and visible text to describe the **next** available mode.
- Test the default dark mode even when the OS is configured to prefer light, and the persisted light choice on reload.

The standalone prototype uses `yupiik-signal-theme` as its demonstration storage key; adapt it to the existing key in production.

## Accessibility and motion

- WCAG 2.2 AA intended, subject to actual automated and manual audits.
- Visible focus ring; keyboard-operable buttons/filters; meaningful link text; skip navigation.
- Search/filter result counts should be conveyed through `role=status` or `aria-live`.
- Do not use color as the only status indicator.
- 44x44px preferred touch targets for primary interactions.
- Reduced motion supported; hover does not hide essential information.
- Ensure the mobile menu remains fully operable with keyboard and screen readers.

## SEO and social sharing

Keep canonical URL, HTML metadata, structured data and project link discoverability. Create a real social card at 1200x630 rather than using only a horizontal logo as the large preview. Preserve existing documentation routes and validate links.

## Implementation sequencing

1. Refactor current CSS in place to semantic design tokens, with **dark as the default**, retaining the optional light mode and stored user choices.
2. Build refreshed header, hero, featured projects and the project grid.
3. Keep all nine existing project entries and their destinations; add Coding Agent only once the correct public repository and documentation are verified.
4. Validate with a local static server, then Chromium on desktop/tablet/mobile (including JS disabled).
5. Run accessibility checks and verify internal/external links.
6. Preview social card rendering and verify SEO and canonical URLs.
7. Submit a pull request; do not deploy without approval.

## Design review checklist

- [ ] Uses approved official Yupiik logo and corrected theme variants.
- [ ] Preserves all existing project information and links.
- [ ] New hierarchy is readable without animations or JS.
- [ ] Meets color contrast and mobile tap target requirements.
- [ ] Search and filters work with keyboard and screen readers.
- [ ] Desktop and mobile screenshots have been reviewed.
- [ ] Dark is the first-visit default even on light-mode operating systems.
- [ ] An explicitly saved light preference survives a reload without flashing dark.
- [ ] Light and dark themes have been reviewed.
- [ ] Page stays hand-maintained under `public/`.
