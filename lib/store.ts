// localStorage for per-device conveniences only (never game state). Never throws:
// private mode and blocked storage just behave like an empty store.

const PREFIX = "the90.";

export const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) window.localStorage.removeItem(PREFIX + key);
      else window.localStorage.setItem(PREFIX + key, value);
    } catch {
      /* ignore */
    }
  },
};
