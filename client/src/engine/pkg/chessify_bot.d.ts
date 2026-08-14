/* tslint:disable */
/* eslint-disable */

/**
 * Best move for `fen` at difficulty `level` (0..=4).
 * `uci_history` — space-separated UCI moves from the standard start
 * position (pass "" if the game didn't start from the initial position).
 */
export function engine_best_move(fen: string, level: number, uci_history: string): string;

/**
 * Static evaluation (centipawns, side to move perspective).
 */
export function engine_eval(fen: string): number;

/**
 * All legal moves for a FEN as a JSON array of UCI strings.
 */
export function engine_legal_moves(fen: string): string;

/**
 * Perft node count (debugging).
 */
export function engine_perft(fen: string, depth: number): bigint;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly engine_best_move: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly engine_eval: (a: number, b: number) => number;
    readonly engine_legal_moves: (a: number, b: number) => [number, number];
    readonly engine_perft: (a: number, b: number, c: number) => bigint;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
