import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { PrivyProvider, useLoginWithEmail, usePrivy, type User } from "@privy-io/react-auth";

type EmailOtpStatus =
  | "initial"
  | "error"
  | "sending-code"
  | "awaiting-code-input"
  | "submitting-code"
  | "done";

interface PrivyAuthContextValue {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  emailOtpStatus: EmailOtpStatus;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (code: string) => Promise<void>;
  openEmailLogin: (email?: string) => void;
}

const missingPrivyAppIdMessage = "Privy email OTP is not configured. Add VITE_PRIVY_APP_ID to enable verified email signup.";

const fallbackPrivyAuth: PrivyAuthContextValue = {
  configured: false,
  ready: true,
  authenticated: false,
  user: null,
  emailOtpStatus: "initial",
  sendEmailCode: async () => {
    throw new Error(missingPrivyAppIdMessage);
  },
  verifyEmailCode: async () => {
    throw new Error(missingPrivyAppIdMessage);
  },
  openEmailLogin: () => {
    throw new Error(missingPrivyAppIdMessage);
  },
};

const PrivyAuthContext = createContext<PrivyAuthContextValue>(fallbackPrivyAuth);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPrivyAuthConfig() {
  const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim() ?? "";

  return {
    ready: Boolean(appId),
    appId,
  };
}

export function emailFromPrivyUser(user: User | null) {
  const directEmail = user?.email?.address;
  if (directEmail) return normalizeEmail(directEmail);

  const linkedEmail = user?.linkedAccounts.find((account) => account.type === "email");
  return linkedEmail?.type === "email" ? normalizeEmail(linkedEmail.address) : "";
}

export function PrivyAuthProvider({ children }: { children: ReactNode }) {
  const config = getPrivyAuthConfig();

  if (!config.ready) {
    return <PrivyAuthContext.Provider value={fallbackPrivyAuth}>{children}</PrivyAuthContext.Provider>;
  }

  return (
    <PrivyProvider
      appId={config.appId}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "#fff7fb",
          accentColor: "#c65f9f",
          landingHeader: "The Unmuted",
          loginMessage: "Verify your email to create a safer private identity.",
          showWalletLoginFirst: false,
        },
      }}
    >
      <PrivyAuthBridge>{children}</PrivyAuthBridge>
    </PrivyProvider>
  );
}

function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login } = usePrivy();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();

  const sendEmailCode = useCallback(
    async (email: string) => {
      await sendCode({ email });
    },
    [sendCode]
  );

  const verifyEmailCode = useCallback(
    async (code: string) => {
      await loginWithCode({ code });
    },
    [loginWithCode]
  );

  const openEmailLogin = useCallback(
    (email?: string) => {
      login({
        loginMethods: ["email"],
        prefill: email ? { type: "email", value: email } : undefined,
      });
    },
    [login]
  );

  const value = useMemo<PrivyAuthContextValue>(
    () => ({
      configured: true,
      ready,
      authenticated,
      user,
      emailOtpStatus: state.status,
      sendEmailCode,
      verifyEmailCode,
      openEmailLogin,
    }),
    [authenticated, openEmailLogin, ready, sendEmailCode, state.status, user, verifyEmailCode]
  );

  return <PrivyAuthContext.Provider value={value}>{children}</PrivyAuthContext.Provider>;
}

export function usePrivyAuth() {
  return useContext(PrivyAuthContext);
}
