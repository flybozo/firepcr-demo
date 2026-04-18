#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# sync-to-demo.sh — White-label sync from RAM Field Ops → FirePCR Demo
#
# Copies production source into the demo repo, applies branding
# replacements, and commits + pushes. Designed to run both locally
# and in GitHub Actions.
#
# Usage:
#   ./scripts/sync-to-demo.sh              # local (repos in /tmp)
#   ./scripts/sync-to-demo.sh --ci         # in GitHub Actions
# ──────────────────────────────────────────────────────────────
set -euo pipefail

CI_MODE=false
if [[ "${1:-}" == "--ci" ]]; then
  CI_MODE=true
fi

# ── Paths ──────────────────────────────────────────────────────
PROD_DIR="${PROD_DIR:-/tmp/ram-field-ops}"
DEMO_DIR="${DEMO_DIR:-/tmp/firepcr-demo}"

if [[ "$CI_MODE" == true ]]; then
  PROD_DIR="${GITHUB_WORKSPACE:-.}"
  DEMO_DIR="${DEMO_CLONE_DIR:-./firepcr-demo}"
fi

echo "▸ Syncing prod ($PROD_DIR) → demo ($DEMO_DIR)"

# ── Validate repos exist ──────────────────────────────────────
if [[ ! -d "$PROD_DIR/src" ]]; then
  echo "✗ Production repo not found at $PROD_DIR" >&2; exit 1
fi
if [[ ! -d "$DEMO_DIR/.git" ]]; then
  echo "✗ Demo repo not found at $DEMO_DIR" >&2; exit 1
fi

# ── Preserve demo-only files ──────────────────────────────────
DEMO_PRESERVE_DIR=$(mktemp -d)
echo "▸ Preserving demo-only files → $DEMO_PRESERVE_DIR"

# Files that only exist in demo and should survive the sync
for f in \
  .env.production \
  public/firepcr-logo.svg \
  public/firepcr-logo.png \
  public/icons/icon-192.png \
  public/icons/icon-192.svg \
  public/icons/icon-512.png \
  public/icons/icon-512.svg \
  public/icons/icon-maskable.png \
  public/icons/icon-maskable.svg \
  public/icons/apple-touch-icon.png \
; do
  if [[ -f "$DEMO_DIR/$f" ]]; then
    mkdir -p "$DEMO_PRESERVE_DIR/$(dirname "$f")"
    cp "$DEMO_DIR/$f" "$DEMO_PRESERVE_DIR/$f"
  fi
done

# ── Clean demo src/ api/ public/ etc and copy from prod ───────
echo "▸ Copying production source → demo"

# Directories to sync (clean copy)
for dir in src api public scripts sql supabase; do
  rm -rf "$DEMO_DIR/$dir"
  if [[ -d "$PROD_DIR/$dir" ]]; then
    cp -R "$PROD_DIR/$dir" "$DEMO_DIR/$dir"
  fi
done

# Root files to sync
for f in \
  index.html \
  package.json \
  package-lock.json \
  tsconfig.json \
  tsconfig.app.json \
  tsconfig.node.json \
  vite.config.ts \
  eslint.config.js \
  vercel.json \
  .gitignore \
; do
  if [[ -f "$PROD_DIR/$f" ]]; then
    cp "$PROD_DIR/$f" "$DEMO_DIR/$f"
  fi
done

# ── Remove files that shouldn't be in demo ────────────────────
echo "▸ Removing sensitive/internal files from demo"
rm -f "$DEMO_DIR/ARCHITECTURE.md"
rm -f "$DEMO_DIR/SECURITY-AUDIT.md"
rm -rf "$DEMO_DIR/sql"
rm -rf "$DEMO_DIR/supabase"

# ── Restore demo-only files ──────────────────────────────────
echo "▸ Restoring demo-only files"
cp -R "$DEMO_PRESERVE_DIR/"* "$DEMO_DIR/" 2>/dev/null || true
rm -rf "$DEMO_PRESERVE_DIR"

# ── White-label replacements ──────────────────────────────────
echo "▸ Applying white-label transformations"

# Portable sed -i
if sed --version 2>/dev/null | grep -q GNU; then
  SED_I=(sed -i)
else
  SED_I=(sed -i '')
fi

# Apply sed replacements to all text files in demo
# Usage: apply_sed 'expr1' 'expr2' ...
apply_sed() {
  find "$DEMO_DIR" \
    -path "$DEMO_DIR/node_modules" -prune -o \
    -path "$DEMO_DIR/dist" -prune -o \
    -path "$DEMO_DIR/.git" -prune -o \
    \( -name "*.tsx" -o -name "*.ts" -o -name "*.json" -o -name "*.html" \
       -o -name "*.md" -o -name "*.css" -o -name "*.js" -o -name "*.svg" \) \
    -type f -print0 | while IFS= read -r -d '' file; do
      "${SED_I[@]}" "$@" "$file"
    done
}

# ── Company & Branding ────────────────────────────────────────

# Order matters — do longer/more specific patterns first
apply_sed \
  -e 's/Remote Area Medicine/Ridgeline EMS/g' \
  -e 's/Mossbrae Medical Group P\.C\./Ridgeline Medical Group/g' \
  -e 's/Mossbrae Medical Group PC/Ridgeline Medical Group/g' \
  -e 's/Mossbrae Medical Group/Ridgeline Medical Group/g' \
  -e 's/RAM Field Operations/FirePCR Field Operations/g' \
  -e 's/RAM Field Ops/FirePCR/g'

# ── Domains & URLs ────────────────────────────────────────────
apply_sed \
  -e 's/wildfiremedical\.com/ridgelineems.com/g' \
  -e 's/ram-field-ops\.vercel\.app/firepcr-demo.vercel.app/g' \
  -e 's|https://github\.com/flybozo/ram-field-ops|https://github.com/flybozo/firepcr-demo|g' \
  -e 's|/tmp/ram-field-ops|/tmp/firepcr-demo|g' \
  -e 's/ram-field-ops/firepcr-demo/g'

# ── Unit Names (order: longer first) ─────────────────────────
apply_sed \
  -e 's/RAMBO 1/Medic 1/g' \
  -e 's/RAMBO 2/Medic 2/g' \
  -e 's/RAMBO 3/Medic 3/g' \
  -e 's/RAMBO 4/Medic 4/g' \
  -e 's/RAMBO 5/Medic 5/g' \
  -e "s/'RAMBO'/'Medic'/g" \
  -e 's/"RAMBO"/"Medic"/g' \
  -e 's/REMS 1/Rescue 1/g' \
  -e 's/REMS 2/Rescue 2/g' \
  -e 's/REMS 3/Rescue 3/g' \
  -e "s/'REMS'/'Rescue'/g" \
  -e 's/"REMS"/"Rescue"/g' \
  -e 's/MSU 1/Aid 1/g' \
  -e 's/MSU 2/Aid 2/g' \
  -e 's/MSU 3/Aid 3/g' \
  -e "s/'MSU'/'Aid'/g" \
  -e 's/"MSU"/"Aid"/g' \
  -e 's/The Beast/Command 1/g'

# Catch remaining standalone REMS references
apply_sed \
  -e 's/REMS Capable/Rescue Capable/g' \
  -e 's/REMS Leader/Rescue Leader/g' \
  -e 's/REMS operations/Rescue operations/g' \
  -e 's/REMS capable/Rescue capable/g' \
  -e 's/rems_capable/rescue_capable/g'

# ── People & Identities ──────────────────────────────────────
apply_sed \
  -e 's/Aaron Stutz, MD/Dr. A. Mitchell, MD/g' \
  -e 's/Aaron Stutz MD/Dr. A. Mitchell MD/g' \
  -e 's/Aaron Stutz/Dr. A. Mitchell/g' \
  -e 's/Rodney Look, MD/Dr. R. Chen, MD/g' \
  -e 's/Rodney Look MD/Dr. R. Chen MD/g' \
  -e 's/Rodney Look/Dr. R. Chen/g' \
  -e 's/Robert K\. Evans, MD/Dr. R. Evans, MD/g' \
  -e 's/Robert Evans/Dr. R. Evans/g' \
  -e 's/Zach Smith/Z. Taylor/g' \
  -e 's/Carly F Brown/C. Davis/g' \
  -e 's/Cody Sims/C. Williams/g'

# ── Email addresses ───────────────────────────────────────────
apply_sed \
  -e 's/codsworth@ridgelineems\.com/assistant@ridgelineems.com/g' \
  -e 's/codsworth@/assistant@/g' \
  -e 's/aaron@ridgelineems\.com/admin@ridgelineems.com/g' \
  -e 's/aaronstutz@gmail\.com/admin@ridgelineems.com/g' \
  -e 's/dogpatchmedic@gmail\.com/ops@ridgelineems.com/g' \
  -e 's/rlook1@gmail\.com/finance@ridgelineems.com/g' \
  -e 's/robby@ruralpacmed\.com/partner@ridgelineems.com/g' \
  -e 's/carlyfbrown@gmail\.com/former-ops@ridgelineems.com/g'

# ── Codsworth → AI Assistant ──────────────────────────────────
apply_sed \
  -e 's/You are Codsworth, assistant to/You are the AI assistant for/g' \
  -e 's/You are Codsworth, an AI assistant for/You are the AI assistant for/g' \
  -e 's/Codsworth/AI Assistant/g'

# ── Logo URLs → local FirePCR logo ───────────────────────────
apply_sed \
  -e 's|https://kfkpvazkikpuwatthtow\.supabase\.co/storage/v1/object/public/headshots/ram-logo\.png|/firepcr-logo.png|g'

# Also remove the ram-logo.svg/png from public if copied over
rm -f "$DEMO_DIR/public/ram-logo.svg" "$DEMO_DIR/public/ram-logo.png"

# ── NEMSIS placeholder IDs ────────────────────────────────────
apply_sed -e 's/S65-52014/S00-00000/g'

# ── VAPID / push notification emails ─────────────────────────
apply_sed \
  -e 's/mailto:assistant@ridgelineems\.com/mailto:notifications@ridgelineems.com/g'

# ── Employee email list in credential intake (strip real emails) ──
apply_sed \
  -e 's/pwbailey2010@gmail\.com/employee1@example.com/g' \
  -e 's/butler\.matt\.r@gmail\.com/employee2@example.com/g' \
  -e 's/stephaniecasteel@att\.net/employee3@example.com/g' \
  -e 's/helenorajohnson@gmail\.com/employee4@example.com/g'

# ── Clean up the employee chat context for demo ──────────────
# Replace the full chat context files with de-identified versions
cat > "$DEMO_DIR/api/_employee-chat-context.md" << 'CHATEOF'
# Ridgeline EMS — Employee Chat Context

This document provides context for the AI assistant embedded in the FirePCR app.

## About Ridgeline EMS
Ridgeline EMS is an EMS organization providing medical services for wildfire and emergency operations.

- **Medical Director:** Dr. A. Mitchell, MD (admin@ridgelineems.com)
- **Operations Manager:** Z. Taylor (ops@ridgelineems.com)

## Units
- **Medic 1-4** — Ambulance units (ALS-equipped)
- **Aid 1-2** — Medical Support Units
- **Rescue 1-2** — Technical Rescue / Remote Emergency Medical Services
- **Command 1** — Mobile command / mass casualty unit

## FirePCR App Features
The FirePCR app handles:
- Patient encounters (PCR charting)
- Medication administration records
- Controlled substances tracking
- ICS 214 unit logs
- Supply run management
- Crew scheduling
- External fire incident dashboards
- OSHA 301 / Workers' comp claims
- Consent forms (digital signatures)
- Push notifications

## Key Policies
- All patient encounters require digital signature
- Controlled substances require witnessed counts
- ICS 214 entries auto-generate from encounter data
- External dashboards are access-code protected
CHATEOF

cp "$DEMO_DIR/api/_employee-chat-context.md" "$DEMO_DIR/public/employee-chat-context.md"

# ── Update index.html ─────────────────────────────────────────
# Already handled by the find_text_files replacements above
# Just make sure title is FirePCR
"${SED_I[@]}" 's/<title>.*<\/title>/<title>FirePCR<\/title>/' "$DEMO_DIR/index.html"
"${SED_I[@]}" 's/content="RAM Field Ops"/content="FirePCR"/' "$DEMO_DIR/index.html"

# ── Update manifest.json ──────────────────────────────────────
cat > "$DEMO_DIR/public/manifest.json" << 'MANEOF'
{
  "name": "FirePCR",
  "short_name": "FirePCR",
  "description": "Field Operations & Patient Care for Fire Medical Teams",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#030712",
  "theme_color": "#0066ff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
MANEOF

# ── Update service worker cache name ─────────────────────────
if [[ -f "$DEMO_DIR/public/sw.js" ]]; then
  # Bump the cache version to force refresh
  CURRENT_VER=$(grep -o "firepcr-v[0-9]*" "$DEMO_DIR/public/sw.js" | head -1 | grep -o "[0-9]*")
  if [[ -n "$CURRENT_VER" ]]; then
    NEXT_VER=$((CURRENT_VER + 1))
    "${SED_I[@]}" "s/firepcr-v${CURRENT_VER}/firepcr-v${NEXT_VER}/" "$DEMO_DIR/public/sw.js"
  fi
  # Make sure SW references FirePCR not RAM
  "${SED_I[@]}" 's/RAM Field Ops/FirePCR/g' "$DEMO_DIR/public/sw.js"
fi

# ── Write/update demo AGENT-HANDOFF.md ────────────────────────
cat > "$DEMO_DIR/AGENT-HANDOFF.md" << 'HANDOFF'
# FirePCR Demo — Agent Handoff

## What is this?
This is the **white-label demo** of FirePCR, a Progressive Web App for wildfire medical field operations. It's automatically synced from the production repo with all company-specific branding, names, and data removed.

## URLs
- **Demo:** https://demo.firepcr.com (also: https://firepcr-demo.vercel.app)
- **GitHub:** https://github.com/flybozo/firepcr-demo

## Demo Database
- Supabase project: jlqpycxguovxnqtkjhzs (separate from production)
- Demo accounts: admin@ridgelineems.com, demo@firepcr.com (password: RAMops2026!)

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
HANDOFF

# ── Update demo README ────────────────────────────────────────
cat > "$DEMO_DIR/README.md" << 'READMEEOF'
# FirePCR Demo

White-label demo of FirePCR — Field Operations & Patient Care for Fire Medical Teams.

**Live:** https://demo.firepcr.com

This repo is automatically synced from the production codebase with all company-specific
branding removed. See [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) for details.

## Stack
- React + TypeScript + Vite
- Supabase (auth, database, storage)
- Tailwind CSS
- Vercel (hosting + serverless API)
- PWA with offline support

## Development
```bash
npm install
npm run dev
```
READMEEOF

# ── Final verification ────────────────────────────────────────
echo ""
echo "▸ Checking for remaining RAM/branded references..."
REMAINING=$(grep -rn "Remote Area Medicine\|Mossbrae\|RAMBO\|codsworth\|wildfiremedical\|ram-field-ops\|Aaron Stutz\|Rodney Look\|aaronstutz\|dogpatchmedic\|rlook1\|ram-logo" \
  --include="*.tsx" --include="*.ts" --include="*.html" --include="*.json" --include="*.md" --include="*.css" --include="*.svg" --include="*.js" \
  "$DEMO_DIR" 2>/dev/null \
  | grep -v node_modules \
  | grep -v "\.git/" \
  | grep -v dist/ \
  || true)

if [[ -n "$REMAINING" ]]; then
  echo "⚠️  Found remaining branded references:"
  echo "$REMAINING"
  echo ""
  echo "These may need manual cleanup or additional sed rules."
else
  echo "✓ No branded references found — clean white-label!"
fi

# ── Get prod version for commit message ───────────────────────
PROD_VERSION=$(cd "$PROD_DIR" && git log --oneline -1 | head -1)
echo ""
echo "▸ Prod HEAD: $PROD_VERSION"

# ── Commit and push (if there are changes) ────────────────────
cd "$DEMO_DIR"
git add -A

if git diff --cached --quiet; then
  echo "✓ No changes to commit — demo is already in sync"
else
  COMMIT_MSG="sync: white-label from prod — $PROD_VERSION"
  git commit -m "$COMMIT_MSG"
  
  if [[ "$CI_MODE" == true ]]; then
    git push
  else
    echo ""
    echo "▸ Changes committed. Push with:"
    echo "  cd $DEMO_DIR && git push"
    read -p "Push now? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      git push
      echo "✓ Pushed to demo repo"
    else
      echo "▸ Skipped push — run 'cd $DEMO_DIR && git push' when ready"
    fi
  fi
fi

echo ""
echo "✓ Sync complete!"
