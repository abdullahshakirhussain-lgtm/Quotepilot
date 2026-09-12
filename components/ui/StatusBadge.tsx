import {
  FOLLOW_UP_STATUS_COLORS,
  FOLLOW_UP_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  type FollowUpStatus,
  type LeadStatus,
  type QuoteStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type Props =
  | { kind: "lead"; value: LeadStatus }
  | { kind: "quote"; value: QuoteStatus }
  | { kind: "followup"; value: FollowUpStatus };

export function StatusBadge(props: Props) {
  let color = "bg-slate-100 text-slate-700";
  let label = props.value as string;

  if (props.kind === "lead") {
    color = LEAD_STATUS_COLORS[props.value];
    label = LEAD_STATUS_LABELS[props.value];
  } else if (props.kind === "quote") {
    color = QUOTE_STATUS_COLORS[props.value];
    label = QUOTE_STATUS_LABELS[props.value];
  } else {
    color = FOLLOW_UP_STATUS_COLORS[props.value];
    label = FOLLOW_UP_STATUS_LABELS[props.value];
  }

  return <span className={cn("badge", color)}>{label}</span>;
}
