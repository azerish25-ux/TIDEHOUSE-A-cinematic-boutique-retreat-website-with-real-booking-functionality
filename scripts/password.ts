import { randomBytes, scryptSync } from 'node:crypto';
const password = process.argv[2];
if (!password || password.length < 16) { console.error('Provide a unique passphrase of at least 16 characters.'); process.exit(1); }
const salt = randomBytes(16).toString('hex');
console.log(`scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`);
