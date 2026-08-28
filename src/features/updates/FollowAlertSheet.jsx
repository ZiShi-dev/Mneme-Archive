import React, { useEffect, useState } from "react";
import { Bell, Minus, Plus } from "lucide-react";
import { SheetCloseButton } from "../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../components/ui/SheetPortal";
import {
  describeFollowHint,
  followPresetLabel,
  followSheetIntervalQuestion,
  resolveFollowMediaType,
} from "../../lib/updates/followMessaging";
import { FOLLOW_INTERVAL_PRESETS } from "../../lib/updates/followKeys";
import { useI18n } from "../../i18n/I18nProvider";

export function FollowAlertSheet({
  item,
  preference,
  onSave,
  onDisable,
  onClose,
}) {
  const { t, dir } = useI18n();
  const [interval, setInterval] = useState(preference?.interval || 1);
  const [backdropArmed, setBackdropArmed] = useState(false);
  const mediaType = resolveFollowMediaType({ ...item, ...preference });

  useEffect(() => {
    setInterval(preference?.interval || 1);
  }, [preference?.interval, item?.url]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setBackdropArmed(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      setBackdropArmed(false);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function handleSave() {
    onSave({
      enabled: true,
      interval,
    });
    onClose();
  }

  return (
    <SheetPortal>
    <div
      className="follow-sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (!backdropArmed || event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <section
        className="follow-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-sheet-title"
        dir={dir}
      >
        <header>
          <div>
            <small>{t("follow.title")}</small>
            <h2 id="follow-sheet-title">{item.title}</h2>
          </div>
          <SheetCloseButton onClick={onClose} />
        </header>

        <div className="follow-sheet__body">
          <p className="follow-sheet__intro">
            {t("follow.comboHint")}
          </p>

          <div className="follow-interval follow-interval--hero">
            <span><Bell size={15} /><strong>{followSheetIntervalQuestion(mediaType)}</strong></span>
            <div className="follow-interval__stepper">
              <button
                type="button"
                onClick={() => setInterval((value) => Math.max(1, value - 1))}
                disabled={interval <= 1}
                aria-label={t("follow.decrease")}
              >
                <Minus size={16} />
              </button>
              <strong>{interval}</strong>
              <button
                type="button"
                onClick={() => setInterval((value) => Math.min(50, value + 1))}
                disabled={interval >= 50}
                aria-label={t("follow.increase")}
              >
                <Plus size={16} />
              </button>
            </div>
            <small>{describeFollowHint(interval, mediaType)}</small>
          </div>

          <div className="follow-presets" role="group" aria-label={t("follow.quick")}>
            {FOLLOW_INTERVAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={interval === preset ? "active" : ""}
                onClick={() => setInterval(preset)}
                aria-pressed={interval === preset}
              >
                {followPresetLabel(preset, mediaType)}
              </button>
            ))}
          </div>
        </div>

        <footer>
          {preference?.enabled && (
            <button type="button" className="follow-sheet__disable" onClick={() => { onDisable(); onClose(); }}>
              {t("follow.stop")}
            </button>
          )}
          <button type="button" className="follow-sheet__save" onClick={handleSave}>
            {t("follow.save")}
          </button>
        </footer>
      </section>
    </div>
    </SheetPortal>
  );
}
