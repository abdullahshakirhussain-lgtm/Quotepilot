import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-2 text-sm text-stone-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    </div>
  );
}
