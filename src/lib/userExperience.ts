export type RiskPreference = "conservative" | "moderate" | "aggressive";

export interface UserExperience {
  hasInvestments: boolean;
  freshMoneyAmount: number;
  freshMoneyPending?: boolean;
  riskPreference: RiskPreference;
}

export type UserJourney = "new-investor" | "existing-investor" | "existing-investor-fresh-money";

function storageKey(userId: string) {
  return `ifi-user-experience:${userId}`;
}

export function readUserExperience(userId: string): UserExperience | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<UserExperience>;
    if (typeof value.hasInvestments !== "boolean") return null;
    return {
      hasInvestments: value.hasInvestments,
      freshMoneyAmount: Number.isFinite(value.freshMoneyAmount) && Number(value.freshMoneyAmount) > 0 ? Number(value.freshMoneyAmount) : 0,
      freshMoneyPending: value.freshMoneyPending ?? (Number(value.freshMoneyAmount) > 0),
      riskPreference: value.riskPreference === "conservative" || value.riskPreference === "aggressive" ? value.riskPreference : "moderate",
    };
  } catch {
    return null;
  }
}

export function saveUserExperience(userId: string, experience: UserExperience) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(experience));
}

export function getUserJourney(experience: UserExperience | null): UserJourney {
  if (!experience?.hasInvestments) return "new-investor";
  return experience.freshMoneyAmount > 0 ? "existing-investor-fresh-money" : "existing-investor";
}

export function markFreshMoneyIncluded(userId: string) {
  const experience = readUserExperience(userId);
  if (experience) saveUserExperience(userId, { ...experience, freshMoneyPending: false });
}
