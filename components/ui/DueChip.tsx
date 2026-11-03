import { formatDate, relativeDay } from "@/lib/utils";
import { classifyFollowUp } from "@/lib/follow-up-state";

/** "1 day late", "Today", "Tomorrow": when the follow-up is due, as a chip. */
export function DueChip({ dueDate, today }: { dueDate: string; today: string }) {
  const exact = formatDate(dueDate.slice(0, 10));
  const bucket = classifyFollowUp({ status: "pending", due_date: dueDate }, today);
  if (bucket === "today") return <span className="chip-today" title={exact}>Today</span>;
  if (bucket === "overdue") {
    const days = Math.round((Date.parse(today) - Date.parse(dueDate.slice(0, 10))) / 86_400_000);
    return <span className="chip-late" title={exact}>{days <= 1 ? "1 day late" : `${days} days late`}</span>;
  }
  const when = relativeDay(dueDate, today);
  return <span className="chip-soon" title={exact}>{when.charAt(0).toUpperCase() + when.slice(1)}</span>;
}
