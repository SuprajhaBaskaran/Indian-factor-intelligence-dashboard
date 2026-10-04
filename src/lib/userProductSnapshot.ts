import { getLatestAllocation, getLatestRegime, getPortfolioTargets } from "./data";
import type { FactorAllocation, PortfolioTarget, RegimePrediction } from "@/types";

export let latestAllocation: FactorAllocation | null = getLatestAllocation();
export let latestRegime: RegimePrediction | null = getLatestRegime();
export let latestMonth: string | undefined = latestAllocation?.month || latestRegime?.month;
export let targets: PortfolioTarget[] = getPortfolioTargets(latestMonth);

export function refreshUserProductData() {
  latestAllocation = getLatestAllocation();
  latestRegime = getLatestRegime();
  latestMonth = latestAllocation?.month || latestRegime?.month;
  targets = getPortfolioTargets(latestMonth);
}
