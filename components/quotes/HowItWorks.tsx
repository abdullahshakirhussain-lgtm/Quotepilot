import { cn } from "@/lib/utils";

const STEPS = [
  "Send or track a quote",
  "Follow-up reminders are scheduled",
  "AI helps write the follow-up",
  "You send or copy the message",
  "Mark the quote won or lost",
];

/** The five-step loop, shown to accounts that have no quotes yet. A real sequence, so it's numbered. */
export function HowItWorks({ className }: { className?: string }) {
  return (
    <div className={cn("ql-fade", className)}>
      <h2 className="section-title mb-2">How QuoteLoop works</h2>
      <ol className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-3 py-2 sm:block sm:py-3">
            <span className="num grid h-7 w-7 place-items-center rounded-full bg-stone-900 text-[13px] font-semibold text-white">{i + 1}</span>
            <span className="text-[14px] text-stone-600 sm:mt-2 sm:block">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
