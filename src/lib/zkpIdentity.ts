/**
 * ZKP Identity — Hash-based commitment scheme
 *
 * Architecture mirrors Semaphore (real ZKP):
 *   commitment  = SHA256(category + ":" + secret)   ← public, shareable
 *   nullifier   = SHA256(secret + ":nullify")        ← proves uniqueness
 *   secret      = 32-byte random                     ← NEVER leaves device
 *
 * The user proves membership in a category (female / local-resident)
 * without revealing any personal information.
 *
 * Production upgrade path: swap sha256 commitments for snarkjs + Semaphore circuits.
 */

export type IdentityCategory = "female" | "local" | "wallet" | "email";
export type IdentityProvider = "local" | "phantom" | "email";
export type TrustLevel = "limited" | "standard" | "high";

export interface IdentityTrust {
  level: TrustLevel;
  score: number;
  checkedAt: number;
  signals: string[];
  warnings: string[];
}

export interface ZKPCommitment {
  commitment: string;       // public hex
  nullifier: string;        // public hex
  category: IdentityCategory;
  provider?: IdentityProvider;
  walletAddress?: string;
  emailHash?: string;
  trust?: IdentityTrust;
  region?: string;          // city/area for 'local' category
  createdAt: number;
  // secret stored separately in localStorage — never serialised here
}

const IDENTITY_KEY = "unmuted_zkp_identity";
const SECRET_KEY   = "unmuted_zkp_secret";

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomHex32(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function categoryString(category: IdentityCategory, region?: string): string {
  if (category === "wallet") return "wallet";
  if (category === "email") return "email";
  return category === "local" ? `local:${region ?? "unknown"}` : "female";
}

/** Generate a new anonymous identity commitment. */
export async function generateCommitment(
  category: IdentityCategory,
  region?: string
): Promise<ZKPCommitment> {
  const secret = randomHex32();
  const catStr  = categoryString(category, region);

  const [commitment, nullifier] = await Promise.all([
    sha256hex(catStr + ":" + secret),
    sha256hex(secret + ":nullify"),
  ]);

  const identity: ZKPCommitment = { commitment, nullifier, category, region, createdAt: Date.now() };

  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  localStorage.setItem(SECRET_KEY, secret);

  return identity;
}

/** Generate a stable anonymous identity from a Phantom wallet signature. */
export async function generateWalletCommitment(
  walletAddress: string,
  signature: Uint8Array,
  trust?: IdentityTrust
): Promise<ZKPCommitment> {
  const normalizedAddress = walletAddress.trim();
  const signatureHex = bytesToHex(signature);

  const [commitment, nullifier] = await Promise.all([
    sha256hex(`phantom:commitment:v1:${normalizedAddress}:${signatureHex}`),
    sha256hex(`phantom:nullifier:v1:${normalizedAddress}`),
  ]);

  const identity: ZKPCommitment = {
    commitment,
    nullifier,
    category: "wallet",
    provider: "phantom",
    walletAddress: normalizedAddress,
    trust,
    createdAt: Date.now(),
  };

  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  localStorage.setItem(SECRET_KEY, signatureHex);

  return identity;
}

/** Generate a stable anonymous identity from a verified email credential. */
export async function generateEmailCommitment(
  email: string,
  credential: string,
  verified: boolean
): Promise<ZKPCommitment> {
  const normalizedEmail = email.trim().toLowerCase();
  const emailHash = await sha256hex(`email:private-hash:v1:${normalizedEmail}`);
  const secret = await sha256hex(`email:secret:v1:${normalizedEmail}:${credential}`);

  const [commitment, nullifier] = await Promise.all([
    sha256hex(`email:commitment:v1:${emailHash}:${secret}`),
    sha256hex(`email:nullifier:v1:${emailHash}`),
  ]);

  const identity: ZKPCommitment = {
    commitment,
    nullifier,
    category: "email",
    provider: "email",
    emailHash,
    trust: {
      level: verified ? "standard" : "limited",
      score: verified ? 45 : 20,
      checkedAt: Date.now(),
      signals: verified ? ["Verified email OTP"] : ["Email contact stored locally"],
      warnings: verified ? [] : ["Email OTP is not configured, so this is contact-only"],
    },
    createdAt: Date.now(),
  };

  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  localStorage.setItem(SECRET_KEY, secret);

  return identity;
}

/** Load the locally stored identity (if any). */
export function loadIdentity(): ZKPCommitment | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Verify the stored secret against the stored commitment (zero-knowledge style). */
export async function selfVerify(): Promise<boolean> {
  const identity = loadIdentity();
  const secret   = localStorage.getItem(SECRET_KEY);
  if (!identity || !secret) return false;

  if (identity.provider === "phantom" && identity.walletAddress) {
    const expected = await sha256hex(`phantom:commitment:v1:${identity.walletAddress}:${secret}`);
    return expected === identity.commitment;
  }

  if (identity.provider === "email" && identity.emailHash) {
    const expected = await sha256hex(`email:commitment:v1:${identity.emailHash}:${secret}`);
    return expected === identity.commitment;
  }

  const catStr   = categoryString(identity.category, identity.region);
  const expected = await sha256hex(catStr + ":" + secret);
  return expected === identity.commitment;
}

/** Clear identity from device. */
export function revokeIdentity() {
  localStorage.removeItem(IDENTITY_KEY);
  localStorage.removeItem(SECRET_KEY);
}

/** Short display form of a commitment hash. */
export function shortCommitment(commitment: string): string {
  return "0x" + commitment.slice(0, 6) + "…" + commitment.slice(-4);
}

/** Deterministic anonymous alias from nullifier (for display only). */
export function aliasFromNullifier(nullifier: string): string {
  const ADJECTIVES = ["沉默", "无声", "隐形", "匿名", "自由", "坚韧", "勇敢", "清醒"];
  const NOUNS      = ["蓝鸟", "紫狐", "白鹿", "银狼", "星辰", "云雀", "黎明", "微光"];
  const a = parseInt(nullifier.slice(0, 2), 16) % ADJECTIVES.length;
  const n = parseInt(nullifier.slice(2, 4), 16) % NOUNS.length;
  return ADJECTIVES[a] + NOUNS[n];
}
