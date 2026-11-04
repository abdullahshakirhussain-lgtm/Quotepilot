import { formatDate, relativeDay } from "@/lib/utils";
import { classifyFollowUp } from "@/lib/follow-up-state";

/** When a follow-up is due, in words: "1 day late", "Today", "Tomorrow". */
export function dueLabel(dueDate: string, today: string): { text: string; bucket: "overdue" | "today" | "upcoming" } {
  const bucket = classifyFollowUp({ status: "pending", due_date: dueDate }, today);
  if (bucket === "today") return { text: "Today", bucket };
  if (bucket === "overdue") {
    const days = Math.round((Date.parse(today) - Date.parse(dueDate.slice(0, 10))) / 86_400_000);
    return { text: days <= 1 ? "1 day late" : `${days} days late`, bucket };
  }
  const when = relativeDay(dueDate, today);
  return { text: when.charAt(0).toUpperCase() + when.slice(1), bucket: "upcoming" };
}

/** "1 day late", "Today", "Tomorrow": when the follow-up is due, as a chip. */
export function DueChip({ dueDate, today }: { dueDate: string; today: string }) {
  const exact = formatDate(dueDate.slice(0, 10));
  const { text, bucket } = dueLabel(dueDate, today);
  const cls = bucket === "today" ? "chip-today" : bucket === "overdue" ? "chip-late" : "chip-soon";
  return <span className={cls} title={exact}>{text}</span>;
}
