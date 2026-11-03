"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/** Settings, with the business email field picked out. */
export const BUSINESS_EMAIL_SETTINGS = "/settings?focus=business-email";

/**
 * The way out of "add your business email before sending": straight to the
 * field in Settings. `unsaved` asks first when leaving would lose typing.
 */
export function AddBusinessEmailButton({
  unsaved = false,
  className,
}: {
  unsaved?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      <Link
        href={BUSINESS_EMAIL_SETTINGS}
        className={cn(className ?? "btn-primary")}
        onClick={async (e) => {
          if (!unsaved) return;
          e.preventDefault();
          const ok = await confirm({
            title: "Go to Settings?",
            message: "What you typed here won't be kept.",
            confirmLabel: "Go to Settings",
            cancelLabel: "Stay here",
          });
          if (ok) router.push(BUSINESS_EMAIL_SETTINGS);
        }}
      >
        <AtSign className="h-4 w-4" /> Add business email
      </Link>
      {confirmDialog}
    </>
  );
}
