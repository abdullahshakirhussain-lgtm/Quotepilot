"use client";

import Link from "next/link";
import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <Link
      href={BUSINESS_EMAIL_SETTINGS}
      className={cn(className ?? "btn-primary")}
      onClick={(e) => {
        if (unsaved && !window.confirm("Go to Settings? What you typed here won't be kept.")) e.preventDefault();
      }}
    >
      <AtSign className="h-4 w-4" /> Add business email
    </Link>
  );
}
