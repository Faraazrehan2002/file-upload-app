# One-time production setup

## 1. Deploy the API on Render (~2 minutes)

1. Open: https://render.com/deploy?repo=https://github.com/Faraazrehan2002/file-upload-app
2. Click **Deploy Blueprint**.
3. Wait until the service `faraaz-file-upload-api` is **Live**.
4. Open the service URL (e.g. `https://faraaz-file-upload-api.onrender.com`) — you should see `{"message":"File Upload API is running"}`.

If Render gives your service a **different URL**, update `netlify.toml` proxy `to =` line to match, then push to GitHub.

## 2. Netlify (frontend)

If the site is already connected to GitHub, a new deploy runs automatically after you push.

Otherwise:

1. https://app.netlify.com → **Add new site** → **Import from GitHub**
2. Repo: `Faraazrehan2002/file-upload-app`
3. Build settings are read from `netlify.toml` automatically.
4. Deploy.

No `VITE_API_URL` is required — `netlify.toml` proxies `/api` to Render.

## 3. Optional Render env vars

In the Render dashboard for `faraaz-file-upload-api`:

| Variable       | Example                              |
| -------------- | ------------------------------------ |
| `FRONTEND_URL` | `https://your-app.netlify.app`       |
| `CORS_ORIGIN`  | `*` (default) or your Netlify URL    |

Set `FRONTEND_URL` so password-reset links point to your Netlify site.
