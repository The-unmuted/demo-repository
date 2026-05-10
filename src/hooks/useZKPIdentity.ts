import { useState, useCallback } from "react";
import {
  generateCommitment, generateWalletCommitment, generateEmailCommitment, loadIdentity, selfVerify, revokeIdentity,
  aliasFromNullifier, shortCommitment,
  type ZKPCommitment, type IdentityCategory, type IdentityTrust,
} from "@/lib/zkpIdentity";

export function useZKPIdentity() {
  const [identity, setIdentity]   = useState<ZKPCommitment | null>(() => loadIdentity());
  const [verified, setVerified]   = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async (category: IdentityCategory, region?: string) => {
    setGenerating(true);
    try {
      const id = await generateCommitment(category, region);
      setIdentity(id);
      const ok = await selfVerify();
      setVerified(ok);
    } finally {
      setGenerating(false);
    }
  }, []);

  const generateFromWallet = useCallback(async (walletAddress: string, signature: Uint8Array, trust?: IdentityTrust) => {
    setGenerating(true);
    try {
      const id = await generateWalletCommitment(walletAddress, signature, trust);
      setIdentity(id);
      const ok = await selfVerify();
      setVerified(ok);
    } finally {
      setGenerating(false);
    }
  }, []);

  const generateFromEmail = useCallback(async (email: string, credential: string, verified: boolean) => {
    setGenerating(true);
    try {
      const id = await generateEmailCommitment(email, credential, verified);
      setIdentity(id);
      const ok = await selfVerify();
      setVerified(ok);
    } finally {
      setGenerating(false);
    }
  }, []);

  const verify = useCallback(async () => {
    const ok = await selfVerify();
    setVerified(ok);
    return ok;
  }, []);

  const revoke = useCallback(() => {
    revokeIdentity();
    setIdentity(null);
    setVerified(null);
  }, []);

  const alias = identity ? aliasFromNullifier(identity.nullifier) : null;
  const shortCommit = identity ? shortCommitment(identity.commitment) : null;

  return { identity, alias, shortCommit, verified, generating, generate, generateFromWallet, generateFromEmail, verify, revoke };
}
