/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  ethereum?: {
    request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
    on: (event: "accountsChanged" | "chainChanged", handler: () => void) => void;
    removeListener: (event: "accountsChanged" | "chainChanged", handler: () => void) => void;
  };
  solana?: {
    isPhantom?: boolean;
    isConnected?: boolean;
    publicKey?: import("@solana/web3.js").PublicKey;
    connect?: () => Promise<{ publicKey: import("@solana/web3.js").PublicKey }>;
    disconnect?: () => Promise<void>;
    signMessage?: (message: Uint8Array, display?: "utf8" | "hex") => Promise<{ signature: Uint8Array }>;
    signTransaction?: (tx: import("@solana/web3.js").Transaction) => Promise<import("@solana/web3.js").Transaction>;
    on?: (event: "connect" | "disconnect" | "accountChanged", handler: () => void) => void;
    off?: (event: "connect" | "disconnect" | "accountChanged", handler: () => void) => void;
  };
}
