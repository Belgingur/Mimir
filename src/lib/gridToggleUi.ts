import { t } from "./i18n";

export const syncGridToggleButtonState = (
  button: HTMLButtonElement | null,
  showGrid: boolean,
) => {
  if (!button) return;
  button.classList.toggle("is-active", showGrid);
  button.setAttribute("aria-pressed", showGrid ? "true" : "false");
  button.title = showGrid ? t("map.gridOn") : t("map.gridOff");
};
