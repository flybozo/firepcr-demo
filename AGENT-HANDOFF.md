# FirePCR Demo — Agent Handoff

## What is this?
This is the **white-label demo** of FirePCR, a Progressive Web App for wildfire medical field operations. It's automatically synced from the production repo with all company-specific branding, names, and data removed.

## URLs
- **Demo:** https://demo.firepcr.com (also: https://firepcr-demo.vercel.app)
- **GitHub:** https://github.com/flybozo/firepcr-demo

## Demo Database
- Supabase project: jlqpycxguovxnqtkjhzs (separate from production)
- Demo accounts: admin@ridgelineems.com, demo@firepcr.com (password: DemoPass2026!)

## Branding
- Company: "Ridgeline EMS" / "Ridgeline Medical Group"
- Units: Medic 1-4, Aid 1-2, Rescue 1-2, Command 1
- Logo: /public/firepcr-logo.svg

## Sync Process
This repo is automatically updated via GitHub Actions on the production repo.
Every push to `main` on the production repo triggers a white-label sync.
Do NOT manually edit source files here — they will be overwritten on next sync.

### What to edit in this repo:
- `.env.production` (demo Supabase credentials)
- `public/firepcr-logo.svg` (demo logo)
- `public/icons/*` (demo app icons)
- `AGENT-HANDOFF.md` (this file — but it gets regenerated on sync)

### What gets auto-synced:
- All source code (`src/`, `api/`, `public/` minus preserved files)
- Config files (package.json, tsconfig, vite config, etc.)
- White-label transformations applied automatically
