import { Connection, PublicKey } from "@solana/web3.js";

export const MAGICBLOCK_TEE_RPC_URL =
  import.meta.env.VITE_MAGICBLOCK_TEE_RPC_URL ?? "https://devnet-tee.magicblock.app";

export const MAGICBLOCK_TEE_WS_URL =
  import.meta.env.VITE_MAGICBLOCK_TEE_WS_URL ?? "wss://tee.magicblock.app";

export const MAGICBLOCK_TEE_VALIDATOR_ID =
  "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo";

export type MagicBlockStep = "idle" | "verifying" | "signing" | "connecting" | "ready" | "error";

export interface MagicBlockPrivateSession {
  walletAddress: string;
  teeRpcUrl: string;
  teeWsUrl: string;
  teeValidatorId: string;
  tokenPreview: string;
  expiresAt: number;
  verifiedAt: number;
  rpcVersion: string;
  permissionUsers: string[];
}

function maskToken(token: string) {
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
}

function withToken(url: string, token: string) {
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}token=${encodeURIComponent(token)}`;
}

export async function connectMagicBlockPrivateSession(
  onStep?: (step: MagicBlockStep) => void
): Promise<MagicBlockPrivateSession> {
  const sol = window.solana;
  if (!sol?.isPhantom) {
    window.open("https://phantom.app/", "_blank");
    throw new Error("Install Phantom first to request a MagicBlock PER auth token.");
  }
  if (!sol.signMessage) {
    throw new Error("This Phantom wallet cannot sign MagicBlock challenge messages.");
  }

  const connected = sol.publicKey ? { publicKey: sol.publicKey } : await sol.connect?.();
  const publicKey: PublicKey | undefined = sol.publicKey ?? connected?.publicKey;
  if (!publicKey) throw new Error("No Phantom public key returned.");

  const {
    getAuthToken,
    getPermissionStatus,
    verifyTeeRpcIntegrity,
  } = await import("@magicblock-labs/ephemeral-rollups-sdk");

  onStep?.("verifying");
  await verifyTeeRpcIntegrity(MAGICBLOCK_TEE_RPC_URL);

  onStep?.("signing");
  const auth = await getAuthToken(
    MAGICBLOCK_TEE_RPC_URL,
    publicKey,
    async (message: Uint8Array) => {
      const signed = await sol.signMessage?.(message, "utf8");
      if (!signed?.signature) throw new Error("MagicBlock challenge signature was cancelled.");
      return signed.signature;
    }
  );

  onStep?.("connecting");
  const teeUserUrl = withToken(MAGICBLOCK_TEE_RPC_URL, auth.token);
  const teeUserWsUrl = withToken(MAGICBLOCK_TEE_WS_URL, auth.token);
  const connection = new Connection(teeUserUrl, {
    commitment: "confirmed",
    wsEndpoint: teeUserWsUrl,
  });

  const [versionResult, permissionResult] = await Promise.allSettled([
    connection.getVersion(),
    getPermissionStatus(teeUserUrl, publicKey),
  ]);

  onStep?.("ready");
  return {
    walletAddress: publicKey.toBase58(),
    teeRpcUrl: MAGICBLOCK_TEE_RPC_URL,
    teeWsUrl: MAGICBLOCK_TEE_WS_URL,
    teeValidatorId: MAGICBLOCK_TEE_VALIDATOR_ID,
    tokenPreview: maskToken(auth.token),
    expiresAt: auth.expiresAt,
    verifiedAt: Date.now(),
    rpcVersion:
      versionResult.status === "fulfilled"
        ? versionResult.value["solana-core"] ?? "connected"
        : "connected",
    permissionUsers:
      permissionResult.status === "fulfilled"
        ? permissionResult.value.authorizedUsers ?? []
        : [],
  };
}
