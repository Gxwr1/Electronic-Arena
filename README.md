# IPL Auction Multiplayer

Real-time IPL auction game for local multiplayer use.

## Setup

1. Install Node.js LTS.
2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
npm start
```

Open:

- `http://localhost:3000`
- `http://<your-ip>:3000` for others on the same Wi-Fi

## Admin Login

- Login page: `http://localhost:3000/admin.html`
- Default admin password: `aiml`
- Recommended: override with env var:

```bash
set ADMIN_PASSWORD=your_secure_password
```

## Participant Flow

Players / participants no longer pick a team. Instead the admin pre‑assigns a unique code for each team using the **Reset Team Passwords** feature on the admin panel (or
via `POST /api/admin/reset-passwords`).
On the landing page (`/`) users simply enter their code and submit. The system then reveals their
assigned team (logo/name) and moves them to the waiting screen. There is no team selector on the
participant UI and codes are not exposed to other users.

## Features

- Real-time multiplayer auction via Socket.IO
- 605 player dataset
- Team budgets and bid validation
- Admin-only auction controls
- Admin player management (add player, image update/upload, duplicate flag)
- Audience view
- Uploaded player images are stored permanently on disk

## Persistent Image Storage

- Uploaded files from `POST /api/admin/upload-player-image` are saved to:
  - Windows default: `%USERPROFILE%\\ipl-auction-uploads\\images`
- This folder is outside the project, so uploads survive app restarts and code changes.
- Existing files from `public/images` are auto-copied once to the persistent folder at startup.
- Optional override:

```bash
set AUCTION_UPLOADS_DIR=D:\auction-data
```

Then images will be stored in `D:\auction-data\images`.

## API

Public:

- `GET /api/state`
- `GET /api/players`

Admin (header required: `x-admin-pass: <password>`):

- `POST /api/admin/login` with body `{ "password": "..." }`
- `POST /api/players`
- `POST /api/reset`
- `POST /api/admin/update-player-image`
- `POST /api/admin/upload-player-image`
- `POST /api/admin/flag-duplicate`

## Smoke Test

Start server, then run:

```bash
npm run test:smoke
```
