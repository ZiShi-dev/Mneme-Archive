import React from "react";
import { RefreshCw } from "lucide-react";

export function PullToRefreshIndicator({ pullDistance, refreshing, threshold = 68 }) {
  if (pullDistance <= 0 && !refreshing) return null;

  const progress = Math.min(1, pullDistance / threshold);

  return (
    <div
      className={[
        "pull-to-refresh",
        refreshing ? "pull-to-refresh--active" : "",
      ].filter(Boolean).join(" ")}
      style={{ "--ptr-progress": String(progress) }}
      aria-live="polite"
      aria-busy={refreshing}
    >
      <div className="pull-to-refresh__bubble">
        <RefreshCw
          size={18}
          className={refreshing ? "pull-to-refresh__icon--spin" : ""}
          style={refreshing ? undefined : { transform: `rotate(${Math.round(progress * 300)}deg)` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
