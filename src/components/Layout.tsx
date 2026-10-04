import { useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, BriefcaseBusiness, ChartNoAxesCombined, Database, LayoutDashboard,
  LogOut, Search, Settings, ShieldCheck, SlidersHorizontal, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getEodRefreshStatus, getExperimentManifest } from "@/lib/data";

export type PageId =
  | "command-center"
  | "market-view"
  | "trade-plan"
  | "my-portfolio"
  | "stock-inspector"
  | "performance-trust"
  | "advanced-research"
  | "admin-status";

type Props = {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  isAdmin: boolean;
  children: ReactNode;
};

const navigation: { id: PageId; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { id: "command-center", label: "Home", icon: LayoutDashboard },
  { id: "market-view", label: "Market", icon: TrendingUp },
  { id: "trade-plan", label: "My Plan", icon: ChartNoAxesCombined },
  { id: "my-portfolio", label: "Portfolio", icon: BriefcaseBusiness },
  { id: "stock-inspector", label: "Stocks", icon: Search },
  { id: "performance-trust", label: "Trust", icon: ShieldCheck },
  { id: "advanced-research", label: "Research", icon: SlidersHorizontal },
  { id: "admin-status", label: "Admin Status", icon: Settings, adminOnly: true },
];

export function Layout({ currentPage, onNavigate, isAdmin, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const eod = getEodRefreshStatus();
  const freshness = getExperimentManifest()?.data_freshness;
  const daysBehind = freshness?.eod.trading_days_behind;
  const freshnessText = eod.resolved_date
    ? `Latest data ${eod.resolved_date}${daysBehind && daysBehind > 0 ? ` · ${daysBehind} trading day${daysBehind === 1 ? "" : "s"} behind` : ""}`
    : "Latest data unavailable";
  const dataCurrent = freshness?.status === "current" || (!freshness && eod.status === "ok");
  const items = navigation.filter((item) => !item.adminOnly || isAdmin);
  const go = (page: PageId) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-800 bg-slate-900 text-slate-300 lg:flex">
        <div className="flex h-[82px] items-center gap-3 border-b border-slate-800 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white"><Database size={19} /></span>
          <span><span className="block text-sm font-semibold text-white">Factor Intel</span><span className="block text-[11px] text-slate-400">Trading Assistant</span></span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Main navigation">
          {items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} aria-current={currentPage === id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${currentPage === id ? "bg-blue-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><Icon size={16} />{label}</button>)}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-[10px] leading-5 text-slate-500">
          <p>Mode: Monthly + EOD overlay</p>
          <p>Data: Indian SQLite/CSV</p>
          {user && <button onClick={() => void signOut()} className="mt-2 flex items-center gap-1.5 text-slate-400 hover:text-white"><LogOut size={12} /> Sign out</button>}
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)}><aside className="flex h-full w-60 flex-col bg-slate-900 text-slate-300" onClick={(event) => event.stopPropagation()}><div className="flex h-[82px] items-center gap-3 border-b border-slate-800 px-6"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white"><Database size={19} /></span><span><span className="block text-sm font-semibold text-white">Factor Intel</span><span className="block text-[11px] text-slate-400">Trading Assistant</span></span></div><nav className="flex-1 space-y-1 px-3 py-5" aria-label="Mobile navigation">{items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} aria-current={currentPage === id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${currentPage === id ? "bg-blue-600 font-semibold text-white" : "text-slate-300"}`}><Icon size={16} />{label}</button>)}</nav><div className="border-t border-slate-800 px-5 py-4 text-[10px] leading-5 text-slate-500"><p>Mode: Monthly + EOD overlay</p><p>Data: Indian SQLite/CSV</p>{user && <button onClick={() => void signOut()} className="mt-2 flex items-center gap-1.5 text-slate-400"><LogOut size={12} /> Sign out</button>}</div></aside></div>}

      <div className="min-h-screen min-w-0 overflow-x-hidden lg:pl-60">
        <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded p-1 text-slate-500 hover:bg-slate-100 lg:hidden"><Activity size={19} /></button>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white"><Database size={16} /></span>
            <span><span className="block text-sm font-semibold leading-4 text-slate-900">Indian Factor Intelligence</span><span className="block text-[10px] text-slate-500">Nifty 200 Trading Assistant</span></span>
          </div>
          <div className="flex items-center gap-2 text-right text-[11px] text-slate-500"><span className="hidden sm:inline">Monthly Positional Model</span><span className={`ml-2 h-2 w-2 rounded-full ${dataCurrent ? "bg-emerald-500" : "bg-amber-500"}`} /><span>{freshnessText}</span></div>
        </header>
        <main className="min-h-[calc(100vh-112px)] min-w-0 overflow-x-hidden px-4 py-6 sm:px-7 sm:py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-[10px] text-slate-400">Indian Regime/Factor/Portfolio Intelligence Dashboard - Monthly model + daily execution overlay</footer>
      </div>
    </div>
  );
}
