import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

// jsdom 26 does not expose a spec-compliant Storage implementation (.clear and .key are missing).
// Provide a full in-memory localStorage so all tests get a consistent, working API.
let _store: Record<string, string> = {};

const localStorageMock = {
  get length() {
    return Object.keys(_store).length;
  },
  key(i: number): string | null {
    return Object.keys(_store)[i] ?? null;
  },
  getItem(k: string): string | null {
    return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null;
  },
  setItem(k: string, v: string): void {
    _store[k] = String(v);
  },
  removeItem(k: string): void {
    delete _store[k];
  },
  clear(): void {
    _store = {};
  },
};

vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  _store = {};
});
