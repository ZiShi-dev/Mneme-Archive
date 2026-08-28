import React from "react";
import { Bell, BellRing, Compass, Hash } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";

export function UpdatesEmptyPanel({ onDiscover, onSettings }) {
  const { t } = useI18n();
  const steps = [
    { icon: Compass, title: t("updates.openAny"), text: t("updates.fromDiscover") },
    { icon: BellRing, title: t("updates.enableFollow"), text: t("updates.fromDetails") },
    { icon: Hash, title: t("updates.pickNumber"), text: t("updates.intervalHint") },
  ];

  return (
    <section className="updates-onboarding" aria-label={t("updates.how")}>
      <div className="updates-onboarding__intro">
        <span className="updates-onboarding__icon" aria-hidden="true">
          <Bell size={26} />
        </span>
        <h2>{t("updates.startFollow")}</h2>
        <p>{t("updates.appearHere")}</p>
      </div>

      <ol className="updates-onboarding__steps">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          return (
            <li key={step.title}>
              <span className="updates-onboarding__step-index" aria-hidden="true">{index + 1}</span>
              <span className="updates-onboarding__step-icon" aria-hidden="true">
                <StepIcon size={14} />
              </span>
              <span className="updates-onboarding__step-copy">
                <strong>{step.title}</strong>
                <small>{step.text}</small>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="updates-onboarding__actions">
        <button type="button" className="button button--primary" onClick={onDiscover}>
          {t("updates.discover")}
        </button>
        <button type="button" className="updates-onboarding__secondary" onClick={onSettings}>
          {t("updates.notifySettings")}
        </button>
      </div>
    </section>
  );
}
