import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
const file = new URL("../functions/.secret.local", import.meta.url);
if (!existsSync(file)) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync("emulator-admin-only", salt, 64).toString("hex");
  writeFileSync(file, `ADMIN_PASSWORD_HASH=${salt}:${hash}\n`, { mode: 0o600 });
}
console.log(
  "Emulator secret prepared. Local test password: emulator-admin-only (never used in production).",
);
