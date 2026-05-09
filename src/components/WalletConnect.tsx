import { useSolanaWallet, shortenSolAddress } from "@/hooks/useSolanaWallet";
import { AppLanguage, copyFor } from "@/lib/locale";
import { Wallet, LogOut } from "lucide-react";

interface WalletConnectProps {
  walletHook: ReturnType<typeof useSolanaWallet>;
  language: AppLanguage;
}

export default function WalletConnect({ walletHook, language }: WalletConnectProps) {
  const { wallet, connect, disconnect } = walletHook;

  if (!wallet.isConnected) {
    return (
      <button
        onClick={connect}
        className="flex items-center gap-2 rounded-full border border-primary/20 bg-card/90 px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
      >
        <Wallet className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">
          {copyFor(language, "Connect Phantom", "连接 Phantom")}
        </span>
        <span className="sm:hidden">Phantom</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-full border border-wallet-connected/20 bg-wallet-connected/10 px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-wallet-connected" />
        <span className="font-mono text-xs text-secondary-foreground">
          {shortenSolAddress(wallet.address!)}
        </span>
      </div>
      <button
        onClick={disconnect}
        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label={copyFor(language, "Disconnect Phantom", "断开 Phantom")}
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
