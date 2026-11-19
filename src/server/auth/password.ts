import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * scrypt password hashing (OWASP-recommended parameters).
 * Format: scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>
 * Intentionally free of `server-only` so the seed script can reuse it.
 */
const KEY_LENGTH = 64;
const COST = { N: 2 ** 15, r: 8, p: 1 } as const;
const MAX_MEM = 128 * COST.N * COST.r * 2;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, { ...COST, maxmem: MAX_MEM });
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltB64 || !hashB64) return false;

  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (![N, R, P].every(Number.isSafeInteger)) return false;

  const expected = Buffer.from(hashB64, "base64");
  const actual = await deriveKey(password, Buffer.from(saltB64, "base64"), {
    N,
    r: R,
    p: P,
    maxmem: 128 * N * R * 2,
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Pre-computed hash used to equalise timing when the user does not exist. */
let dummyHash: Promise<string> | undefined;
export function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}
