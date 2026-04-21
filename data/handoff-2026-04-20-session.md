# FirePCR — Session Handoff (2026-04-20 10:32 AM PT)

## Current State
- **Prod:** `/tmp/firepcr-demo` → https://firepcr-demo.vercel.app ✅ Up to date
- **Demo:** `/tmp/firepcr-demo` → https://demo.firepcr.com ⚠️ Not synced with today's changes yet
- **GitHub:** `flybozo/firepcr-demo` ✅ Pushed (latest: `4f25d87`)
- **Supabase prod:** `kfkpvazkikpuwatthtow` | pw: `93RV8nx4J^VGR!6V`
- **Supabase demo:** `jlqpycxguovxnqtkjhzs` | pw: `EplVimePP35Zi9MY`

---

## What Was Done This Session (2026-04-20)

### Post-Phase 4 Audit — ALL 9 FIXES COMPLETE ✅
| # | Fix | Commit |
|---|-----|--------|
| 1 | IncidentDetail dead constant | Prior session |
| 2 | DeploymentsCard unused `deployments` prop | `506a5dd` |
| 3 | Auth token null-safety (3 files) | `506a5dd` |
| 4 | MARDetail unit query null guard | `506a5dd` |
| 5 | Offline queue — 4 Phase 4 components | `0da5959` |
| 6 | `confirm()` → ConfirmDialog (15 sites) | `1cfc1c8` |
| 7 | Toast system + `alert()` migration (47 calls, 24 files) | `8c15a4f` |
| 8 | `as any` reduction (14 casts removed) | `9273553` |
| 9 | ESLint `no-alert` + `no-console` rules | `1eef9ea` |

### Phase 4 Wave 2 Decomposition ✅
| Component | Before → After | Commit |
|-----------|---------------|--------|
| MARNew.tsx | 1,065 → 135 | `4e5a207` |
| Analytics.tsx | 965 → 59 | `0a6c37b` |
| NewCompClaim.tsx | 925 → 199 | `03f298d` |
| UnitDetail.tsx | 879 → 124 | `6e91829` |

### Phase 4 Wave 3 Decomposition ✅
| Component | Before → After | Commit |
|-----------|---------------|--------|
| ThemeProvider.tsx | 855 → 5 | `0f87890` |
| ICS214Detail.tsx | 789 → 170 | `de3c673` |
| Profile.tsx | 745 → 198 | `5ba8576` |
| AMAConsent.tsx | 767 → 120 | `900ac1c` |

### Agency Logos Feature ✅
- New `AgencyLogo` component — `src/components/AgencyLogo.tsx`
- Logo files in `public/agency-logos/`
- Logos in app: Cal Fire (SVG), USFS (SVG), BLM (PNG), NPS (PNG), ODF (PNG), Cal OES (PNG), CCC (PNG), DOD (PNG), BIA (PNG), USFWS (PNG)
- Emojis: 🧑‍🚒 County/Municipal/Local/State Fire, 👮 Law Enforcement, 👤 Private Contractor/Other
- Agency dropdown updated in `EncounterDetail.tsx` + `src/constants/nemsis.ts`
- `patient_agency` added to `Encounter` type (enables realtime logo swap)
- Commits: `bda6a3d` → `4f25d87` (multiple)

### DM Bug Fix ✅
- **Bug:** Owner (Aaron) was being added as a visible participant when creating DMs between other employees
- **Fix:** `api/chat/channels.ts` — when `is_owner` creates a DM with 2+ `employee_ids`, don't add self to participants
- **DB cleanup:** Removed Aaron from existing 3-person Dolores/Robert/Aaron DM in prod
- Commit: `4f25d87`

### Other Fixes
- Incident dropdown caret spacing: `pr-8` — `6cce35b`
- Demo DB migrations applied: `is_owner`, `is_medical_director`, `roles[]` columns

---

## Pending / Next Steps

### High Priority
1. **Demo sync** — not synced with today's changes. Run demo rsync + build + push
2. **ODF IRA 2026-2029** — Application open, deadline May 31, 2026. Medical Resources (Appendix 8) eligible. Need: OregonBuys vendor registration, W-9, insurance docs.
3. **Fort Irwin ambulance contract** — Sources Sought closes Apr 27 (7 days!)

### App — Remaining Refactoring
- **Phase 5:** Feature module colocation (`src/features/...`) — medium effort, good sub-agent work
- **Phase 6:** Granular RBAC (`usePermission('financial.view')`) — stretch goal
- **Phase 4 continued audit targets:** Still some 600-800 line components if desired

### App — Pending Features
- Persistent notification bell (unread panel, mark-as-read)
- Comp claims detail page
- Supabase Realtime for chat (`ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages`)
- Field user UX walkthrough (boss hasn't done full field user review)
- Payroll system (blocked on bookkeeper pay schedule info)

### Infrastructure
- **Hetzner production + self-hosted Supabase** — saves ~$4K/yr vs Supabase HIPAA plan ($350/mo)
- **NEMSIS submission** — XML pipeline complete, need validator credentials from EMSA
- **Supabase BAA** — if staying on cloud: Pro + HIPAA add-on ~$350/mo

---

## Key Files
- Architecture: `ARCHITECTURE.md` (in repo root, updated this session)
- Agency logos component: `src/components/AgencyLogo.tsx`
- Toast system: `src/lib/toast.ts` + `src/components/ui/Toast.tsx`
- Chat channels API: `api/chat/channels.ts` (DM owner fix)
- Phase 4 decomp outputs: `src/components/theme/`, `src/pages/*/components/`

## Demo Sync Pattern
```bash
cd /tmp/firepcr-demo && git pull
rsync -av --delete \
  --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.vercel' \
  --exclude='src/lib/branding.config.ts' \
  /tmp/firepcr-demo/ /tmp/firepcr-demo/
npm run build && git add -A && git commit -m "sync: <description>" && git push origin main
```
Demo uses `branding.demo.ts` — never overwrite during sync.
