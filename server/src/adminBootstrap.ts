import { ADMIN_USERNAME } from "./config.js";
import { jsonUserStore, type UserStore } from "./db.js";

/** Provision only from a server-side bcrypt hash, never from public signup. */
export function provisionAdmin(
  store: UserStore = jsonUserStore,
  passwordHash = process.env.ADMIN_PASSWORD_HASH,
  migrateFrom = process.env.ADMIN_MIGRATE_FROM,
) {
  if (!passwordHash) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Set ADMIN_PASSWORD_HASH before starting in production");
    }
    return undefined;
  }
  if (!/^\$2[aby]\$(1[0-6])\$[./A-Za-z0-9]{53}$/.test(passwordHash)) {
    throw new Error("ADMIN_PASSWORD_HASH must be a bcrypt hash with cost 10–16");
  }
  const existing = store.findByUsername(ADMIN_USERNAME);
  const previous = migrateFrom ? store.findByUsername(migrateFrom) : undefined;
  const account = existing ?? previous;
  if (existing && previous && existing.id !== previous.id) {
    throw new Error("Admin migration conflicts with an existing ARISE account");
  }
  if (account) {
    if (!account.isAdmin) {
      throw new Error("Refusing to promote an existing non-admin account during provisioning");
    }
    // Keep the ID and historical game ownership. Changed credentials revoke sessions.
    if (account.passwordHash !== passwordHash || account.username !== ADMIN_USERNAME) {
      return store.updateCredentials(account.id, ADMIN_USERNAME, passwordHash);
    }
    return account;
  }
  const email = "arise@admin.invalid";
  if (store.findByEmail(email)) throw new Error("Reserved admin email already in use");
  return store.create({ username: ADMIN_USERNAME, email, passwordHash, isAdmin: true });
}
