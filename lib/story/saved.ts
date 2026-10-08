/**
 * The last data the admin app loaded, kept on this device so the app opens
 * instantly and refreshes in the background. Storage can be missing or full
 * (private mode, quota): every call fails quietly and the app simply waits for
 * the server as before.
 */
const PREFIX = "myithri_saved_";

export function readSaved<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSaved(name: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(value));
  } catch {
    /* not saved: the next open waits for the server */
  }
}
