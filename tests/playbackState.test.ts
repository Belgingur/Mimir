import { describe, it, expect } from "vitest";
import {
  reducePlaybackState,
  type PlaybackMachineState,
} from "../src/lib/playbackState";

const idle: PlaybackMachineState = {
  status: "idle",
  currentIndex: 0,
  framePending: false,
  shouldPause: false,
};

describe("reducePlaybackState", () => {
  describe("START", () => {
    it("transitions from idle to playing", () => {
      const result = reducePlaybackState(idle, { type: "START" });
      expect(result.status).toBe("playing");
      expect(result.framePending).toBe(false);
      expect(result.shouldPause).toBe(false);
    });

    it("sets index from event when provided", () => {
      const result = reducePlaybackState(idle, { type: "START", index: 5 });
      expect(result.currentIndex).toBe(5);
    });

    it("keeps current index when event index is undefined", () => {
      const state: PlaybackMachineState = { ...idle, currentIndex: 3 };
      const result = reducePlaybackState(state, { type: "START" });
      expect(result.currentIndex).toBe(3);
    });

    it("resets shouldPause on start", () => {
      const paused: PlaybackMachineState = {
        ...idle,
        status: "paused",
        shouldPause: true,
      };
      const result = reducePlaybackState(paused, { type: "START" });
      expect(result.shouldPause).toBe(false);
      expect(result.status).toBe("playing");
    });
  });

  describe("REQUEST_FRAME", () => {
    it("transitions from playing to waitingForFrame", () => {
      const playing: PlaybackMachineState = { ...idle, status: "playing" };
      const result = reducePlaybackState(playing, {
        type: "REQUEST_FRAME",
        index: 1,
      });
      expect(result.status).toBe("waitingForFrame");
      expect(result.currentIndex).toBe(1);
      expect(result.framePending).toBe(true);
    });

    it("ignores duplicate request while frame is pending", () => {
      const waiting: PlaybackMachineState = {
        status: "waitingForFrame",
        currentIndex: 1,
        framePending: true,
        shouldPause: false,
      };
      const result = reducePlaybackState(waiting, {
        type: "REQUEST_FRAME",
        index: 2,
      });
      expect(result).toBe(waiting);
      expect(result.currentIndex).toBe(1);
    });
  });

  describe("FRAME_RESOLVED", () => {
    it("returns to playing when shouldPause is false", () => {
      const waiting: PlaybackMachineState = {
        status: "waitingForFrame",
        currentIndex: 1,
        framePending: true,
        shouldPause: false,
      };
      const result = reducePlaybackState(waiting, { type: "FRAME_RESOLVED" });
      expect(result.status).toBe("playing");
      expect(result.framePending).toBe(false);
    });

    it("transitions to paused when shouldPause is true", () => {
      const waiting: PlaybackMachineState = {
        status: "waitingForFrame",
        currentIndex: 1,
        framePending: true,
        shouldPause: true,
      };
      const result = reducePlaybackState(waiting, { type: "FRAME_RESOLVED" });
      expect(result.status).toBe("paused");
      expect(result.framePending).toBe(false);
    });
  });

  describe("FRAME_FAILED", () => {
    it("transitions to error and sets shouldPause", () => {
      const waiting: PlaybackMachineState = {
        status: "waitingForFrame",
        currentIndex: 2,
        framePending: true,
        shouldPause: false,
      };
      const result = reducePlaybackState(waiting, { type: "FRAME_FAILED" });
      expect(result.status).toBe("error");
      expect(result.framePending).toBe(false);
      expect(result.shouldPause).toBe(true);
    });
  });

  describe("PAUSE", () => {
    it("transitions playing to paused immediately", () => {
      const playing: PlaybackMachineState = {
        status: "playing",
        currentIndex: 0,
        framePending: false,
        shouldPause: false,
      };
      const result = reducePlaybackState(playing, { type: "PAUSE" });
      expect(result.status).toBe("paused");
      expect(result.shouldPause).toBe(true);
    });

    it("stays in waitingForFrame when frame is pending but marks shouldPause", () => {
      const waiting: PlaybackMachineState = {
        status: "waitingForFrame",
        currentIndex: 1,
        framePending: true,
        shouldPause: false,
      };
      const result = reducePlaybackState(waiting, { type: "PAUSE" });
      expect(result.status).toBe("waitingForFrame");
      expect(result.shouldPause).toBe(true);
    });
  });

  describe("STOP", () => {
    it("transitions any state to idle", () => {
      const playing: PlaybackMachineState = {
        status: "playing",
        currentIndex: 5,
        framePending: false,
        shouldPause: false,
      };
      const result = reducePlaybackState(playing, { type: "STOP" });
      expect(result.status).toBe("idle");
      expect(result.framePending).toBe(false);
      expect(result.shouldPause).toBe(false);
    });

    it("clears framePending on stop from waitingForFrame", () => {
      const waiting: PlaybackMachineState = {
        status: "waitingForFrame",
        currentIndex: 2,
        framePending: true,
        shouldPause: true,
      };
      const result = reducePlaybackState(waiting, { type: "STOP" });
      expect(result.status).toBe("idle");
      expect(result.framePending).toBe(false);
      expect(result.shouldPause).toBe(false);
    });
  });
});
