import { useId, useState } from "react";
import { Info } from "lucide-react";
import { getTermDefinition } from "@/lib/terms";

interface TermTooltipProps {
  term: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A reusable term explanation component.
 *
 * Wraps any text with an info icon that, when clicked/hovered, shows a
 * plain-English explanation of the term.
 *
 * Usage:
 *   <TermTooltip term="stagger buys">Stagger Buys</TermTooltip>
 */
export function TermTooltip({ term, children, className = "" }: TermTooltipProps) {
  const [show, setShow] = useState(false);
  const tooltipId = useId();
  const definition = getTermDefinition(term);

  if (!definition) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={`relative inline-flex items-center gap-1 ${className}`}>
      <span>{children}</span>
      <button
        type="button"
        className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-50 text-blue-700 shadow-sm transition-colors hover:bg-blue-100 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onKeyDown={(event) => { if (event.key === "Escape") setShow(false); }}
        aria-expanded={show}
        aria-describedby={show ? tooltipId : undefined}
        aria-label={`What does ${term} mean?`}
      >
        <Info size={12} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {show && (
        <div id={tooltipId} role="tooltip" className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-[min(18rem,80vw)] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-xs font-semibold text-slate-900">{definition.term}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{definition.definition}</p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setShow(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
