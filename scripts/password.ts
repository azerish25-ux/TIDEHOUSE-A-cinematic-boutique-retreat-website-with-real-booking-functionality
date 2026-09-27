import { randomBytes, scryptSync } from "node:crypto";
const password = process.argv[2];
if (!password || password.length < 16)
  throw new Error(
    "Use a unique owner password of at least 16 characters. Usage: npm run admin:password -- <password>",
  );
const salt = randomBytes(16).toString("hex");
console.log(
  `ADMIN_PASSWORD_HASH=scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
);
