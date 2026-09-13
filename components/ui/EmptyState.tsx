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
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white/60 px-6 text-center ${
        compact ? "py-8" : "py-14"
      }`}
    >
      {icon && (
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-md bg-stone-900/5 text-stone-500">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-stone-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
