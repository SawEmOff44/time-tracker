// lib/adminFetch.ts
export class AdminAuthError extends Error {
  constructor(message = "Admin session expired") {
    super(message);
    this.name = "AdminAuthError";
  }
}

/**
 * Wrapper for admin API calls.
 * - Sends cookies (`credentials: "include"`)
 * - Throws AdminAuthError on 401
 * - Throws Error on other non-OK responses
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, {
    credentials: "include",
    ...init,
  });

  if (res.status === 401) {
    throw new AdminAuthError();
  }

  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Admin API error (${res.status}): ${
        text || res.statusText || "Unknown error"
      }`
    );
  }

  return res;
}