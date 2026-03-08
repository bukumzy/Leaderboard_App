# 🎓 Math Competition Live Scoreboard

A real-time quiz/math competition scoreboard system with a password-protected admin panel and a live public leaderboard. Built with React + Vite, synced via Firebase Realtime Database, and deployable to Vercel.

---

## ✨ Features

### Admin Panel (`/admin`)
- 🔐 Password-protected access
- ➕ Add and remove teams
- ✏️ Rename teams at any time
- 🔢 Enter and auto-save scores per round (no manual save needed)
- 🔄 Set current round and total rounds
- ⏱ Round countdown timer — syncs live to the public screen
- 👁 Hide/show the public scoreboard between rounds
- 🏆 Trigger a dramatic winner reveal on the public screen
- 🟢 Live Firebase connection status indicator

### Public Scoreboard (`/`)
- 📺 Dramatic live leaderboard with gold/silver/bronze medals
- 🔢 Per-round scores + running totals displayed
- ⏱ Live countdown timer with urgent pulse when under 30 seconds
- 👁‍🗨 "Stand by" screen when admin hides the scoreboard
- 🏆 Full-screen winner reveal with confetti and animations
- 🟢 Real-time connection indicator
- 📱 Fully mobile responsive

---

## 🗂 Project Structure

```
src/
├── firebase.js        # Firebase config and exports
├── Admin.jsx          # Admin panel component
├── Scoreboard.jsx     # Public scoreboard component
└── App.jsx            # Routing (/ and /admin)

vercel.json            # Vercel SPA routing config
.env                   # Local environment variables (never committed)
.gitignore
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with Realtime Database enabled

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/math-comp-app.git
cd math-comp-app
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```env
VITE_ADMIN_PASSWORD=your_password_here
```

> ⚠️ Never commit `.env` to Git. It is already listed in `.gitignore`.

### Run Locally

```bash
npm run dev
```

- Public scoreboard: `http://localhost:5173/`
- Admin panel: `http://localhost:5173/admin`

---

## 🔥 Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project → Enable **Realtime Database**
3. Your config is already wired into `src/firebase.js`
4. Set database rules (for development):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> 🔒 For production, tighten these rules to restrict writes to authenticated users only.

---

## ☁️ Deploying to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/math-comp-app.git
git push -u origin main
```

### 2. Import to Vercel

- Go to [vercel.com](https://vercel.com) → **Add New Project**
- Import your GitHub repository
- Vercel will auto-detect Vite — no build config needed

### 3. Add Environment Variable

In your Vercel project → **Settings → Environment Variables**:

| Name | Value |
|------|-------|
| `VITE_ADMIN_PASSWORD` | `your_password_here` |

### 4. Deploy

Vercel deploys automatically on every push to `main`. Your live URLs:

| Page | URL |
|------|-----|
| Public Scoreboard | `https://your-app.vercel.app/` |
| Admin Panel | `https://your-app.vercel.app/admin` |

---

## 🔧 Customisation

| What | Where |
|------|-------|
| Event title | Admin panel header (click the ✏️ icon) |
| Number of rounds | Admin → Settings tab |
| Admin password | `VITE_ADMIN_PASSWORD` env variable |
| Firebase project | `src/firebase.js` |

---

## 🛠 Built With

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [React Router](https://reactrouter.com)
- Deployed on [Vercel](https://vercel.com)

---

## 📄 License

MIT — free to use and modify for your own events.
