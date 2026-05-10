export type TrustLevel = "limited" | "standard" | "high";

export interface WalletReputation {
  address: string;
  score: number;
  trustLevel: TrustLevel;
  txCount: number;
  balanceSol: number;
  tokenAccountCount: number;
  oldestVisibleTxAt: number | null;
  checkedAt: number;
  signals: string[];
  warnings: string[];
}

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function rpcUrl() {
  return import.meta.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${method}-${Date.now()}`,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Solana RPC failed: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? "Solana RPC error");
  }
  return payload.result as T;
}

function trustLevel(score: number): TrustLevel {
  if (score >= 70) return "high";
  if (score >= 35) return "standard";
  return "limited";
}

export async function assessSolanaWallet(address: string): Promise<WalletReputation> {
  const [signatures, balance, tokenAccounts] = await Promise.all([
    solanaRpc<Array<{ signature: string; blockTime?: number | null }>>(
      "getSignaturesForAddress",
      [address, { limit: 20 }]
    ),
    solanaRpc<{ value: number }>("getBalance", [address]),
    solanaRpc<{ value: unknown[] }>("getTokenAccountsByOwner", [
      address,
      { programId: TOKEN_PROGRAM_ID },
      { encoding: "jsonParsed" },
    ]),
  ]);

  const txCount = signatures.length;
  const balanceSol = balance.value / LAMPORTS_PER_SOL;
  const tokenAccountCount = tokenAccounts.value.length;
  const blockTimes = signatures
    .map((sig) => sig.blockTime)
    .filter((time): time is number => typeof time === "number");
  const oldestVisibleTxAt = blockTimes.length > 0 ? Math.min(...blockTimes) * 1000 : null;
  const ageDays = oldestVisibleTxAt
    ? Math.floor((Date.now() - oldestVisibleTxAt) / 86_400_000)
    : 0;

  let score = 0;
  const signals: string[] = [];
  const warnings: string[] = [];

  if (txCount >= 10) {
    score += 30;
    signals.push("10+ visible transactions");
  } else if (txCount >= 3) {
    score += 18;
    signals.push("3+ visible transactions");
  } else if (txCount > 0) {
    score += 8;
    signals.push("Some visible transaction history");
  } else {
    warnings.push("No visible transaction history");
  }

  if (ageDays >= 30) {
    score += 25;
    signals.push("Wallet has visible activity older than 30 days");
  } else if (ageDays >= 7) {
    score += 12;
    signals.push("Wallet has visible activity older than 7 days");
  } else if (txCount > 0) {
    warnings.push("Only recent visible wallet activity");
  }

  if (balanceSol >= 0.05) {
    score += 15;
    signals.push("Meaningful SOL balance");
  } else if (balanceSol > 0) {
    score += 6;
    signals.push("Non-zero SOL balance");
  } else {
    warnings.push("Zero SOL balance");
  }

  if (tokenAccountCount >= 3) {
    score += 20;
    signals.push("Multiple SPL token accounts");
  } else if (tokenAccountCount > 0) {
    score += 10;
    signals.push("Some SPL token account history");
  }

  const cappedScore = Math.min(score, 100);
  return {
    address,
    score: cappedScore,
    trustLevel: trustLevel(cappedScore),
    txCount,
    balanceSol,
    tokenAccountCount,
    oldestVisibleTxAt,
    checkedAt: Date.now(),
    signals,
    warnings,
  };
}

