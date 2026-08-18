/// <reference lib="webworker" />
// Web Worker that hosts the Rust (WASM) chess engine so search never
// blocks the UI thread.

import init, { engine_best_move, engine_eval } from "./pkg/chessify_bot";
import wasmUrl from "./pkg/chessify_bot_bg.wasm?url";

export type EngineRequest =
  | { id: number; type: "bestmove"; fen: string; level: number; uciHistory: string }
  | { id: number; type: "eval"; fen: string };

export type EngineResponse =
  | { id: number; type: "ready" }
  | {
      id: number;
      type: "bestmove";
      bestmove: string | null;
      score?: number;
      depth?: number;
      nodes?: number;
      terminal?: "checkmate" | "stalemate";
      error?: string;
    }
  | { id: number; type: "eval"; score: number }
  | { id: number; type: "error"; error: string };

const ready = init({ module_or_path: wasmUrl }).then(() => {
  const msg: EngineResponse = { id: -1, type: "ready" };
  self.postMessage(msg);
});

self.onmessage = async (e: MessageEvent<EngineRequest>) => {
  const req = e.data;
  try {
    await ready;
    if (req.type === "bestmove") {
      const raw = engine_best_move(req.fen, req.level, req.uciHistory);
      const parsed = JSON.parse(raw);
      const msg: EngineResponse = { id: req.id, type: "bestmove", ...parsed };
      self.postMessage(msg);
    } else if (req.type === "eval") {
      const msg: EngineResponse = { id: req.id, type: "eval", score: engine_eval(req.fen) };
      self.postMessage(msg);
    }
  } catch (err) {
    const msg: EngineResponse = { id: req.id, type: "error", error: String(err) };
    self.postMessage(msg);
  }
};
