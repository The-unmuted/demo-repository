import { useState, useCallback } from "react";
import {
  generateCommitment, loadIdentity, selfVerify, revokeIdentity,
  aliasFromNullifier, shortCommitment,
  type ZKPCommitment, type IdentityCategory,
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

  return { identity, alias, shortCommit, verified, generating, generate, verify, revoke };
}
