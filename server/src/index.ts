import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import authRouter from "./routes/auth.js";

dotenv.config();

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "chessify-server" });
});

app.use("/api/auth", authRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Chessify server running on http://localhost:${PORT}`);
});
