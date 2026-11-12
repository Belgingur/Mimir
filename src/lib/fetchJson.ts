/**
 * How long a JSON request may take, from the call to the parsed body, before
 * it is given up. The catalog's files are small, so a request that takes this
 * long has stalled. See the pull request that added it for the measurements.
 */
export const JSON_TIMEOUT_MS = 30_000;

/**
 * fetch() a JSON document, and reject if it hasn't arrived within `timeoutMs`.
 *
 * A fetch has no timeout of its own: a request the server never answers stays
 * pending for good, and whatever awaits it never continues. This one is
 * aborted and rejects with an Error that says so.
 *
 * Rejects for a response that isn't ok too, as the catalog's loaders expect.
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit,
  timeoutMs: number = JSON_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  // A caller's own signal still cancels the request.
  const outer = init?.signal;
  const abortFromOuter = () => controller.abort(outer?.reason);
  if (outer?.aborted) abortFromOuter();
  else outer?.addEventListener("abort", abortFromOuter, { once: true });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to load ${url} (${response.status})`);
    }
    // The body counts too: headers can arrive and the rest never follow.
    return (await response.json()) as T;
  } catch (error) {
    if (timedOut) {
      throw new Error(`Timed out after ${timeoutMs / 1000} s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", abortFromOuter);
  }
}
