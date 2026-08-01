# ♞ Chessify — Learn How Every Piece Moves

A scroll-animated chess piece-learning app. Six piece cards (one per piece type),
each with a live 8×8 movement diagram, plus auth, a lobby, training mode, a
bot to practice against — and live **1v1 friend games via invite link**.

## Quick start

```bash
npm install        # installs client + server workspaces
cp .env.example .env   # then edit JWT_SECRET
npm run dev        # runs server (:3001) + client (:5173) together
```

Open http://localhost:5173, create an account, and head to **Training**.

## Play a friend (1v1 via link)

From the **Lobby**, the *Play a friend* card creates a live game:

1. Pick a time control (3+0 / 5+2 / 10+0 / 15+10 / unlimited) and your color.
2. Share the 6-character code or the **invite link** (`/play/<CODE>`).
3. Your friend signs in and opens the link — they're seated automatically and the game starts.

### Game API (all routes require a JWT)

| Method | Route | What it does |
| --- | --- | --- |
| `POST` | `/api/games` | Create a game → `{ code, color, timeMinutes, incrementSeconds }` |
| `POST` | `/api/games/:code/join` | Take the open seat (re-join safe) |
| `GET`  | `/api/games/:code/state` | Poll full state — moves, FEN, clocks, draw offers |
| `POST` | `/api/games/:code/move` | Submit a move — **server-side turn, legality (chess.js) & clock enforcement**, server-side game-end detection |
| `POST` | `/api/games/:code/resign` | Resign |
| `POST` | `/api/games/:code/draw` | `{ action: "offer" \| "accept" \| "decline" }` |

Ported from the previous Hono/D1 game API, upgraded so identity comes from the
authenticated user (not anonymous tokens) and move legality + game end
(checkmate / stalemate / draws / flag falls) are verified on the server with
`chess.js`. Games persist in `server/data/games.json` (same file-store pattern
as users).

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Server + client with hot reload               |
| `npm run dev:server`| Express API only (`http://localhost:3001`)    |
| `npm run dev:client`| Vite dev server only (`http://localhost:5173`)|
| `npm run check`     | `tsc --noEmit` for server + client            |
| `npm run build`     | Production build of the client                |
| `npm start`         | Serve the built client from the API server    |

## Stack rationale (and deviations from the brief)

| Requirement | Chosen | Why |
| --- | --- | --- |
| React | **React 19 + Vite** | Vite is the default CRA replacement — faster dev server and first-class Tailwind v4 support. |
| Styling | **Tailwind CSS v4** | Zero-config via the official Vite plugin. |
| Animation | **Framer Motion** + **react-intersection-observer** | `whileInView` / `useInView` give scroll-triggered reveals with proper staggering; plain CSS would need manual JS for the same feel. |
| Backend | **Node + Express** | Straightforward REST API for auth. |
| Auth | **JWT + bcrypt** (`jsonwebtoken`, `bcryptjs`) | Stateless, well-understood, no session store needed. |
| Database | **File-backed JSON store** | MongoDB is **not installed** on this machine and a local Mongo setup wasn't feasible here. The store is behind a small `UserStore` interface (`server/src/db.ts`), so swapping in MongoDB/Postgres later only means writing one implementation — routes don't change. |
| Routing | **React Router v7** | Spec requirement, matches the multi-page structure. |
| State | **React Context** | Auth state only — Redux/Zustand would be overkill at this size. |
| Board / bot | **`chess.js` + `react-chessboard`** | Legal move logic and drag-and-drop board come from battle-tested libs instead of hand-rolling. The bot picks a random legal reply (v1 placeholder — see below). |

### Note on "32 pieces"

Movement rules are per **piece type**, not per instance — a pawn on a2 moves exactly
like a pawn on h7. Showing all 32 pieces would render 32 identical diagrams, so
Chessify shows **6 cards** (Pawn, Knight, Bishop, Rook, Queen, King). Happy to switch
to 32 individual cards (White/Black × all 8 pawns, etc.) if that's really wanted.

### Bot mode scope

v1 bot plays a random legal move from `chess.js`. A real engine (Stockfish via
WASM or an API) can be dropped in by replacing `botMove()` in `client/src/pages/Bot.tsx`.

## Project structure

```
chessify/
├── client/            React 19 + Vite + Tailwind v4 + Framer Motion
│   └── src/
│       ├── lib/pieces.ts        piece data + movement → diagram squares
│       ├── components/          BoardDiagram, PieceCard, Navbar, ScrollReveal
│       └── pages/               Login, Home, Lobby, Training, Bot
├── server/            Express + JWT + bcrypt
│   └── src/db.ts                swappable JSON user store
└── .env.example
```

## API

| Method | Route            | Body / notes                       |
| ------ | ---------------- | ---------------------------------- |
| POST   | `/api/auth/signup`| `{ username, email, password }` → `{ token, user }` |
| POST   | `/api/auth/login` | `{ identifier, password }` → `{ token, user }` |
| GET    | `/api/auth/me`    | `Authorization: Bearer <token>` → `{ user }` |
| GET    | `/api/health`     | Liveness check                     |

## Roadmap ideas

- Real engine for the bot (Stockfish WASM).
- Timed training quizzes per piece.
- Dark theme.
