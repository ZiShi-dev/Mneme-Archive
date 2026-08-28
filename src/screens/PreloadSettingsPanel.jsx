import React, { useEffect, useState } from "react";

import { ChevronLeft, Download, Minus, Plus, Wifi } from "lucide-react";

import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";

import { DEFAULT_APP_SETTINGS, PRELOAD_PAGES_MAX, PRELOAD_PAGES_MIN } from "../lib/settings/defaults";

import { getPreloadNetworkStatus, refreshNetworkStatus } from "../lib/platform/networkStatus";

import { useI18n } from "../i18n/I18nProvider";



function SheetSwitch({ enabled, onToggle, label }) {

  return (

    <button

      type="button"

      className={`notify-sheet__switch${enabled ? " notify-sheet__switch--on" : ""}`}

      role="switch"

      aria-checked={enabled}

      aria-label={label}

      onClick={onToggle}

    >

      <i />

    </button>

  );

}



export function PreloadSettingsSheet({

  open,

  onClose,

  settings,

  onTogglePreload,

  onToggleWifiOnly,

  onSetPreloadPages,

}) {

  const { t } = useI18n();

  const [networkStatus, setNetworkStatus] = useState(() => getPreloadNetworkStatus());



  useEffect(() => {

    if (!open) return undefined;



    const updateStatus = () => { void refreshNetworkStatus().then(setNetworkStatus); };

    updateStatus();



    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const handleConnectionChange = () => updateStatus();

    connection?.addEventListener?.("change", handleConnectionChange);



    const closeOnEscape = (event) => {

      if (event.key === "Escape") onClose();

    };

    window.addEventListener("keydown", closeOnEscape);



    return () => {

      connection?.removeEventListener?.("change", handleConnectionChange);

      window.removeEventListener("keydown", closeOnEscape);

    };

  }, [open, onClose]);



  if (!open) return null;



  const enabled = settings.preload !== false;

  const wifiOnly = settings.wifi !== false;

  const preloadPages = Math.max(

    PRELOAD_PAGES_MIN,

    Math.min(PRELOAD_PAGES_MAX, Number(settings.preloadPages) || DEFAULT_APP_SETTINGS.preloadPages),

  );



  const pagesCaption = preloadPages === 1

    ? t("data.preloadOnePageCaption")

    : t("data.preloadPagesCaption", { n: preloadPages });



  let networkStatusText = "";

  let networkStatusTone = "neutral";

  if (wifiOnly) {

    if (networkStatus.wifiLike) {

      networkStatusText = t("data.preloadActiveOnNetwork", { label: networkStatus.label });

      networkStatusTone = "active";

    } else {

      networkStatusText = t("data.preloadPausedOnNetwork", { label: networkStatus.label });

      networkStatusTone = "paused";

    }

  }



  return (

    <SheetPortal>

    <div

      className="notify-sheet-backdrop"

      role="presentation"

      onMouseDown={(event) => {

        if (event.target === event.currentTarget) onClose();

      }}

    >

      <section

        className="notify-sheet preload-sheet"

        role="dialog"

        aria-modal="true"

        aria-labelledby="preload-sheet-title"

      >

        <header>

          <div>

            <small>{t("data.readingSettings")}</small>

            <h2 id="preload-sheet-title">{t("data.preload")}</h2>

          </div>

          <SheetCloseButton onClick={onClose} />

        </header>



        <div className="notify-sheet__body preload-sheet__body">

          <div className="preload-sheet__toggle">

            <div className="preload-sheet__toggle-copy">

              <span className="preload-sheet__toggle-icon"><Download size={16} /></span>

              <div>

                <strong>{t("data.enablePreload")}</strong>

                <small>{t("data.preloadScrollHint")}</small>

              </div>

            </div>

            <SheetSwitch

              enabled={enabled}

              label={enabled ? t("data.disablePreload") : t("data.enablePreload")}

              onToggle={onTogglePreload}

            />

          </div>



          {enabled ? (

            <div className="preload-sheet__panel">

              <section className="preload-sheet__block" aria-label={t("data.pageCount")}>

                <div className="preload-sheet__block-head">

                  <strong>{t("data.pageCount")}</strong>

                  <span>{PRELOAD_PAGES_MIN}–{PRELOAD_PAGES_MAX}</span>

                </div>



                <div className="preload-sheet__stepper" role="group" aria-label={t("data.pageCount")}>

                  <button

                    type="button"

                    className="preload-sheet__stepper-btn"

                    aria-label={t("data.decreasePages")}

                    disabled={preloadPages <= PRELOAD_PAGES_MIN}

                    onClick={() => onSetPreloadPages(preloadPages - 1)}

                  >

                    <Minus size={18} />

                  </button>

                  <div className="preload-sheet__stepper-value">

                    <input

                      type="number"

                      min={PRELOAD_PAGES_MIN}

                      max={PRELOAD_PAGES_MAX}

                      inputMode="numeric"

                      aria-label={t("data.pageCount")}

                      value={preloadPages}

                      onChange={(event) => onSetPreloadPages(event.target.value)}

                    />

                    <small>{t("data.page")}</small>

                  </div>

                  <button

                    type="button"

                    className="preload-sheet__stepper-btn"

                    aria-label={t("data.increasePages")}

                    disabled={preloadPages >= PRELOAD_PAGES_MAX}

                    onClick={() => onSetPreloadPages(preloadPages + 1)}

                  >

                    <Plus size={18} />

                  </button>

                </div>



                <p className="preload-sheet__caption">{pagesCaption}</p>

              </section>



              <div className="preload-sheet__divider" aria-hidden="true" />



              <section className="preload-sheet__block" aria-label={t("data.limits")}>

                <div className="preload-sheet__wifi">

                  <div className="preload-sheet__wifi-copy">

                    <span className="preload-sheet__wifi-icon"><Wifi size={16} /></span>

                    <div>

                      <strong>{t("data.wifiOnly")}</strong>

                      <small>{t("data.wifiPreloadHint")}</small>

                    </div>

                  </div>

                  <SheetSwitch

                    enabled={wifiOnly}

                    label={wifiOnly ? t("data.disableWifi") : t("data.enableWifi")}

                    onToggle={onToggleWifiOnly}

                  />

                </div>



                {wifiOnly ? (

                  <p className={`preload-sheet__status preload-sheet__status--${networkStatusTone}`}>

                    {networkStatusText}

                  </p>

                ) : (

                  <p className="preload-sheet__status preload-sheet__status--neutral">

                    {t("data.allNetworks")}

                  </p>

                )}

              </section>

            </div>

          ) : (

            <p className="preload-sheet__disabled-hint">

              {t("data.preloadOffHint")}

            </p>

          )}

        </div>



        <footer className="preload-sheet__footer">

          <button type="button" className="notify-sheet__done preload-sheet__done" onClick={onClose}>

            {t("common.done")}

          </button>

        </footer>

      </section>

    </div>

    </SheetPortal>

  );

}



export function PreloadSettingsEntry({ settings, onOpen }) {

  const { t } = useI18n();

  const enabled = settings.preload !== false;

  const preloadPages = Math.max(

    PRELOAD_PAGES_MIN,

    Math.min(PRELOAD_PAGES_MAX, Number(settings.preloadPages) || DEFAULT_APP_SETTINGS.preloadPages),

  );



  let summary = t("data.preloadDisabled");

  if (enabled) {

    summary = preloadPages === 1

      ? t("data.preloadSummaryOne")

      : t("data.pages", { n: preloadPages });

    if (settings.wifi !== false) summary += ` · ${t("data.wifiOnlyChip")}`;

  }



  return (

    <button type="button" className="setting-row" onClick={onOpen}>

      <span className="setting-row__icon"><Download size={19} /></span>

      <span className="setting-row__copy">

        <strong>{t("data.preload")}</strong>

        <small>{summary}</small>

      </span>

      <ChevronLeft size={18} />

    </button>

  );

}

