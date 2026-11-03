"use client";

import { Check, ChevronDown, FileText } from "lucide-react";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Menu";
import type { ResolvedTemplate } from "@/lib/templates";

/**
 * "Wording: <name>" menu in the quote and follow-up writers: QuoteLoop's
 * ready-made templates (with the user's edits), then the user's own.
 */
export function TemplatePicker({
  templates,
  selectedId,
  onPick,
  disabled,
}: {
  templates: ResolvedTemplate[];
  selectedId: string | null;
  onPick: (template: ResolvedTemplate) => void;
  disabled?: boolean;
}) {
  if (templates.length === 0) return null;
  const selected = templates.find((t) => t.id === selectedId);
  const ready = templates.filter((t) => t.builtinKey);
  const own = templates.filter((t) => !t.builtinKey);
  const item = (t: ResolvedTemplate) => (
    <MenuItem key={t.id} disabled={disabled} onClick={() => onPick(t)}>
      <Check className={t.id === selectedId ? "h-4 w-4 shrink-0" : "invisible h-4 w-4 shrink-0"} aria-hidden />
      <span className="min-w-0 [overflow-wrap:anywhere]">{t.name}</span>
    </MenuItem>
  );

  return (
    <Menu
      label="Choose wording"
      align="left"
      trigger={
        <>
          <FileText className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">{selected ? `Wording: ${selected.name}` : "Use a template"}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </>
      }
      triggerClassName="btn-secondary max-w-full"
    >
      {ready.length > 0 && <MenuLabel>QuoteLoop templates</MenuLabel>}
      {ready.map(item)}
      {own.length > 0 && (
        <>
          {ready.length > 0 && <MenuDivider />}
          <MenuLabel>Your templates</MenuLabel>
          {own.map(item)}
        </>
      )}
    </Menu>
  );
}
