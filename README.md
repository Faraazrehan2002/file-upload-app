# Secure File Upload

A full-stack app for registering, logging in, uploading files, and downloading your own uploads. Each user only sees and can download their own files.

## Features

- User registration and login with JWT authentication
- Password reset via secure, time-limited tokens (1 hour)
- File upload (PDFs, images, documents, and more) up to 100 MB
- Per-user file list with size and MIME type
- Secure downloads scoped to the logged-in user

## Tech Stack

| Layer    | Technologies                                      |
| -------- | ------------------------------------------------- |
| Frontend | React, Vite, Axios, Fetch API                     |
| Backend  | Node.js, Express, Multer, Prisma, SQLite, JWT     |

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- npm

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and set a strong `JWT_SECRET` for anything beyond local development.

Apply the database schema:

```bash
npx prisma migrate dev
```

### 2. Frontend

```bash
cd frontend
npm install
```

## Running the App

Start the API and the UI in two terminals.

**Terminal 1 — backend**

```bash
cd backend
npm run dev
```

The API runs at `http://localhost:5001`.

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser. During development, Vite proxies `/api` requests to the backend, so you do not need to configure a separate API URL in the frontend.

## Usage

1. Create an account on the **Register** tab.
2. Log in on the **Login** tab.
3. Choose a file, confirm the selected name and size, then click **Upload File**.
4. Download any file from **Your Files**.

### Password reset

1. On the login screen, click **Forgot password?**
2. Enter your account email and submit.
3. In local development with `EXPOSE_RESET_LINK=true`, the app shows a **Development reset link** — open it to set a new password.
4. Enter a new password (at least 8 characters), confirm it, and log in.

Reset links expire after one hour. Requesting a new reset invalidates any previous link for that account.

### Upload tips (macOS)

If a file is stored in iCloud, the browser may take a long time to read it. Open the file in Preview or copy it to **Downloads** first, then upload from there.

## API Endpoints

| Method | Path                         | Auth     | Description              |
| ------ | ---------------------------- | -------- | ------------------------ |
| POST   | `/api/auth/register`         | No       | Create an account        |
| POST   | `/api/auth/login`            | No       | Log in, receive JWT      |
| POST   | `/api/auth/forgot-password`  | No       | Request password reset   |
| POST   | `/api/auth/reset-password`   | No       | Set new password with token |
| GET    | `/api/files`                 | Bearer   | List current user's files |
| POST   | `/api/files/upload`          | Bearer   | Upload one file (`file`) |
| GET    | `/api/files/:id/download`    | Token*   | Download a file          |

\* Download accepts the JWT via `Authorization: Bearer` or `?token=` query parameter.

## Project Structure

```
file-upload-app/
├── backend/
│   ├── prisma/          # Schema and migrations
│   ├── src/
│   │   ├── server.js    # Express app and routes
│   │   ├── auth.js           # JWT middleware
│   │   ├── passwordReset.js  # Reset token helpers
│   │   ├── upload.js         # Multer configuration
│   │   └── db.js             # Prisma client
│   └── uploads/         # Stored files (created on upload)
└── frontend/
    └── src/
        ├── App.jsx      # UI and API calls
        └── App.css      # Styles
```

## Environment Variables

| Variable       | Description                          | Example              |
| -------------- | ------------------------------------ | -------------------- |
| `DATABASE_URL` | SQLite database path for Prisma      | `file:./dev.db`      |
| `JWT_SECRET`   | Secret for signing JWTs              | (long random string) |
| `PORT`              | API port                                    | `5001`                  |
| `FRONTEND_URL`      | Base URL for password reset links           | `http://localhost:5173` |
| `EXPOSE_RESET_LINK` | Return reset URL in API response (dev only) | `true`                  |

## Netlify (frontend) + API host (backend)

Netlify only serves the React app. The Express API must run elsewhere (for example [Render](https://render.com), Railway, or Fly.io).

### 1. Deploy the backend

Host the `backend/` folder as a Node web service. Set `DATABASE_URL`, `JWT_SECRET`, and:

```env
CORS_ORIGIN=https://your-site-name.netlify.app
FRONTEND_URL=https://your-site-name.netlify.app
EXPOSE_RESET_LINK=false
```

Note the public API URL, e.g. `https://file-upload-api.onrender.com`.

### 2. Configure Netlify

In **Site configuration → Build & deploy**:

| Setting            | Value        |
| ------------------ | ------------ |
| Base directory     | `frontend`   |
| Build command      | `npm run build` |
| Publish directory  | `dist`       |

(Or connect the repo and use the root `netlify.toml`, which sets these automatically.)

In **Environment variables**, add:

| Key             | Value                                      |
| --------------- | ------------------------------------------ |
| `VITE_API_URL`  | `https://your-api-host.com/api` (no trailing slash on host; include `/api`) |

Trigger a **new deploy** after saving — Vite bakes this in at build time.

### 3. Why it looked broken

- **`/api` on Netlify** does not reach your Node server unless you proxy or set `VITE_API_URL`.
- **Wrong build folder** (repo root instead of `frontend`) produces an empty or unstyled site.

## Production Notes

- Set `EXPOSE_RESET_LINK=false` in production and deliver reset links by email (or another secure channel) instead of API responses.
- Replace `JWT_SECRET` with a cryptographically random value.
- Use a production-grade database instead of SQLite if you deploy at scale.
