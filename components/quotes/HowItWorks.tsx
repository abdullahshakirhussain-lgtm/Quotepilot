import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Send or track a quote",
  "Follow-up reminders are scheduled",
  "AI helps write the follow-up",
  "You send or copy the message",
  "Mark the quote won or lost",
];

/** The five-step loop, shown to accounts that have no quotes yet. */
export function HowItWorks({ className }: { className?: string }) {
  return (
    <div className={cn("card px-4 py-3", className)}>
      <p className="eyebrow mb-2">How QuoteLoop works</p>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-stone-600">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-stone-900 text-[11px] font-semibold text-white">
              {i + 1}
            </span>
            <span>{step}</span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-stone-300 sm:block" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
