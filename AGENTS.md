# Codex instructions — Yupiik OSS website (static-only)

## Authority and scope

Target repository: `https://github.com/yupiik/yupiik.github.io`.
Target branch: **`main`**. Do not assume the GitHub default branch (`master`) is the active website branch.
The checked-out worktree always wins over remote snapshots: inspect before editing and record differences.

**Mission:** improve the public Yupiik OSS portal while preserving its extremely small, directly deployable static architecture. Read `README-CODEX.md`, then `docs/portal-modernization/` in numbered order before implementation. Follow the phase prompts. All documentation, UI copy, commit messages, and agent-facing content must be in English.

## Non-negotiable architecture

- The ONLY deployable website source is **`public/`**: hand-maintained HTML, CSS, JavaScript, images, and static metadata (e.g., robots.txt, sitemap.xml).
- **No site generator**: no MiniSite, Maven-driven website generation, Java `GenerateProjectsPage`, AsciiDoc rendering, Vite, Astro, Next.js, VitePress, Hugo, Jekyll, SSG, build-time templates, or equivalent.
- **No project-level `oss.json`**, no repository discovery, no GitHub API calls to build the project list, no token required to render the site.
- **No central `projects.json` is required or desired for the portal catalogue.** The source of truth for displayed projects is **semantic HTML in `public/index.html`**. No duplicate JS/JSON catalog and no script that generates HTML cards.
- JavaScript is optional enhancement for client-side filtering, search, and theme switching; primary project content MUST be in HTML before JS executes. No API/backend/database.
- Prefer plain HTML, CSS and vanilla JS. Extract CSS or JS to `public/assets/` only when it materially improves maintainability; no mandatory bundler or dependency installation.
- Site must be previewable as static files and deployable by copying `public/` as-is.
- Keep the existing public domain and indexed documentation URLs. Never move, overwrite, or shadow project documentation paths. Do not change DNS settings without approval.
- A CI validation workflow may use standard tools, but **must not transform or generate the website**. Deploy by uploading the `public/` directory as-is if GitHub Pages is used.

## Real repository observations (verified 2026-11-14)

- Branch `main` contains `public/index.html` with embedded styles, theme logic and a `PROJECTS` JavaScript array of four entries (Fusion, BundleBee, Logging, Tools).
- The current project cards are inserted via `grid.innerHTML`, and the visible DOM list is empty before JS.
- `README.adoc` in `main` still mentions `oss.json`/Maven and must be brought in line with static delivery.
- A legacy `pom.xml` is still browsable on `main`; do not run it as the website build or delete it before checking active workflows/references.
- `CNAME` at repository root currently contains `www.yupiik.io`; verify where the actual Pages artifact expects this file.
- The public root source and release workflow must be checked locally; online evidence did not confirm the active deployment workflow.

## Functional goals

- Present ten named projects across AI & Agents, Java & Frameworks, Cloud Native, Data Engineering, and Developer Tools.
- Preserve and improve existing project URLs, and add Fusion MCP Server, Yupiik Coding Agent, Hop Maven Plugin, Hop JUnit, and Yupiik Batch. Also include Kubernetes Java Descriptors if it is absent from the HTML list.
- Do not publish an unverifiable or private project: Yupiik Coding Agent stays **pending/not rendered** until its official public links, description, licensing and scope have been verified and approved.
- Use useful cards with name, benefit-led description, relevant technologies, Get Started/Documentation and GitHub links where known.
- Make project links and explanatory content available with JS disabled. Filtering and search should progressively enhance pre-rendered HTML and may be unavailable without JS.
- Responsive, keyboard-accessible, WCAG 2.2 AA target, useful title/meta/social data, valid HTML, stable canonical URLs, no layout shifts or broken links.

## Safety / correctness

- Do not invent features, versions, contributors, project links, adoption numbers or release dates. Confirm facts from public documentation and actual repositories where available.
- Do not use `innerHTML` to render project metadata; filter existing elements via `hidden`, classes or other safe DOM attributes. Prefer `textContent` for dynamically set user-visible strings.
- Escape/encode content for its HTML context and validate external URLs. Avoid remote scripts/CDNs; do not add analytics or trackers without approval.
- Preserve keyboard focus, reduced-motion preferences and light/dark behavior.
- Never introduce secrets, personal data, GitHub tokens or third-party API keys.
- Do not publish, push, force-push, tag, change Pages configuration, change DNS, or delete legacy build files without explicit approval.

## Workflow

1. `git status --short`; `git branch --show-current`; inspect tree and existing workflows; confirm `main` context.
2. Inspect `public/index.html`, links, JS, assets, CNAME, sitemap, robots, and README. Record findings in `IMPLEMENTATION-STATUS.md`.
3. Follow the numbered specifications and phase prompts; implement in small, reviewable changes.
4. Replace the JS-generated project cards with semantic HTML cards; keep any JS exclusively for interaction. Update existing structured data to match visible projects.
5. Validate static HTML, links, accessibility, responsive behavior, theme, filtering and no-JS rendering. Use local tests that don't fetch remote APIs.
6. Record commands actually run, results, pending validations, assumptions, and any blocked project information. Update `IMPLEMENTATION-STATUS.md` after each phase.
7. Submit implementation summary and open issues for human review; do not deploy without approval.

## Definition of done

A contributor can open or serve `public/index.html`, read every published project card without JavaScript, navigate to project documentation/GitHub, and deploy precisely the bytes under `public/`. No Maven, MiniSite, `oss.json`, `projects.json`, backend, code generation or build step is required.
