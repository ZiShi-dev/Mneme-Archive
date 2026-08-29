import { isChromebookApp } from "../../config/appFlavor.js";

export function getAppBrandText(t) {
  if (!isChromebookApp) {
    return {
      name: t("app.name"),
      nameLead: t("app.nameLead"),
      nameTail: t("app.nameTail"),
      kicker: t("app.kicker"),
      loading: t("app.loading"),
      profileName: t("settings.profileName"),
    };
  }

  return {
    name: t("app.nameDesktop"),
    nameLead: t("app.nameDesktopLead"),
    nameTail: t("app.nameDesktopTail"),
    kicker: t("app.kickerDesktop"),
    loading: t("app.loadingDesktop"),
    profileName: t("settings.profileNameDesktop"),
  };
}

export function getAppDocumentTitle(t) {
  return isChromebookApp ? t("app.nameDesktop") : t("app.name");
}
