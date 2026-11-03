/**
 * Nothing to show yet: what's missing and the one thing to do about it.
 * A white card, left-aligned.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`card ql-fade px-5 sm:px-6 ${compact ? "py-5" : "py-8"}`}>
      <div className="flex items-center gap-2 text-stone-900">
        {icon && <span className="text-stone-600">{icon}</span>}
        <h3 className="text-[18px] font-medium leading-tight">{title}</h3>
      </div>
      {description && <p className="mt-1.5 max-w-xl text-[14px] text-stone-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
