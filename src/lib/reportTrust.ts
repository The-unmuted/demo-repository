import { loadIdentity } from "./zkpIdentity";

export function currentTrustScore() {
  return loadIdentity()?.trust?.score ?? 0;
}

export function currentTrustLevel() {
  return loadIdentity()?.trust?.level ?? "limited";
}

export function canPublishMapAlert() {
  return currentTrustScore() >= 35;
}

