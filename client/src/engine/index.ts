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
  timer: ReturnType<typeof setTimeout>;
};

// Search budgets include headroom above the Rust engine's 50–2500 ms limits.
// A worker that crashes or stalls must never leave the board locked forever.
const SEARCH_TIMEOUT_MS = [800, 1000, 1500, 2200, 3500] as const;
const STARTUP_TIMEOUT_MS = 5000;

export class Engine {
  private worker: Worker | null = null;
  private nextId = 1;
  private generation = 0;
  private pending = new Map<number, Pending>();
  private readyPromise: Promise<void> | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;

  private ensureWorker(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      return Promise.reject(error);
    }
    this.worker = worker;
    this.readyPromise = new Promise((resolve, reject) => {
      this.rejectReady = reject;
      this.startupTimer = setTimeout(
        () => this.dispose(new Error("Engine startup timed out")),
        STARTUP_TIMEOUT_MS,
      );
      worker.onmessage = (e: MessageEvent<EngineResponse>) => {
        if (this.worker !== worker) return;
        const msg = e.data;
        if (msg.type === "ready") {
          clearTimeout(this.startupTimer);
          this.rejectReady = null;
          resolve();
          return;
        }
        const p = this.pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        if (msg.type === "error") p.reject(new Error(msg.error));
        else p.resolve(msg);
      };
      worker.onerror = (e) => {
        if (this.worker === worker) {
          this.dispose(new Error(e.message || "Engine worker failed"));
        }
      };
      worker.onmessageerror = () => {
        if (this.worker === worker) this.dispose(new Error("Invalid engine message"));
      };
    });
    return this.readyPromise;
  }

  private async send<T>(
    req: DistributiveOmit<EngineRequest, "id">,
    timeoutMs = 1000,
  ): Promise<T> {
    const generation = this.generation;
    await this.ensureWorker();
    // A reset can happen while WASM is loading, before a request is posted.
    if (generation !== this.generation || !this.worker) {
      throw new Error("Engine request cancelled");
    }
    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(
        () => this.dispose(new Error("Engine response timed out")),
        timeoutMs,
      );
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      try {
        this.worker!.postMessage({ ...req, id });
      } catch (error) {
        this.dispose(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Best move for `fen` at difficulty `level`. `uciHistory` = space-separated
   *  UCI moves from the initial position (enables repetition avoidance). */
  bestMove(fen: string, level: LevelId, uciHistory: string): Promise<BestMove> {
    return this.send<BestMove>(
      { type: "bestmove", fen, level, uciHistory },
      SEARCH_TIMEOUT_MS[level],
    ).then((result) => {
      if (result.error || (!result.bestmove && !result.terminal)) {
        throw new Error(result.error || "Engine returned no move");
      }
      return result;
    });
  }

  /** Static eval in centipawns from the side to move's perspective. */
  evaluate(fen: string): Promise<number> {
    return this.send<{ score: number }>({ type: "eval", fen }).then((r) => r.score);
  }

  /** Kick off WASM compile early so the first move is instant. */
  warmUp(): void {
    void this.ensureWorker().catch(() => {});
  }

  dispose(reason = new Error("Engine disposed")): void {
    this.generation++;
    clearTimeout(this.startupTimer);
    this.rejectReady?.(reason);
    this.rejectReady = null;
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(reason);
    });
    this.pending.clear();
  }
}

export const engine = new Engine();
