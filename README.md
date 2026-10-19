# EstateFlow dashboard (website)

This is the desktop website for Starwiz staff: admin, sales manager, sales executives and accounts. It has no data of its own; everything comes from the **EstateFlow backend**, which must be running.

```
estateflow-dashboard (http://localhost:7340)  ──/api──▶  estateflow-backend (http://localhost:7341)
```

The `shared/` folder is the common code. The backend and the app carry an identical copy.

The public Starwiz website is part of this dashboard too (its code is in `site/`, which the app also carries). Visitors who are not signed in see it at `/`, with **Staff login** in the header; listings are at `/homes`, a property at `/homes/<slug>`, plus `/about` and `/contact`. Signed-in staff get the CRM at `/` and can still open the website pages. Only properties marked **Publish to website** appear.

## Before you start

- **Node.js 22.22 or newer.** Install the latest "LTS" version from nodejs.org. Check with `node -v`.
- Unzip outside OneDrive or Dropbox, to avoid `EPERM` errors during `npm install`.
- Start `estateflow-backend` first (`npm run dev` in that folder).

## Run it on your computer

```bash
cd estateflow-dashboard
npm install
npm run dev
```

Open http://localhost:7340. While the backend runs in demo mode, the sign-in page lists the demo logins (admin@demo.com / Admin@123 and so on). Customers cannot sign in here; they use the app.

During development the website forwards every `/api` request to http://localhost:7341. If your backend runs elsewhere, start with that address instead. In PowerShell:

```powershell
$env:API_PROXY_TARGET="http://192.168.1.20:7341"; npm run dev
```

## Put it online (Netlify)

1. Put the backend online first and note its address, e.g. `https://estateflow-api.onrender.com`.
2. Either connect Netlify to a Git repository that holds this folder, or build it yourself.
   - **From Git:** in Netlify choose Add new site → Import an existing project. `netlify.toml` already has the build settings (`npm run build`, publish `dist`). Under Site configuration → Environment variables, add `VITE_API_URL` = your backend address (no trailing slash, no `/api`).
   - **Manual upload:** run `npm run build`, open `dist/env.js` and set `apiUrl: 'https://estateflow-api.onrender.com'`, then drag the `dist` folder onto Netlify → Add new site → Deploy manually.
3. Add the Netlify address to the backend's `CORS_ORIGINS` setting and restart the backend. If the website gets its own domain (e.g. `www.starwizrealty.com`), point it at this Netlify site and add it to `CORS_ORIGINS` too.

The build also writes `sitemap.xml` (every published property, read from `VITE_API_URL` or `API_URL`) and a `robots.txt` that keeps search engines to the website pages. In `dist/env.js`, `appDownloadUrl` is the customer app link shown in the website footer (empty hides it).

`dist/env.js` can be edited after deployment to point the site at a different backend, without rebuilding.

**One-address option:** if this folder sits next to `estateflow-backend` and you run `npm run build` here, the backend serves the website itself at its own address. Then no Netlify and no CORS setting are needed.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the built `dist/` on :7340, with the same `/api` forwarding |
| `npm run typecheck` | Checks the TypeScript |
| `npm run test:e2e` | Browser tests (20). They need `estateflow-backend` installed in the folder next to this one, or set `EF_BACKEND_DIR`, plus a browser: run `npx playwright install chromium` once |
