/**
 * User data persistence layer.
 *
 * Provides a unified API for user-specific data (holdings, cash, watchlists,
 * preferences, trade plans) through Supabase.
 *
 * User data is persisted through Supabase and protected by Row Level Security.
 *
 * The model/research data (market data, factor data, regime, allocations)
 * is NOT stored here — it remains in the global JSON files.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import { useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserHolding {
  symbol: string;
  quantity: number;
  avgPrice?: number;
}

export interface UserCash {
  amount: number;
}

export interface WatchlistItem {
  symbol: string;
}

export interface UserPreferences {
  preferredCapital?: number;
  riskPreference: "conservative" | "moderate" | "aggressive";
}

export interface TradePlanRecord {
  id: string;
  generatedAt: string;
  action: string;
  status: string;
  signalDate: string;
  items: TradePlanItemRecord[];
}

export interface TradePlanItemRecord {
  symbol: string;
  currentQuantity: number;
  targetQuantity: number;
  executableQuantity: number;
  action: string;
  reason: string;
}

// ── Unified API ────────────────────────────────────────────────────────────

interface HoldingRow {
  symbol: string;
  quantity: string | number;
  avg_price: string | number | null;
}

interface CashRow {
  amount: string | number;
}

interface TradePlanRow {
  id: string;
  generated_at: string;
  action: string;
  status: string;
  signal_date: string;
}

interface TradePlanItemRow {
  symbol: string;
  current_quantity: string | number;
  target_quantity: string | number;
  executable_quantity: string | number;
  action: string;
  reason: string;
}

export function useUserData() {
  const { user } = useAuth();
  const userId = user?.id;
  const requireBackend = () => {
    if (!supabase || !isSupabaseConfigured || !userId) throw new Error("Sign in to use saved portfolio data.");
  };

  // ── Holdings ────────────────────────────────────────────────────────────

  const getHoldings = async (): Promise<UserHolding[]> => {
    requireBackend();
    if (supabase && userId) {
      const { data, error } = await supabase
        .from("portfolio_holdings")
        .select("symbol, quantity, avg_price")
        .eq("portfolio_id", await getDefaultPortfolioId(userId));
      if (error) throw error;
      return (data || []).map((r: HoldingRow) => ({
        symbol: r.symbol,
        quantity: Number(r.quantity),
        avgPrice: r.avg_price ? Number(r.avg_price) : undefined,
      }));
    }
    return [];
  };

  const saveHoldings = async (holdings: UserHolding[]): Promise<void> => {
    requireBackend();
    if (supabase && userId) {
      const portfolioId = await getDefaultPortfolioId(userId);
      // Delete existing holdings for this portfolio.
      const { error: deleteError } = await supabase.from("portfolio_holdings").delete().eq("portfolio_id", portfolioId);
      if (deleteError) throw deleteError;
      // Insert new holdings.
      const rows = holdings
        .filter((h) => h.quantity > 0)
        .map((h) => ({
          portfolio_id: portfolioId,
          symbol: h.symbol,
          quantity: h.quantity,
          avg_price: h.avgPrice || null,
        }));
      if (rows.length > 0) {
        const { error } = await supabase.from("portfolio_holdings").upsert(rows, { onConflict: "portfolio_id,symbol" });
        if (error) throw error;
      }
      return;
    }
  };

  // ── Cash ────────────────────────────────────────────────────────────────

  const getCash = async (): Promise<number> => {
    requireBackend();
    if (supabase && userId) {
      const { data, error } = await supabase
        .from("cash_balances")
        .select("amount")
        .eq("portfolio_id", await getDefaultPortfolioId(userId));
      if (error) throw error;
      const row = data?.[0] as CashRow | undefined;
      return row?.amount ? Number(row.amount) : 0;
    }
    return 0;
  };

  const saveCash = async (amount: number): Promise<void> => {
    requireBackend();
    if (supabase && userId) {
      const portfolioId = await getDefaultPortfolioId(userId);
      const { error } = await supabase
        .from("cash_balances")
        .upsert({ portfolio_id: portfolioId, amount }, { onConflict: "portfolio_id" });
      if (error) throw error;
      return;
    }
  };

  // ── Watchlist ───────────────────────────────────────────────────────────

interface WatchlistItemRow {
  symbol: string;
}

  const getWatchlist = async (): Promise<WatchlistItem[]> => {
    requireBackend();
    if (supabase && userId) {
      const { data, error } = await supabase
        .from("watchlist_items")
        .select("symbol")
        .eq("watchlist_id", await getDefaultWatchlistId(userId));
      if (error) throw error;
      return (data || []).map((r: WatchlistItemRow) => ({ symbol: r.symbol }));
    }
    return [];
  };

  const saveWatchlist = async (items: WatchlistItem[]): Promise<void> => {
    requireBackend();
    if (supabase && userId) {
      const watchlistId = await getDefaultWatchlistId(userId);
      const { error: deleteError } = await supabase.from("watchlist_items").delete().eq("watchlist_id", watchlistId);
      if (deleteError) throw deleteError;
      const rows = items.map((item) => ({
        watchlist_id: watchlistId,
        symbol: item.symbol,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("watchlist_items").insert(rows);
        if (error) throw error;
      }
      return;
    }
  };

  // ── Preferences ─────────────────────────────────────────────────────────

  const getPreferences = async (): Promise<UserPreferences> => {
    requireBackend();
    if (supabase && userId) {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("preferred_capital, risk_preference")
        .eq("user_id", userId);
      if (error) throw error;
      return {
        preferredCapital: data?.[0]?.preferred_capital ? Number(data[0].preferred_capital) : undefined,
        riskPreference: data?.[0]?.risk_preference || "moderate",
      };
    }
    return { riskPreference: "moderate" };
  };

  const savePreferences = async (prefs: UserPreferences): Promise<void> => {
    requireBackend();
    if (supabase && userId) {
      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: userId,
          preferred_capital: prefs.preferredCapital || null,
          risk_preference: prefs.riskPreference,
        });
      if (error) throw error;
      return;
    }
  };

  // ── Trade Plans ─────────────────────────────────────────────────────────

  const getTradePlans = async (): Promise<TradePlanRecord[]> => {
    requireBackend();
    if (supabase && userId) {
      const { data: plans, error: plansError } = await supabase
        .from("trade_plans")
        .select("id, generated_at, action, status, signal_date")
        .eq("user_id", userId)
        .order("generated_at", { ascending: false })
        .limit(20);
      if (plansError) throw plansError;
      const records: TradePlanRecord[] = [];
      for (const plan of (plans || []) as TradePlanRow[]) {
        const { data: items, error: itemsError } = await supabase
          .from("trade_plan_items")
          .select("symbol, current_quantity, target_quantity, executable_quantity, action, reason")
          .eq("trade_plan_id", plan.id);
        if (itemsError) throw itemsError;
        records.push({
          id: plan.id,
          generatedAt: plan.generated_at,
          action: plan.action,
          status: plan.status,
          signalDate: plan.signal_date,
          items: (items || []).map((item: TradePlanItemRow) => ({
            symbol: item.symbol,
            currentQuantity: Number(item.current_quantity),
            targetQuantity: Number(item.target_quantity),
            executableQuantity: Number(item.executable_quantity),
            action: item.action,
            reason: item.reason,
          })),
        });
      }
      return records;
    }
    return [];
  };

  const saveTradePlan = async (plan: Omit<TradePlanRecord, "id">): Promise<string> => {
    requireBackend();
    if (supabase && userId) {
      const { data: latestRun, error: runError } = await supabase
        .from("model_runs")
        .select("id")
        .order("signal_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (runError) throw runError;
      const { data, error } = await supabase
        .from("trade_plans")
        .insert({
          user_id: userId,
          model_run_id: latestRun?.id || null,
          action: plan.action,
          status: plan.status,
          signal_date: plan.signalDate,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error("Could not save trade plan");
      const planId = (data as TradePlanRow).id;
      const items = plan.items.map((item) => ({
        trade_plan_id: planId,
        symbol: item.symbol,
        current_quantity: item.currentQuantity,
        target_quantity: item.targetQuantity,
        executable_quantity: item.executableQuantity,
        action: item.action,
        reason: item.reason,
      }));
      if (items.length > 0) {
        const { error: itemError } = await supabase.from("trade_plan_items").insert(items);
        if (itemError) throw itemError;
      }
      return planId;
    }
    throw new Error("Trade plan could not be saved.");
  };

  // The callbacks close over the authenticated user's ID. Keep the API stable
  // while that identity is unchanged so consumer effects do not reload data.
  return useMemo(() => ({
    getHoldings,
    saveHoldings,
    getCash,
    saveCash,
    getWatchlist,
    saveWatchlist,
    getPreferences,
    savePreferences,
    getTradePlans,
    saveTradePlan,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [userId]);
}

// ── Helper functions ───────────────────────────────────────────────────────

interface PortfolioRow {
  id: string;
}

interface WatchlistRow {
  id: string;
}

const portfolioIdCache = new Map<string, Promise<string>>();
const watchlistIdCache = new Map<string, Promise<string>>();

async function getDefaultPortfolioId(userId: string): Promise<string> {
  if (!supabase) return "";
  let pending = portfolioIdCache.get(userId);
  if (!pending) {
    pending = (async () => {
      const { data, error: lookupError } = await supabase!.from("portfolios").select("id").eq("user_id", userId).limit(1);
      if (lookupError) throw lookupError;
      if (data?.length) return (data[0] as PortfolioRow).id;
      const { data: created, error } = await supabase!.from("portfolios").insert({ user_id: userId, name: "My Portfolio" }).select("id").single();
      if (error || !created) throw new Error("Could not create default portfolio");
      return (created as PortfolioRow).id;
    })();
    portfolioIdCache.set(userId, pending);
    pending.catch(() => portfolioIdCache.delete(userId));
  }
  return pending;
}

async function getDefaultWatchlistId(userId: string): Promise<string> {
  if (!supabase) return "";
  let pending = watchlistIdCache.get(userId);
  if (!pending) {
    pending = (async () => {
      const { data, error: lookupError } = await supabase!.from("watchlists").select("id").eq("user_id", userId).limit(1);
      if (lookupError) throw lookupError;
      if (data?.length) return (data[0] as WatchlistRow).id;
      const { data: created, error } = await supabase!.from("watchlists").insert({ user_id: userId, name: "My Watchlist" }).select("id").single();
      if (error || !created) throw new Error("Could not create default watchlist");
      return (created as WatchlistRow).id;
    })();
    watchlistIdCache.set(userId, pending);
    pending.catch(() => watchlistIdCache.delete(userId));
  }
  return pending;
}
