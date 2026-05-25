export interface ModelChooserDomRefs {
  readonly barEl: HTMLDivElement | null;
  readonly panelEl: HTMLDivElement | null;
  readonly pillBtn: HTMLButtonElement | null;
  readonly popoverEl: HTMLDivElement | null;
  readonly pillNameEl: HTMLSpanElement | null;
  readonly pillMetaEl: HTMLSpanElement | null;
}

export interface ModelChooserControllerDeps {
  readonly dom: ModelChooserDomRefs;
  readonly getViewMode: () => string;
  readonly getModels: () => string[];
  readonly getSelectedModel: () => string;
  readonly getModelResolutionMeters: (model: string) => number | null;
  readonly onModelSelect: (model: string) => void;
  readonly isDev?: boolean;
}

export class ModelChooserController {
  private static readonly MIN_READY_WIDTH_PX = 80;

  private expanded = false;
  private _lastNonWavesModel = "";
  private _lastNonWavesAnalysis = "";
  private debugListenersAttached = false;
  private renderVersion = 0;
  private revealFrameId: number | null = null;

  constructor(private readonly deps: ModelChooserControllerDeps) {}

  get isExpanded(): boolean {
    return this.expanded;
  }
  get lastNonWavesModel(): string {
    return this._lastNonWavesModel;
  }
  get lastNonWavesAnalysis(): string {
    return this._lastNonWavesAnalysis;
  }

  saveNonWavesSelection(model: string, analysis: string): void {
    this._lastNonWavesModel = model;
    this._lastNonWavesAnalysis = analysis;
  }

  restoreNonWavesSelection(): { model: string; analysis: string } | null {
    if (!this._lastNonWavesModel) return null;
    return {
      model: this._lastNonWavesModel,
      analysis: this._lastNonWavesAnalysis,
    };
  }

  formatResolutionLabel(model: string): string {
    const resolutionMeters = this.deps.getModelResolutionMeters(model);
    if (!resolutionMeters) return "";
    if (resolutionMeters >= 1000) {
      const km = resolutionMeters / 1000;
      return `${parseFloat(km.toFixed(2))}km`;
    }
    return `${resolutionMeters}m`;
  }

  getCollapsedSlots(): { visible: string[]; remaining: number } {
    const models = this.deps.getModels().slice();
    if (!models.length) return { visible: [], remaining: 0 };
    const selectedModel = this.deps.getSelectedModel();
    const visible: string[] = [];
    if (selectedModel && models.includes(selectedModel)) {
      visible.push(selectedModel);
    }
    for (const model of models) {
      if (visible.includes(model)) continue;
      visible.push(model);
      if (visible.length >= 3) break;
    }
    return { visible, remaining: Math.max(0, models.length - visible.length) };
  }

  selectModel(model: string): void {
    const selectedModel = this.deps.getSelectedModel();
    if (!model || model === selectedModel) {
      this.expanded = false;
      this.render();
      return;
    }
    this.deps.onModelSelect(model);
    this.expanded = false;
    this.render();
  }

  render(): void {
    const { dom, getViewMode, getModels, getSelectedModel } = this.deps;
    if (!dom.barEl || !dom.panelEl) return;
    const modelCard = dom.barEl.closest(".model-card") as HTMLElement | null;
    const models = getModels();
    const selectedModel = getSelectedModel();
    const show =
      (getViewMode() === "forecast" || getViewMode() === "iconography") &&
      models.length > 0;
    const renderVersion = ++this.renderVersion;
    this.cancelPendingReveal();
    if (!show) {
      if (modelCard) {
        this.setCardStaged(modelCard, false);
        modelCard.hidden = true;
      }
      dom.barEl.innerHTML = "";
      dom.panelEl.innerHTML = "";
      dom.panelEl.hidden = true;
      return;
    }
    if (modelCard) {
      this.attachDebugListeners(modelCard);
      this.setCardStaged(modelCard, true);
      modelCard.hidden = false;
    }

    const { visible, remaining } = this.getCollapsedSlots();
    dom.barEl.innerHTML = "";
    visible.forEach((model) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `model-slot${model === selectedModel ? " model-slot--active" : ""}`;
      const resolution = this.formatResolutionLabel(model);
      button.innerHTML = `<span class="model-slot__name">${model}</span>${resolution ? `<span class="model-slot__meta">${resolution}</span>` : ""}`;
      button.addEventListener("click", () => this.selectModel(model));
      dom.barEl!.appendChild(button);
    });
    if (remaining > 0) {
      const moreButton = document.createElement("button");
      moreButton.type = "button";
      moreButton.className = "model-slot model-slot--more";
      moreButton.innerHTML = `<span class="model-slot__name">${remaining} more…</span>`;
      moreButton.addEventListener("click", () => {
        this.expanded = !this.expanded;
        this.render();
      });
      dom.barEl!.appendChild(moreButton);
    }

    dom.panelEl.innerHTML = "";
    models.forEach((model) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `model-slot${model === selectedModel ? " model-slot--active" : ""}`;
      const resolution = this.formatResolutionLabel(model);
      button.innerHTML = `<span class="model-slot__name">${model}</span>${resolution ? `<span class="model-slot__meta">${resolution}</span>` : ""}`;
      button.addEventListener("click", () => this.selectModel(model));
      dom.panelEl!.appendChild(button);
    });
    dom.panelEl.hidden = !this.expanded;
    this.scheduleReveal(modelCard, renderVersion);
  }

  syncPill(): void {
    const { pillBtn, popoverEl, pillNameEl, pillMetaEl } = this.deps.dom;
    if (!pillBtn || !popoverEl || !pillNameEl || !pillMetaEl) return;
    const models = this.deps.getModels();
    const selected = this.deps.getSelectedModel();
    const resolution = this.formatResolutionLabel(selected);

    pillNameEl.textContent = selected || "";
    pillMetaEl.textContent = resolution;

    popoverEl.innerHTML = "";
    for (const model of models) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `model-popover__item${model === selected ? " is-active" : ""}`;
      btn.dataset.model = model;
      const res = this.formatResolutionLabel(model);
      btn.dataset.modelMeta = res;
      btn.innerHTML = `<span>${model}</span>${res ? `<span class="model-popover__meta">${res}</span>` : ""}`;
      popoverEl.appendChild(btn);
    }
  }

  initPill(): void {
    const { pillBtn, popoverEl, pillNameEl, pillMetaEl } = this.deps.dom;
    if (!pillBtn || !popoverEl) return;

    pillBtn.addEventListener("click", () => {
      const isOpen = popoverEl.classList.toggle("is-open");
      pillBtn.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("pointerdown", (e) => {
      if (!popoverEl.classList.contains("is-open")) return;
      const wrap = pillBtn.closest(".model-pill-wrap");
      if (!wrap?.contains(e.target as Node)) {
        popoverEl.classList.remove("is-open");
        pillBtn.setAttribute("aria-expanded", "false");
      }
    });

    popoverEl.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(
        ".model-popover__item",
      ) as HTMLElement | null;
      if (!item) return;

      popoverEl
        .querySelectorAll(".model-popover__item")
        .forEach((i) => i.classList.remove("is-active"));
      item.classList.add("is-active");

      const name = item.dataset.model ?? "";
      const meta = item.dataset.modelMeta ?? "";
      if (pillNameEl) pillNameEl.textContent = name;
      if (pillMetaEl) pillMetaEl.textContent = meta;

      setTimeout(() => {
        popoverEl.classList.remove("is-open");
        pillBtn.setAttribute("aria-expanded", "false");
      }, 200);

      this.deps.onModelSelect(name);
    });
  }

  handleOutsideClick(target: Node): void {
    const { dom } = this.deps;
    if (!this.expanded || !dom.panelEl || !dom.barEl) return;
    if (dom.panelEl.contains(target) || dom.barEl.contains(target)) return;
    this.expanded = false;
    this.render();
  }

  handleEscapeKey(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !this.expanded) return;
    this.expanded = false;
    this.render();
  }

  destroy(): void {
    this.expanded = false;
    this.cancelPendingReveal();
  }

  private cancelPendingReveal(): void {
    if (this.revealFrameId === null) return;
    cancelAnimationFrame(this.revealFrameId);
    this.revealFrameId = null;
  }

  private scheduleReveal(
    modelCard: HTMLElement | null,
    renderVersion: number,
  ): void {
    if (!modelCard) return;
    const revealWhenReady = () => {
      if (renderVersion !== this.renderVersion || modelCard.hidden) {
        this.revealFrameId = null;
        return;
      }
      if (
        this.getVisibleWidth(modelCard) <
        ModelChooserController.MIN_READY_WIDTH_PX
      ) {
        this.revealFrameId = requestAnimationFrame(revealWhenReady);
        return;
      }
      this.revealFrameId = requestAnimationFrame(() => {
        this.revealFrameId = null;
        if (renderVersion !== this.renderVersion || modelCard.hidden) return;
        if (
          this.getVisibleWidth(modelCard) <
          ModelChooserController.MIN_READY_WIDTH_PX
        ) {
          this.scheduleReveal(modelCard, renderVersion);
          return;
        }
        this.setCardStaged(modelCard, false);
        this.logVisibleRect(modelCard, "render");
      });
    };
    this.revealFrameId = requestAnimationFrame(revealWhenReady);
  }

  private getVisibleWidth(modelCard: HTMLElement): number {
    const barWidth = this.deps.dom.barEl?.getBoundingClientRect().width ?? 0;
    const cardWidth = modelCard.getBoundingClientRect().width;
    return Math.max(barWidth, cardWidth);
  }

  private setCardStaged(modelCard: HTMLElement, staged: boolean): void {
    if (staged) {
      modelCard.dataset.renderState = "staging";
      modelCard.style.visibility = "hidden";
      modelCard.style.opacity = "0";
      modelCard.style.pointerEvents = "none";
      return;
    }
    delete modelCard.dataset.renderState;
    modelCard.style.visibility = "";
    modelCard.style.opacity = "";
    modelCard.style.pointerEvents = "";
  }

  private attachDebugListeners(modelCard: HTMLElement): void {
    if (!this.deps.isDev || this.debugListenersAttached) return;
    this.debugListenersAttached = true;
    modelCard.addEventListener("pointerenter", () =>
      this.logVisibleRect(modelCard, "pointerenter"),
    );
    modelCard.addEventListener("click", () =>
      this.logVisibleRect(modelCard, "click"),
    );
  }

  private logVisibleRect(modelCard: HTMLElement | null, reason: string): void {
    if (!this.deps.isDev || !modelCard || modelCard.hidden) return;
    requestAnimationFrame(() => {
      if (modelCard.hidden) return;
      const rect = modelCard.getBoundingClientRect();
      const style = window.getComputedStyle(modelCard);
      const isActuallyVisible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0";
      console.debug("[model-card]", reason, {
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        },
        computed: {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          pointerEventsEnabled: style.pointerEvents !== "none",
          isActuallyVisible,
        },
      });
    });
  }
}
