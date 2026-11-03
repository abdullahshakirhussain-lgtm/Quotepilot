import { cn } from "@/lib/utils";

/**
 * One part of Settings, as a card: the heading and what it's for on the left,
 * the controls on the right (stacked on phones). `danger` gives the card a red
 * edge and heading, for the one place data can be wiped.
 */
export function SettingsSection({
  id,
  title,
  description,
  danger = false,
  children,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "card mb-4 grid scroll-mt-20 gap-x-10 gap-y-4 p-5 sm:p-6 lg:grid-cols-[15rem_minmax(0,1fr)]",
        danger && "border-red-200"
      )}
    >
      <div>
        <h2 className={cn("text-[17px] font-medium leading-tight", danger ? "text-red-700" : "text-stone-900")}>{title}</h2>
        {description && <p className="mt-1 max-w-prose text-[14px] text-stone-500">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
