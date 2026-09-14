import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Work with both workspace scripts and PM2, independent of process.cwd().
// Explicit process environment always takes precedence over local secret files.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

export const ADMIN_USERNAME = "ARISE";
