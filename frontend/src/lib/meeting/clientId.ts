/** A random id for this browser, so a host's "Remove" applies if the person rejoins. */
export function clientId(): string {
  const key = "zoom-client-id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // storage blocked: still works, just not sticky
  }
}

/**
 * A random id for this browser tab. sessionStorage is per tab and survives a
 * refresh, so the server can tell "same tab reconnecting" from "another tab".
 */
export function tabId(): string {
  const key = "zoom-tab-id";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
