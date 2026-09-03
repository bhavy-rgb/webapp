// Thin promise-based client for the Rust WASM engine Web Worker.

import type { EngineRequest, EngineResponse } from "./engine.worker";

export type BestMove = {
  bestmove: string | null;
  score?: number;
  depth?: number;
  nodes?: number;
  terminal?: "checkmate" | "stalemate";
  error?: string;
};

export const LEVELS = [
  { id: 0, name: "Beginner", blurb: "Plays loose — great for first games." },
  { id: 1, name: "Casual", blurb: "Knows the basics, still forgiving." },
  { id: 2, name: "Club", blurb: "Solid tactics. Punishes blunders." },
  { id: 3, name: "Strong", blurb: "Deep search. Bring your A-game." },
  { id: 4, name: "Max", blurb: "Full power of the Rust engine." },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];

/** `Omit` that distributes over union members instead of collapsing them. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

class Engine {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private readyPromise: Promise<void> | null = null;

  private ensureWorker(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
          type: "module",
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      this.worker.onmessage = (e: MessageEvent<EngineResponse>) => {
        const msg = e.data;
        if (msg.type === "ready") {
          resolve();
          return;
        }
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.type === "error") p.reject(new Error(msg.error));
        else p.resolve(msg);
      };
      this.worker.onerror = (e) => {
        reject(new Error(e.message || "engine worker failed"));
      };
    });
    return this.readyPromise;
  }

  private send<T>(req: DistributiveOmit<EngineRequest, "id">): Promise<T> {
    return this.ensureWorker().then(
      () =>
        new Promise<T>((resolve, reject) => {
          const id = this.nextId++;
          this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
          this.worker!.postMessage({ ...req, id });
        }),
    );
  }

  /** Best move for `fen` at difficulty `level`. `uciHistory` = space-separated
   *  UCI moves from the initial position (enables repetition avoidance). */
  bestMove(fen: string, level: LevelId, uciHistory: string): Promise<BestMove> {
    return this.send<BestMove>({ type: "bestmove", fen, level, uciHistory });
  }

  /** Static eval in centipawns from the side to move's perspective. */
  evaluate(fen: string): Promise<number> {
    return this.send<{ score: number }>({ type: "eval", fen }).then((r) => r.score);
  }

  /** Kick off WASM compile early so the first move is instant. */
  warmUp(): void {
    void this.ensureWorker().catch(() => {});
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.pending.forEach((p) => p.reject(new Error("engine disposed")));
    this.pending.clear();
  }
}

export const engine = new Engine();
