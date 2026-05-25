export type PlaybackStatus =
  | "idle"
  | "playing"
  | "waitingForFrame"
  | "paused"
  | "error";

export type PlaybackMachineState = {
  status: PlaybackStatus;
  currentIndex: number;
  framePending: boolean;
  shouldPause: boolean;
};

export type PlaybackEvent =
  | { type: "START"; index?: number }
  | { type: "REQUEST_FRAME"; index: number }
  | { type: "FRAME_RESOLVED" }
  | { type: "FRAME_FAILED" }
  | { type: "PAUSE" }
  | { type: "STOP" };

export const reducePlaybackState = (
  state: PlaybackMachineState,
  event: PlaybackEvent,
): PlaybackMachineState => {
  switch (event.type) {
    case "START":
      return {
        status: "playing",
        currentIndex: event.index ?? state.currentIndex,
        framePending: false,
        shouldPause: false,
      };
    case "REQUEST_FRAME":
      if (state.framePending) return state;
      return {
        ...state,
        status: "waitingForFrame",
        currentIndex: event.index,
        framePending: true,
      };
    case "FRAME_RESOLVED":
      return {
        ...state,
        status: state.shouldPause ? "paused" : "playing",
        framePending: false,
      };
    case "FRAME_FAILED":
      return {
        ...state,
        status: "error",
        framePending: false,
        shouldPause: true,
      };
    case "PAUSE":
      return {
        ...state,
        status: state.framePending ? "waitingForFrame" : "paused",
        shouldPause: true,
      };
    case "STOP":
      return {
        ...state,
        status: "idle",
        framePending: false,
        shouldPause: false,
      };
  }
};
