import { buildSpreadWavegramUrl } from "../lib/wavegramUrl";
import { t } from "../lib/i18n";

export interface WavegramDomRefs {
  readonly modal: HTMLDivElement;
  readonly close: HTMLButtonElement;
  readonly subtitle: HTMLDivElement;
  readonly status: HTMLDivElement;
  readonly durationSelect: HTMLSelectElement;
  readonly techToggle: HTMLInputElement;
  readonly image: HTMLImageElement;
  readonly download: HTMLButtonElement;
  readonly print: HTMLButtonElement;
}

export interface WavegramControllerDeps {
  readonly dom: WavegramDomRefs;
  readonly getBaseUrl: () => string;
  readonly isDev: boolean;
  readonly scheduleUpdateLayers: () => void;
}

export class WavegramController {
  private requestId = 0;
  private coord: [number, number] | null = null;
  private duration = 120;
  private loading = false;
  private error: string | null = null;
  private url = "";

  private readonly boundOnEscape: (event: KeyboardEvent) => void;
  private readonly boundOnModalClick: (event: MouseEvent) => void;
  private readonly boundOnCloseClick: () => void;
  private readonly boundOnDurationChange: () => void;
  private readonly boundOnTechToggleChange: () => void;
  private readonly boundOnDownloadClick: () => void;
  private readonly boundOnPrintClick: () => void;

  constructor(private readonly deps: WavegramControllerDeps) {
    const { dom } = deps;

    this.boundOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dom.modal.classList.contains("is-open")) {
        this.close();
      }
    };
    this.boundOnModalClick = (event: MouseEvent) => {
      if (event.target === dom.modal) {
        this.close();
      }
    };
    this.boundOnCloseClick = () => this.close();
    this.boundOnDurationChange = () => {
      if (!this.coord) return;
      this.duration = Number(dom.durationSelect.value) || this.duration;
      this.open(this.coord);
    };
    this.boundOnTechToggleChange = () => {
      if (!this.coord) return;
      this.open(this.coord);
    };
    this.boundOnDownloadClick = () => {
      void this.download();
    };
    this.boundOnPrintClick = () => {
      void this.print();
    };

    dom.close.addEventListener("click", this.boundOnCloseClick);
    dom.modal.addEventListener("click", this.boundOnModalClick);
    dom.durationSelect.addEventListener("change", this.boundOnDurationChange);
    dom.techToggle.addEventListener("change", this.boundOnTechToggleChange);
    dom.download.addEventListener("click", this.boundOnDownloadClick);
    dom.print.addEventListener("click", this.boundOnPrintClick);
    window.addEventListener("keydown", this.boundOnEscape);
  }

  get isOpen(): boolean {
    return this.deps.dom.modal.classList.contains("is-open");
  }

  get isLoading(): boolean {
    return this.loading;
  }

  get activeCoord(): [number, number] | null {
    return this.coord;
  }

  open(coord: [number, number]): void {
    const { dom, getBaseUrl, isDev, scheduleUpdateLayers } = this.deps;

    this.coord = coord;
    const [lon, lat] = coord;
    this.duration = Number(dom.durationSelect.value) || this.duration;
    dom.subtitle.textContent = t("wavegram.subtitle", {
      lat: lat.toFixed(3),
      lon: lon.toFixed(3),
      duration: String(this.duration),
    });
    dom.image.src = "";
    dom.download.disabled = true;
    dom.print.disabled = true;
    dom.modal.classList.add("is-open");
    dom.modal.setAttribute("aria-hidden", "false");

    const baseUrl = getBaseUrl().trim();
    if (!baseUrl) {
      this.url = "";
      this.requestId += 1;
      this.loading = false;
      this.error = t("wavegram.unconfigured");
      dom.status.textContent = this.error;
      scheduleUpdateLayers();
      return;
    }

    const include = dom.techToggle?.checked ? ["now", "tech"] : ["now"];
    const url = buildSpreadWavegramUrl({
      baseUrl,
      lat,
      lon,
      duration: this.duration,
      include,
    });
    this.url = url;
    if (isDev) {
      console.debug("Opening wavegram for model GWES");
      console.debug("wavegram url", url);
    }
    this.requestId += 1;
    const reqId = this.requestId;
    this.loading = true;
    this.error = null;
    scheduleUpdateLayers();
    dom.status.textContent = t("status.loadingWavegram");
    dom.image.onload = () => {
      if (reqId !== this.requestId) return;
      this.loading = false;
      dom.status.textContent = "";
      dom.download.disabled = false;
      dom.print.disabled = false;
      scheduleUpdateLayers();
    };
    dom.image.onerror = () => {
      if (reqId !== this.requestId) return;
      this.loading = false;
      this.error = t("wavegram.failed");
      dom.status.textContent = `${this.error} ${url}`;
      dom.download.disabled = false;
      dom.print.disabled = false;
      scheduleUpdateLayers();
    };
    dom.image.src = url;
  }

  close(): void {
    const { dom, scheduleUpdateLayers } = this.deps;

    dom.modal.classList.remove("is-open");
    dom.modal.setAttribute("aria-hidden", "true");
    this.loading = false;
    this.error = null;
    this.coord = null;
    this.url = "";
    dom.download.disabled = true;
    dom.print.disabled = true;
    scheduleUpdateLayers();
  }

  async download(): Promise<void> {
    const { dom } = this.deps;

    if (!this.url || !this.coord) return;
    const [lon, lat] = this.coord;
    const duration = this.duration;
    const filename = `spread_wavegram_gwes_${lat.toFixed(3)}_${lon.toFixed(3)}_${duration}h.png`;
    try {
      const response = await fetch(this.url, { mode: "cors" });
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dom.status.textContent = t("wavegram.downloadError", { message });
      window.open(this.url, "_blank", "noopener");
    }
  }

  async print(): Promise<void> {
    if (!this.url || !this.coord) return;
    const [lon, lat] = this.coord;
    const caption = t("wavegram.subtitle", {
      lat: lat.toFixed(3),
      lon: lon.toFixed(3),
      duration: String(this.duration),
    });
    const win = window.open("", "_blank");
    if (!win) return;

    const doc = win.document;
    doc.open();
    doc.write("<!doctype html><html><head></head><body></body></html>");
    doc.close();

    doc.title = t("wavegram.printTitle");
    const style = doc.createElement("style");
    style.textContent =
      "@page { margin: 10mm; } body { font-family: Arial, sans-serif; margin: 0; padding: 10mm; } .actions { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; } .actions button { appearance: none; border: 1px solid #999; background: #fff; border-radius: 6px; padding: 8px 14px; font: inherit; cursor: pointer; } .actions button:disabled { opacity: 0.5; cursor: default; } .actions .hint { font-size: 12px; color: #555; } img { width: 100%; height: auto; display: block; } .caption { font-size: 12px; margin-bottom: 8px; } .status { font-size: 12px; color: #555; margin-bottom: 10px; } .error { font-size: 12px; color: #900; } @media print { .actions { display: none; } body { padding: 0; } .status { display: none; } }";
    doc.head.appendChild(style);

    const actions = doc.createElement("div");
    actions.className = "actions";
    const printButton = doc.createElement("button");
    printButton.type = "button";
    printButton.textContent = t("wavegram.printTitle");
    printButton.disabled = true;
    printButton.addEventListener("click", () => {
      win.focus();
      win.print();
    });
    const hint = doc.createElement("div");
    hint.className = "hint";
    hint.textContent = "Use this button or your browser print shortcut.";
    actions.appendChild(printButton);
    actions.appendChild(hint);

    const captionDiv = doc.createElement("div");
    captionDiv.className = "caption";
    captionDiv.textContent = caption;
    const statusDiv = doc.createElement("div");
    statusDiv.className = "status";
    statusDiv.textContent = t("status.loadingWavegram");
    const img = doc.createElement("img");
    img.alt = caption;
    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
    img.addEventListener(
      "error",
      () => {
        statusDiv.textContent = t("wavegram.failed");
        statusDiv.className = "status error";
        cleanup();
      },
      { once: true },
    );
    img.addEventListener(
      "load",
      () => {
        statusDiv.textContent = "";
        printButton.disabled = false;
      },
      { once: true },
    );
    win.addEventListener("afterprint", cleanup, { once: true });

    doc.body.appendChild(actions);
    doc.body.appendChild(captionDiv);
    doc.body.appendChild(statusDiv);
    doc.body.appendChild(img);
    win.focus();

    let objectUrl: string | null = null;
    try {
      const response = await fetch(this.url, { mode: "cors" });
      if (!response.ok)
        throw new Error(`Print fetch failed (${response.status})`);
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
    } catch {
      img.src = this.url;
    }
  }

  destroy(): void {
    const { dom } = this.deps;
    dom.close.removeEventListener("click", this.boundOnCloseClick);
    dom.modal.removeEventListener("click", this.boundOnModalClick);
    dom.durationSelect.removeEventListener(
      "change",
      this.boundOnDurationChange,
    );
    dom.techToggle.removeEventListener("change", this.boundOnTechToggleChange);
    dom.download.removeEventListener("click", this.boundOnDownloadClick);
    dom.print.removeEventListener("click", this.boundOnPrintClick);
    window.removeEventListener("keydown", this.boundOnEscape);
  }
}
