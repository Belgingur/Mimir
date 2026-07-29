import { describe, it, expect, beforeEach } from "vitest";
import { TimelineController } from "../src/controllers/TimelineController";

function makeController() {
  const mapWrap = document.createElement("div");
  const deps = {
    dom: { mapWrap },
    isDev: false,
    schedulePersistState: () => {},
    scheduleUpdateLayers: () => {},
    setStatus: () => {},
    updateLayers: () => {},
    getInhouseLayers: () => [],
    syncInhouseTimeToTimeline: () => {},
    loadInhouseFrameSet: async () => {},
    isWavegramOpen: () => false,
    renderGridLabels: () => {},
    getGridStepForZoom: () => 1,
    isGridVisible: () => false,
    createTimelineControl: () => ({}),
    offsetDatetimeRange: (iso: string) => [iso, iso] as [string, string],
  } as unknown as ConstructorParameters<typeof TimelineController>[0];
  return new TimelineController(deps);
}

describe("map time bubble", () => {
  let controller: TimelineController;
  let host: HTMLDivElement;
  let bubbleEl: HTMLDivElement;
  let textEl: HTMLSpanElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    controller = makeController();
    host = document.createElement("div");
    host.id = "timeline-control";
    document.body.appendChild(host);

    bubbleEl = document.createElement("div");
    bubbleEl.className = "map-time-bubble control forecast-only";
    bubbleEl.hidden = true;
    textEl = document.createElement("span");
    textEl.className = "map-time-bubble__text";
    bubbleEl.appendChild(textEl);
    document.body.appendChild(bubbleEl);
  });

  it("unhides and fills the bubble once a timeline is rendered", () => {
    controller.activeTimelineDatetimes = [
      "2026-07-22T00:00:00Z",
      "2026-07-22T03:00:00Z",
      "2026-07-22T06:00:00Z",
    ];
    controller.currentDatetime = "2026-07-22T03:00:00Z";

    // Build the timeline shell (sets timelineBubbleTextEl etc.)
    controller.ensureCustomTimeline(host);
    // Wire the map bubble as controllerFactory does.
    controller.setMapTimeBubble(bubbleEl, textEl);

    expect(bubbleEl.hidden).toBe(false);
    expect(textEl.textContent).not.toBe("");
  });

  it("stays hidden while there is no timeline data", () => {
    controller.activeTimelineDatetimes = [];
    controller.ensureCustomTimeline(host);
    controller.setMapTimeBubble(bubbleEl, textEl);
    expect(bubbleEl.hidden).toBe(true);
  });
});
