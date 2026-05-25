/**
 * Layer toggle — shows/hides the layer-group-list via a trigger button.
 * Works on all screen sizes. The trigger sits inside the layer-switch-card,
 * and clicking it reveals/hides the layer icons below.
 */
export function initMobileDrawer(): void {
  const trigger = document.getElementById(
    "layer-toggle-trigger",
  ) as HTMLButtonElement | null;
  const layerList = document.getElementById(
    "layer-group-list",
  ) as HTMLElement | null;
  if (!trigger || !layerList) return;

  function toggle() {
    const isOpen = !layerList!.hidden;
    layerList!.hidden = isOpen;
    trigger!.classList.toggle("is-open", !isOpen);
    trigger!.setAttribute("aria-expanded", String(!isOpen));
  }

  trigger.addEventListener("click", toggle);
}
