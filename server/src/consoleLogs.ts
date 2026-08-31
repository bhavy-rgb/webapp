/**
 * Console log capture — keeps the last N server console lines in a ring
 * buffer so the admin panel can display them without shell access.
 *
 * Each entry contains:
 *   ts      — ISO timestamp of when the line was printed
 *   level   — "log" | "info" | "warn" | "error"
 *   message — the rendered message text
 */
import { format } from "node:util";

export interface ConsoleEntry {
  ts: string;
  level: "log" | "info" | "warn" | "error";
  message: string;
}

const MAX_ENTRIES = 500;
const buffer: ConsoleEntry[] = [];

function record(level: ConsoleEntry["level"], args: unknown[]) {
  buffer.push({ ts: new Date().toISOString(), level, message: format(...args) });
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
}

/** Patch console methods once at startup (import this module early). */
export function installConsoleCapture() {
  (["log", "info", "warn", "error"] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      record(level, args);
      original(...args);
    };
  });
  console.info("[consoleLogs] capture installed");
}

export function getConsoleLogs(limit = 200, level?: string): ConsoleEntry[] {
  const filtered = level ? buffer.filter((e) => e.level === level) : buffer;
  return filtered.slice(-limit);
}
