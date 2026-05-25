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
    wasDragged = true;
  };

  card.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
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
