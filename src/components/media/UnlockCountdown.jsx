import React, { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { formatUnlockCountdownLabel, parseUnlockAt } from "../../lib/media/chapterLock";

export function UnlockCountdown({ unlockAt, className = "" }) {
  const { t } = useI18n();
  const target = parseUnlockAt(unlockAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target == null) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (target == null) return null;

  const remaining = target - now;
  const compact = /\bunlock-countdown--compact\b/.test(className);
  const classNames = ["unlock-countdown", className].filter(Boolean).join(" ");

  if (remaining <= 0) {
    return <span className={`${classNames} unlock-countdown--ready`}>{t("details.available")}</span>;
  }

  const time = formatUnlockCountdownLabel(remaining);
  if (compact) {
    return (
      <span className={classNames}>
        <span className="unlock-countdown__time" dir="ltr">{time}</span>
      </span>
    );
  }

  const template = t("details.unlocksIn", { time: "%%TIME%%" });
  const [before, after] = String(template).split("%%TIME%%");
  return (
    <span className={classNames}>
      {before}
      <span className="unlock-countdown__time" dir="ltr">{time}</span>
      {after || null}
    </span>
  );
}
