import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout, type PageId } from "@/components/Layout";
import { LoginPage } from "@/pages/LoginPage";
import { CommandCenterPage } from "@/pages/CommandCenterPage";
import { MarketViewPage } from "@/pages/MarketViewPage";
import { TradePlanPage } from "@/pages/TradePlanPage";
import { FinalPortfolioPage } from "@/pages/FinalPortfolioPage";
import { StockInspectorPage } from "@/pages/StockInspectorPage";
import { PerformanceTrustPage } from "@/pages/PerformanceTrustPage";
import { AdvancedResearchPage } from "@/pages/AdvancedResearchPage";
import { AdminStatusPage } from "@/pages/AdminStatusPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { loadDashboardData } from "@/lib/data";
import { logBackendStatus } from "@/lib/supabase";
import { readUserExperienceFromAccount } from "@/lib/userExperience";

const pathFor: Record<PageId, string> = {
  "command-center": "/",
  "market-view": "/market",
  "trade-plan": "/plan",
  "my-portfolio": "/portfolio",
  "stock-inspector": "/stock",
  "performance-trust": "/trust",
  "advanced-research": "/research",
  "admin-status": "/admin-status",
};

function routeFromPath(): PageId {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const pages: Record<string, PageId> = {
    "/": "command-center",
    "/market": "market-view",
    "/plan": "trade-plan",
    "/portfolio": "my-portfolio",
    "/stock": "stock-inspector",
    "/trust": "performance-trust",
    "/research": "advanced-research",
    "/admin-status": "admin-status",
  };
  return pages[path] || "command-center";
}

function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}

function AppInner() {
  const [route, setRoute] = useState<PageId>(routeFromPath);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const { user, loading, isDevelopmentUser, isAdmin } = useAuth();
  const welcomedAdmin = useRef<string | null>(null);

  useEffect(() => {
    logBackendStatus();
    let active = true;
    setReady(false);
    setError(null);
    loadDashboardData()
      .then(() => { if (active) setReady(true); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    let active = true;
    if (!user || isAdmin) {
      setNeedsOnboarding(false);
      return () => { active = false; };
    }
    readUserExperienceFromAccount(user.id)
      .then((experience) => {
        if (active) setNeedsOnboarding(!experience);
      })
      .catch(() => {
        if (active) setNeedsOnboarding(true);
      });
    return () => { active = false; };
  }, [isAdmin, user?.id]);

  useEffect(() => {
    if (!user) {
      welcomedAdmin.current = null;
      return;
    }
    if (isAdmin && welcomedAdmin.current !== user.id) {
      welcomedAdmin.current = user.id;
      window.history.replaceState(null, "", "/");
      setRoute("command-center");
    }
  }, [isAdmin, user]);

  useEffect(() => {
    if (route === "admin-status" && !isAdmin) {
      window.history.replaceState(null, "", "/");
      setRoute("command-center");
    }
  }, [isAdmin, route]);

  const navigate = (page: PageId) => {
    window.history.pushState(null, "", pathFor[page]);
    setRoute(page);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">Restoring your secure session…</div>;
  if (!user) return <LoginPage configurationError={isDevelopmentUser ? "Supabase is not configured. Authentication and saved data are unavailable." : undefined} onLoginSuccess={() => { window.history.replaceState(null, "", "/"); setRoute("command-center"); }} />;
  if (error) return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="max-w-md rounded-2xl border border-red-200 bg-white p-7"><h1 className="text-lg font-semibold">Published data is unavailable</h1><p className="mt-2 text-sm text-slate-600">Model values are withheld until the required data snapshots load.</p><p className="mt-3 text-xs text-slate-500">{error}</p><button className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => setAttempt((value) => value + 1)}>Retry</button></section></div>;
  if (!ready) return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-5xl space-y-4 pt-20">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />)}</div></div>;
  if (needsOnboarding && !isAdmin) return <OnboardingPage user={user} onComplete={() => setNeedsOnboarding(false)} />;

  const content = route === "command-center"
    ? <CommandCenterPage user={user} onNavigate={(page) => navigate(page === "my-plan" ? "trade-plan" : page === "trust" ? "performance-trust" : "advanced-research")} />
    : route === "market-view" ? <MarketViewPage />
    : route === "trade-plan" ? <TradePlanPage />
    : route === "my-portfolio" ? <FinalPortfolioPage onNavigate={navigate} />
    : route === "stock-inspector" ? <StockInspectorPage />
    : route === "performance-trust" ? <PerformanceTrustPage />
    : route === "advanced-research" ? <AdvancedResearchPage />
    : isAdmin ? <AdminStatusPage /> : null;

  return <Layout currentPage={route} onNavigate={navigate} isAdmin={isAdmin}>{content}</Layout>;
}

export default App;
