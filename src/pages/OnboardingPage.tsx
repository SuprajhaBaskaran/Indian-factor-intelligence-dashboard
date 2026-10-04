import { useState } from "react";
import type { UserProfile } from "@/lib/auth";
import { useUserData } from "@/lib/userData";
import { saveUserExperience, type RiskPreference } from "@/lib/userExperience";

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

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">A quick setup</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">This helps Home and My Plan start in the right place. You can add or change your holdings later.</p>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-slate-800">Do you currently hold investments?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[{ value: false, title: "No, I’m getting started", detail: "Start with an investment amount and a simple model plan." }, { value: true, title: "Yes, I already invest", detail: "Add your existing holdings and compare them with model targets." }].map((option) => (
              <button key={String(option.value)} type="button" onClick={() => setHasInvestments(option.value)} aria-pressed={hasInvestments === option.value} className={`rounded-lg border p-4 text-left ${hasInvestments === option.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">{option.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-700">
            Fresh money you may want to invest (optional)
            <div className="mt-1 flex rounded-md border border-slate-300 px-3 py-2 text-sm"><span className="mr-2 text-slate-500">₹</span><input value={freshMoney} onChange={(event) => setFreshMoney(event.target.value)} inputMode="decimal" className="min-w-0 flex-1 outline-none" placeholder="Leave blank if none" aria-label="Fresh money to invest" /></div>
            <span className="mt-1 block font-normal text-slate-500">This saves a starting amount for My Plan; it does not place trades.</span>
          </label>
          <label className="text-xs font-medium text-slate-700">
            Risk preference (optional)
            <select value={riskPreference} onChange={(event) => setRiskPreference(event.target.value as RiskPreference)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="conservative">Conservative</option><option value="moderate">Moderate</option><option value="aggressive">Aggressive</option>
            </select>
            <span className="mt-1 block font-normal text-slate-500">This preference is saved with your existing account settings.</span>
          </label>
        </div>

        {error && <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
        <div className="mt-6 flex justify-end">
          <button type="button" disabled={saving} onClick={() => void complete()} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving…" : "Continue to Home"}</button>
        </div>
      </section>
    </div>
  );
}
