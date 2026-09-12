import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { installConsoleCapture } from "./consoleLogs.js";
import { requireAdmin } from "./middleware/auth.js";
import adminRouter from "./routes/admin.js";
import authRouter from "./routes/auth.js";
import botGamesRouter from "./routes/botGames.js";
import gamesRouter from "./routes/games.js";

installConsoleCapture(); // ring-buffer console capture for the admin panel

const app = express();
// Use a Chessify-specific var so an ambient PORT in the shell can't hijack the
// port the Vite proxy (and README) expect. Falls back to 3001.
const PORT = Number(process.env.CHESSIFY_PORT) || 3001;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
// navigator.sendBeacon posts JSON with a text/plain content type — accept it
// so abandoned bot games can still be recorded on tab close.
app.use(express.text({ type: "text/plain", limit: "200kb" }));
app.use(cookieParser());

// --- Security headers -------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; ")
  );
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "chessify-server" });
});

app.use("/api/auth", authRouter);
app.use("/api/games", gamesRouter);
app.use("/api/bot-games", botGamesRouter);
app.use("/api/admin", requireAdmin, adminRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Serve the application and API from one origin in production. History fallback
// keeps shared invite links and page refreshes working without a separate host.
const clientDist = fileURLToPath(new URL("../../client/dist/", import.meta.url));
if (existsSync(`${clientDist}/index.html`)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/assets/") || !req.accepts("html")) return next();
    res.sendFile(`${clientDist}/index.html`);
  });
}

app.listen(PORT, () => {
  console.log(`Chessify server running on http://localhost:${PORT}`);
});
