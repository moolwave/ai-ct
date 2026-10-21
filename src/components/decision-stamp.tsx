import { decisionLabel } from "@/lib/labels";
import type { Decision } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DecisionStamp({ decision }: { decision: Decision }) {
  return (
    <div
      className={cn(
        "stamp",
        decision === "stop" && "border-destructive text-destructive",
        decision === "clear" && "border-clear text-clear",
        decision === "pending" && "border-pending text-pending",
        decision === "incomplete" && "border-foreground text-foreground",
      )}
    >
      {decisionLabel(decision)}
    </div>
  );
}
