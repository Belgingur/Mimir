import type { AppDom } from "./domRegistry";
import { UtilityToggleViewportController } from "../controllers/UtilityToggleViewportController";

export function initEdgeHitWiring(dom: AppDom): void {
  const viewToggleViewportController = new UtilityToggleViewportController({
    element: dom.viewToggleCardEl,
    mapWrap: dom.mapWrap,
    safeMargin: 12,
  });
  const utilityToggleViewportController = new UtilityToggleViewportController({
    element: dom.gridToggleCardEl,
    mapWrap: dom.mapWrap,
    safeMargin: 12,
  });

  if (dom.gridToggleCardEl && dom.gridToggleButton) {
    dom.gridToggleCardEl.addEventListener("click", (event) => {
      if (event.target !== dom.gridToggleCardEl) return;
      dom.gridToggleButton!.click();
    });
  }

  viewToggleViewportController.init();
  utilityToggleViewportController.init();
}
