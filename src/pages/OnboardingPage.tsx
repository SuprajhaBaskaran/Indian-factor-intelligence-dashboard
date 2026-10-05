import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, IndianRupee, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { UserProfile } from "@/lib/auth";
import { useUserData } from "@/lib/userData";
import { saveUserExperience, type RiskPreference } from "@/lib/userExperience";

const journeyOptions = [
  {
    value: false,
    title: "I am starting fresh",
    detail: "Use my investable amount to prepare a simple first model plan.",
    icon: Wallet,
  },
  {
    value: true,
    title: "I already hold stocks",
    detail: "Bring my current holdings into My Plan and compare them with the model.",
    icon: BriefcaseBusiness,
  },
];

const riskOptions: { value: RiskPreference; title: string; detail: string }[] = [
  { value: "conservative", title: "Careful", detail: "Prefer staggered entries and fewer surprises." },
  { value: "moderate", title: "Balanced", detail: "Let the model act, but keep risk controls visible." },
  { value: "aggressive", title: "Growth", detail: "Comfortable reviewing stronger model-led exposure." },
];

export function OnboardingPage({ user, onComplete }: { user: UserProfile; onComplete: () => void }) {
  const userData = useUserData();
  const [hasInvestments, setHasInvestments] = useState<boolean | null>(null);
  const [freshMoney, setFreshMoney] = useState("");
  const [riskPreference, setRiskPreference] = useState<RiskPreference>("moderate");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const complete = async () => {
    if (hasInvestments === null) {
      setError("Choose whether you already hold investments to continue.");
      return;
    }
    const amount = freshMoney.trim() ? Number(freshMoney.replace(/,/g, "")) : 0;
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

  const completeLater = async () => {
    setSaving(true);
    setError("");
    try {
      await userData.savePreferences({ riskPreference });
      saveUserExperience(user.id, { hasInvestments: false, freshMoneyAmount: 0, freshMoneyPending: false, riskPreference });
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your setup could not be skipped. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600">
            <Sparkles size={19} />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-blue-200">Personalize your dashboard</p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal">
            Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}. Let's set up your first plan.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            This only decides how Home and My Plan open for you. No orders are placed, and you can edit everything later.
          </p>

          <div className="mt-8 space-y-3">
            {[
              "Understand whether you are starting fresh or reviewing an existing portfolio.",
              "Save an optional amount of fresh capital for My Plan.",
              "Choose how cautious the interface should be when explaining risk.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-lg bg-white/5 p-3 text-sm leading-5 text-slate-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900">How are you coming into the market?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {journeyOptions.map((option) => {
                const Icon = option.icon;
                const selected = hasInvestments === option.value;
                return (
                  <button
                    key={option.title}
                    type="button"
                    onClick={() => setHasInvestments(option.value)}
                    aria-pressed={selected}
                    className={`rounded-lg border p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-lg ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                      <Icon size={18} />
                    </span>
                    <span className="mt-4 block text-sm font-semibold text-slate-950">{option.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{option.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="text-xs font-semibold text-slate-700">
              Fresh capital to plan with
              <div className="mt-2 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-within:border-blue-500">
                <IndianRupee className="mr-2 h-4 w-4 text-slate-500" />
                <input
                  value={freshMoney}
                  onChange={(event) => setFreshMoney(event.target.value)}
                  inputMode="decimal"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  placeholder={hasInvestments ? "Optional cash available" : "Example: 50000"}
                  aria-label="Fresh capital to plan with"
                />
              </div>
            </label>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              This gives My Plan a starting amount. It does not place trades or change your portfolio.
            </p>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-slate-900">How should risk be explained?</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {riskOptions.map((option) => {
                const selected = riskPreference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRiskPreference(option.value)}
                    aria-pressed={selected}
                    className={`rounded-lg border p-3 text-left transition ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className={`mt-1 block text-xs leading-5 ${selected ? "text-slate-300" : "text-slate-500"}`}>{option.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <p className="text-sm leading-6 text-blue-950">
                After this, Home shows the current market stance and My Plan opens in the right mode: fresh money plan or holdings review.
              </p>
            </div>
          </div>

          {error && <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" disabled={saving} onClick={() => void completeLater()} className="text-sm font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50">
              Explore first
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void complete()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue to Home"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
