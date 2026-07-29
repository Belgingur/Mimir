export function setupLegendDrag(
  card: HTMLDivElement,
  constraintEl: HTMLElement,
): void {
  let offsetX = 0;
  let offsetY = 0;
  let wasDragged = false;

  const resetPosition = () => {
    if (!wasDragged) return;
    card.style.left = "";
    card.style.top = "";
    card.style.right = "";
    card.style.bottom = "";
    // Restore any CSS transform used for default positioning (e.g. a
    // translateX(-50%) top-centre anchor) that `move` cleared while dragging.
    card.style.transform = "";
    wasDragged = false;
  };

  const stop = () => {
    card.classList.remove("is-dragging");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };

  const move = (event: PointerEvent) => {
    const mapRect = constraintEl.getBoundingClientRect();
    const legendRect = card.getBoundingClientRect();
    const left = Math.min(
      Math.max(mapRect.left, event.clientX - offsetX),
      mapRect.right - legendRect.width,
    );
    const top = Math.min(
      Math.max(mapRect.top, event.clientY - offsetY),
      mapRect.bottom - legendRect.height,
    );
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.right = "auto";
    card.style.bottom = "auto";
    // Clear any centring transform so the px left/top above are exact and the
    // card doesn't jump by half its width on the first drag move.
    card.style.transform = "none";
    wasDragged = true;
  };

  card.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    // Never start a drag from a touch — a touch on the legend must fall through
    // to the map so panning/pinching keeps working over it. Dragging the legend
    // is a mouse/pen affordance only.
    if (event.pointerType === "touch") return;
    const rect = card.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    card.classList.add("is-dragging");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  });

  // Reset inline drag position on resize/orientation change so CSS media queries take over
  window.addEventListener("resize", resetPosition);
  window.addEventListener("orientationchange", resetPosition);
}
