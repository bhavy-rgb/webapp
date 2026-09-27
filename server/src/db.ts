/**
 * User store — file-backed JSON for zero-config local dev.
 *
 * The `UserStore` interface keeps this swappable: a MongoDB or Postgres
 * implementation can replace `jsonUserStore` without touching the routes.
 * (MongoDB wasn't installed on this machine, and a file store is fine for v1.)
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  isAdmin: boolean;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
}

export interface UserStore {
  findByUsername(username: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  create(input: { username: string; email: string; passwordHash: string; isAdmin?: boolean }): Promise<User>;
  listAll(): Promise<User[]>;
  setAdmin(id: string, isAdmin: boolean): Promise<User | undefined>;
  remove(id: string): Promise<boolean>;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    isAdmin: user.isAdmin === true,
  };
}

interface DbShape {
  users: User[];
}

function readDb(): DbShape {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) as DbShape;
  } catch {
    return { users: [] };
  }
}

function writeDb(db: DbShape) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export const jsonUserStore: UserStore = {
  async findByUsername(username: string) {
    return readDb().users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  },
  async findByEmail(email: string) {
    return readDb().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  async findById(id: string) {
    return readDb().users.find((u) => u.id === id);
  },
  async create({ username, email, passwordHash, isAdmin = false }) {
    const db = readDb();
    const user: User = {
      id: randomUUID(),
      username,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
      isAdmin,
    };
    db.users.push(user);
    writeDb(db);
    return user;
  },
  async listAll() {
    return readDb().users;
  },
  async setAdmin(id: string, isAdmin: boolean) {
    const db = readDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) return undefined;
    user.isAdmin = isAdmin;
    writeDb(db);
    return user;
  },
  async remove(id: string) {
    const db = readDb();
    const before = db.users.length;
    db.users = db.users.filter((u) => u.id !== id);
    if (db.users.length === before) return false;
    writeDb(db);
    return true;
  },
};
