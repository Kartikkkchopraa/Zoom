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
