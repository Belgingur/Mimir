import { describe, expect, it, vi } from "vitest";
import { createUserLocationWatch } from "../src/lib/userLocationWatch";

/** A Geolocation stub whose watch callbacks the test drives by hand. */
function fakeGeolocation() {
  let success: PositionCallback | null = null;
  let failure: PositionErrorCallback | null = null;
  const geolocation = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn((s: PositionCallback, e?: PositionErrorCallback) => {
      success = s;
      failure = e ?? null;
      return 7;
    }),
    clearWatch: vi.fn(),
  };
  return {
    geolocation: geolocation as unknown as Geolocation,
    getCurrentPosition: geolocation.getCurrentPosition,
    watchPosition: geolocation.watchPosition,
    clearWatch: geolocation.clearWatch,
    move: (latitude: number, longitude: number) =>
      success?.({ coords: { latitude, longitude }, timestamp: 0 } as GeolocationPosition),
    fail: (code: number) =>
      failure?.({ code, message: "" } as GeolocationPositionError),
  };
}

/** A Permissions stub holding one geolocation state the test can change. */
function fakePermissions(initial: PermissionState) {
  const status = Object.assign(new EventTarget(), { state: initial });
  return {
    permissions: {
      query: vi.fn(async () => status as unknown as PermissionStatus),
    } as unknown as Permissions,
    change: (state: PermissionState) => {
      status.state = state;
      status.dispatchEvent(new Event("change"));
    },
  };
}

describe("createUserLocationWatch", () => {
  it("reports every position once started, and watches only once", () => {
    const geo = fakeGeolocation();
    const onFix = vi.fn();
    const watch = createUserLocationWatch({
      geolocation: geo.geolocation,
      permissions: null,
      onFix,
      onLost: vi.fn(),
    });
    watch.start();
    watch.start();
    geo.move(64.1, -21.9);
    geo.move(64.2, -21.8);
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    expect(onFix).toHaveBeenNthCalledWith(1, { lat: 64.1, lon: -21.9 });
    expect(onFix).toHaveBeenNthCalledWith(2, { lat: 64.2, lon: -21.8 });
  });

  it("keeps the dot through a lost signal but drops it when denied", () => {
    const geo = fakeGeolocation();
    const onLost = vi.fn();
    const watch = createUserLocationWatch({
      geolocation: geo.geolocation,
      permissions: null,
      onFix: vi.fn(),
      onLost,
    });
    watch.start();
    geo.fail(2); // POSITION_UNAVAILABLE
    expect(onLost).not.toHaveBeenCalled();
    expect(geo.clearWatch).not.toHaveBeenCalled();
    geo.fail(1); // PERMISSION_DENIED
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
  });

  it("resumes without asking when the permission is already granted", async () => {
    const geo = fakeGeolocation();
    const perms = fakePermissions("granted");
    const watch = createUserLocationWatch({
      geolocation: geo.geolocation,
      permissions: perms.permissions,
      onFix: vi.fn(),
      onLost: vi.fn(),
    });
    await watch.resumeIfGranted();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("never touches the Geolocation API while the permission is undecided", async () => {
    const geo = fakeGeolocation();
    const watch = createUserLocationWatch({
      geolocation: geo.geolocation,
      permissions: fakePermissions("prompt").permissions,
      onFix: vi.fn(),
      onLost: vi.fn(),
    });
    await watch.resumeIfGranted();
    expect(geo.watchPosition).not.toHaveBeenCalled();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("follows the permission: starts when granted, stops when revoked", async () => {
    const geo = fakeGeolocation();
    const perms = fakePermissions("prompt");
    const onLost = vi.fn();
    const watch = createUserLocationWatch({
      geolocation: geo.geolocation,
      permissions: perms.permissions,
      onFix: vi.fn(),
      onLost,
    });
    await watch.resumeIfGranted();
    perms.change("granted");
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    perms.change("denied");
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the browser cannot query the permission", async () => {
    const geo = fakeGeolocation();
    const watch = createUserLocationWatch({
      geolocation: geo.geolocation,
      permissions: {
        query: () => Promise.reject(new TypeError("unsupported")),
      } as unknown as Permissions,
      onFix: vi.fn(),
      onLost: vi.fn(),
    });
    await expect(watch.resumeIfGranted()).resolves.toBeUndefined();
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });
});
