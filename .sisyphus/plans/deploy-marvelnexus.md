# Deploy Marvel Nexus to marvelnexus.com

## Overview
Marvel Nexus is a pure static site (31 files, 6.14 MB). No build step, no server runtime. Deploy via Netlify (free tier) with a custom domain purchased through Cloudflare Registrar.

## Phase 1: Update domain references

All 10 occurrences of `marvelwatchlist.com` in `index.html` must change to `marvelnexus.com`.

### Lines to update in `index.html`:

| Line | Current | New |
|------|---------|-----|
| 12 | `<link rel="canonical" href="https://marvelwatchlist.com/">` | `https://marvelnexus.com/` |
| 21 | `<meta property="og:url" content="https://marvelwatchlist.com/">` | `https://marvelnexus.com/` |
| 22 | `<meta property="og:image" content="https://marvelwatchlist.com/Desktop.png">` | `https://marvelnexus.com/Desktop.png` |
| 26 | `<meta name="twitter:image" content="https://marvelwatchlist.com/Desktop.png">` | `https://marvelnexus.com/Desktop.png` |
| 33 | `"@id": "https://marvelwatchlist.com/#website"` | `https://marvelnexus.com/#website` |
| 34 | `"url": "https://marvelwatchlist.com/"` | `https://marvelnexus.com/` |
| 41 | `"@id": "https://marvelwatchlist.com/#organization"` | `https://marvelnexus.com/#organization` |
| 43 | `"url": "https://marvelwatchlist.com/"` | `https://marvelnexus.com/` |
| 46 | `"url": "https://marvelwatchlist.com/assets/logo.png"` | `https://marvelnexus.com/assets/logo.png` |
| 47 | `"contentUrl": "https://marvelwatchlist.com/assets/logo.png"` | `https://marvelnexus.com/assets/logo.png` |

This is a single `replaceAll` edit: `marvelwatchlist.com` -> `marvelnexus.com`.

## Phase 2: Create `.gitignore`

```gitignore
# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo

# Dev tools (not needed in production)
data/build-ott.js
.sisyphus/

# Screenshots
v2-*.png
```

## Phase 3: Git repo + push

```bash
cd "D:\Marvel Nexus"
git init
git add .
git commit -m "Initial deploy: Marvel Nexus timeline"
git remote add origin https://github.com/<USERNAME>/marvel-nexus.git
git branch -M main
git push -u origin main
```

## Phase 4: Deploy to Netlify

1. Go to https://app.netlify.com
2. "Add new site" > "Import an existing project"
3. Connect GitHub repo `marvel-nexus`
4. Settings:
   - **Build command:** (leave empty — no build step)
   - **Publish directory:** `.` (root)
5. Deploy. Netlify gives you a `*.netlify.app` URL.

## Phase 5: Buy domain

1. Go to https://dash.cloudflare.com > Registrar > Registration
2. Search `marvelnexus.com`
3. Buy (~$10/year at cost)
4. After purchase, note the nameservers Cloudflare assigns.

## Phase 6: Connect domain to Netlify

### In Netlify:
1. Site settings > Domain management > Add custom domain
2. Enter `marvelnexus.com`
3. Netlify shows you two nameservers (e.g., `something.dnsnetlify.com`)

### In Cloudflare (DNS):
1. Go to Domain Registration > your domain > Registration > Nameservers
2. Replace Cloudflare's default nameservers with the two Netlify gave you
3. Wait up to 24h for propagation (usually < 1h)

### SSL:
Netlify provisions a free Let's Encrypt certificate automatically once DNS resolves.

## Phase 7: Verify post-deploy

- [ ] `https://marvelnexus.com/` loads the timeline
- [ ] `https://marvelnexus.com/manifest.webmanifest` returns JSON
- [ ] Service worker registers (DevTools > Application > Service Workers)
- [ ] OG tags render correctly (use https://www.opengraph.xyz/)
- [ ] PWA install prompt appears on mobile
- [ ] Timeline stars, detail panels, OTT links all work
- [ ] Share card canvas renders (no CORS issues)
- [ ] TMDB images load (they're absolute URLs to `image.tmdb.org`)

## Files changed
- `index.html` — 10 replacements (marvelwatchlist.com → marvelnexus.com)
- `.gitignore` — new file

## Notes
- Service worker scope is relative (`./`) — works on any domain without changes
- Manifest `start_url` and `scope` are relative — no changes needed
- Google Fonts loaded from `fonts.googleapis.com` — domain-independent
- TMDB images use absolute URLs — no CORS issues
- `sw.js` cache name `marvel-nexus-v42` — fine as-is, will bust on deploy
- `data/build-ott.js` excluded from git (dev-only tool)
- Total repo size after `.gitignore`: ~6 MB (well within GitHub/LFS limits)
