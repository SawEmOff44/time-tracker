// app/admin/_utils/adminFetch.ts

export class AdminAuthError extends Error {
  constructor(message = "Admin session expired") {
    super(message);
    this.name = "AdminAuthError";
  }
}

/**
 * Small wrapper around fetch that:
 * - always sends cookies (credentials: "include")
 * - throws AdminAuthError on 401/403
 * - throws Error with a useful message on other non-OK responses
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(input, {
    credentials: "include",
    ...init,
  });

  // Auth / session problems
  if (res.status === 401 || res.status === 403) {
    throw new AdminAuthError();
  }

  // Other errors → try to surface a message
  if (!res.ok) {
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) {
        throw new Error(data.error);
      }
    } catch {
      // ignore JSON parse failure, fall through to generic message
    }
    throw new Error(`Request failed with status ${res.status}`);
  }

  return res;
}