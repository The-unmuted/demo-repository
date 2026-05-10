import { useState, useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";

export interface SolanaWalletState {
  publicKey: PublicKey | null;
  address: string | null;
  isConnected: boolean;
  isPhantomInstalled: boolean;
}

interface PhantomProvider {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signMessage?: (message: Uint8Array, display?: "utf8" | "hex") => Promise<{ signature: Uint8Array }>;
  on: (event: "connect" | "disconnect" | "accountChanged", handler: () => void) => void;
  off?: (event: "connect" | "disconnect" | "accountChanged", handler: () => void) => void;
}

export function useSolanaWallet() {
  const [wallet, setWallet] = useState<SolanaWalletState>(() => {
    const sol = window.solana;
    const pk: PublicKey | null = sol?.publicKey ?? null;
    return {
      publicKey: pk,
      address: pk?.toBase58() ?? null,
      isConnected: sol?.isConnected ?? false,
      isPhantomInstalled: Boolean(sol?.isPhantom),
    };
  });

  const refresh = useCallback(() => {
    const sol = window.solana;
    const pk: PublicKey | null = sol?.publicKey ?? null;
    setWallet({
      publicKey: pk,
      address: pk?.toBase58() ?? null,
      isConnected: Boolean(sol?.isConnected && pk),
      isPhantomInstalled: Boolean(sol?.isPhantom),
    });
  }, []);

  const connect = useCallback(async () => {
    const sol = window.solana;
    if (!sol?.isPhantom) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    await sol.connect();
    refresh();
  }, [refresh]);

  const connectAndSignIdentity = useCallback(async () => {
    const sol = window.solana as PhantomProvider | undefined;
    if (!sol?.isPhantom) {
      window.open("https://phantom.app/", "_blank");
      throw new Error("Phantom wallet is not installed.");
    }

    const response = await sol.connect();
    const publicKey = sol.publicKey ?? response.publicKey;
    if (!publicKey) throw new Error("No Phantom public key returned.");
    if (!sol.signMessage) throw new Error("This Phantom wallet cannot sign identity messages.");

    const message = new TextEncoder().encode(
      "The Unmuted identity signup v1\n\nSign this message to create your private app identity. This does not approve a transaction or spend funds."
    );
    const signed = await sol.signMessage(message, "utf8");
    refresh();

    return {
      address: publicKey.toBase58(),
      signature: signed.signature,
    };
  }, [refresh]);

  const disconnect = useCallback(async () => {
    const sol = window.solana;
    await sol?.disconnect();
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sol = window.solana;
    if (!sol) return;
    sol.on("connect", refresh);
    sol.on("disconnect", refresh);
    sol.on("accountChanged", refresh);
    return () => {
      sol.off?.("connect", refresh);
      sol.off?.("disconnect", refresh);
      sol.off?.("accountChanged", refresh);
    };
  }, [refresh]);

  return { wallet, connect, connectAndSignIdentity, disconnect };
}

export function shortenSolAddress(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}
