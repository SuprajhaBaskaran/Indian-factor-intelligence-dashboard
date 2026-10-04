import { useState } from "react";
import { ArrowRight, BadgeIndianRupee, BriefcaseBusiness, Check, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { UserProfile } from "@/lib/auth";
import { useUserData } from "@/lib/userData";
import { saveUserExperience, type RiskPreference } from "@/lib/userExperience";

const capitalPresets = [25000, 50000, 100000, 250000];

const riskOptions: { value: RiskPreference; title: string; detail: string }[] = [
  { value: "conservative", title: "Conservative", detail: "Prefer steadier suggestions and smaller changes." },
  { value: "moderate", title: "Moderate", detail: "Balanced plan with normal model sizing." },
  { value: "aggressive", title: "Aggressive", detail: "Comfortable with stronger opportunity seeking." },
];

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function OnboardingPage({ user, onComplete }: { user: UserProfile; onComplete: () => void }) {
  const userData = useUserData();
  const [hasInvestments, setHasInvestments] = useState<boolean | null>(null);
  const [freshMoney, setFreshMoney] = useState("");
  const [riskPreference, setRiskPreference] = useState<RiskPreference>("moderate");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const amount = freshMoney.trim() ? Number(freshMoney.replace(/,/g, "")) : 0;
  const firstName = user.name?.split(" ")[0] || "there";

  const complete = async () => {
    if (hasInvestments === null) {
      setError("Choose whether you already hold investments to continue.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount or leave it blank.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await userData.savePreferences({ preferredCapital: amount > 0 ? amount : undefined, riskPreference });
      saveUserExperience(user.id, { hasInvestments, freshMoneyAmount: amount, freshMoneyPending: amount > 0, riskPreference });
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your preferences could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.85fr_1.15fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-blue-200">Quick setup</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">Welcome, {firstName}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Tell us where you are starting from. We will use this only to personalize Home and My Plan.
          </p>
          <div className="mt-8 space-y-4 text-sm">
            {[
              "No trades are placed automatically.",
              "You can edit holdings and cash later.",
              "Your personal inputs stay in your account.",
            ].map((item) => (
              <div key={item} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 1 of 1</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Set up your starting point</h2>
            </div>
            <div className="hidden rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 sm:block">
              Takes under a minute
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Pick the path that matches you. The app will open the right plan flow after this.
          </p>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-slate-900">Which sounds like you?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { value: false, title: "I am starting fresh", detail: "Enter capital and get model-based buy ideas.", icon: Wallet },
                { value: true, title: "I already hold stocks", detail: "Import or enter holdings, then review changes.", icon: BriefcaseBusiness },
              ].map((option) => {
                const Icon = option.icon;
                const active = hasInvestments === option.value;
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setHasInvestments(option.value)}
                    aria-pressed={active}
                    className={`rounded-lg border p-4 text-left transition ${
                      active ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="mt-3 block text-sm font-bold text-slate-950">{option.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{option.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="text-sm font-semibold text-slate-900">
              Fresh money you may want to invest
              <div className="mt-3 flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <BadgeIndianRupee className="mr-2 h-4 w-4 text-slate-500" />
                <input
                  value={freshMoney}
                  onChange={(event) => setFreshMoney(event.target.value)}
                  inputMode="decimal"
                  className="min-w-0 flex-1 outline-none"
                  placeholder="Leave blank if none"
                  aria-label="Fresh money to invest"
                />
              </div>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {capitalPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFreshMoney(String(preset))}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                >
                  {formatAmount(preset)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFreshMoney("")}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                No fresh money
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              This only pre-fills My Plan. It does not place trades or move money.
            </p>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-slate-900">Risk preference</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {riskOptions.map((option) => {
                const active = riskPreference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRiskPreference(option.value)}
                    className={`rounded-lg border p-3 text-left transition ${
                      active ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-950">
                      <ShieldCheck className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
                      {option.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-950">Next</p>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              {hasInvestments === true
                ? "You will start at Home, then My Plan will ask you to import or enter holdings."
                : hasInvestments === false
                ? "You will start at Home, then My Plan can turn your investment amount into buy ideas."
                : "Choose a starting path so the app can guide you correctly."}
            </p>
          </div>

          {error && <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">You can change these settings later.</p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void complete()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue to Home"}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
