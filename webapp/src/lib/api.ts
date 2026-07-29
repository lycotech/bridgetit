const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "";

/**
 * CSRF token plumbing.
 *
 * WHY: this client sends `credentials: "include"`, so the browser attaches our
 * session cookie to every same-origin request — including one triggered by a
 * hostile page. The server (backend/src/security/csrf.ts) pins the Origin AND
 * requires the value of the non-HttpOnly `pb_csrf` cookie to be echoed back in
 * the X-CSRF-Token header. A cross-site attacker can make the browser SEND our
 * cookies but cannot READ them (same-origin policy), so it cannot produce the
 * matching header. Reading the cookie here and echoing it is the client half of
 * that contract.
 *
 * WHY only on unsafe methods: GET/HEAD must stay side-effect free, so they need
 * no token; adding one would only widen where the value is exposed.
 */
function csrfToken(): string | null {
  const name = document.cookie.includes("__Host-pb_csrf=") ? "__Host-pb_csrf" : "pb_csrf";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

// Response envelope type - all app routes return { data: T }
interface ApiResponse<T> {
  data: T;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  /*
   * WHY endpoints are constrained to a relative path: `api.get(userSuppliedUrl)`
   * with an absolute URL would send our credentials to an arbitrary host — a
   * client-side SSRF/credential-leak primitive. Every call site in this app
   * passes a literal "/api/..." string, and this guard makes that a rule rather
   * than a habit.
   */
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) {
    throw new ApiError("Refusing to call a non-relative endpoint", 0);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method ?? "GET").toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Marks the request as programmatic. A cross-site HTML form cannot set a
    // custom header, so its presence is corroborating (not primary) evidence.
    "X-Requested-With": "XMLHttpRequest",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (UNSAFE_METHODS.has(method)) {
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include",
    // WHY explicit: "same-origin" would drop the redirect silently; "follow" to
    // an attacker-chosen host would forward credentials. Refusing to follow
    // redirects at all means a compromised or misconfigured endpoint cannot
    // bounce an authenticated request somewhere else.
    redirect: "error",
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new ApiError(
      // Try app-route format first, fallback to generic message (Better Auth uses this)
      json?.error?.message || json?.message || `Request failed with status ${response.status}`,
      response.status,
      json?.error || json
    );
  }

  // 1. Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // 2. JSON responses: parse and unwrap { data }
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const json: ApiResponse<T> = await response.json();
    return json.data;
  }

  // 3. Non-JSON: return undefined (caller should use api.raw() for these)
  return undefined as T;
}

// Raw request for non-JSON endpoints (uploads, downloads, streams)
async function rawRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) {
    throw new ApiError("Refusing to call a non-relative endpoint", 0);
  }
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (UNSAFE_METHODS.has(method)) {
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
  }
  const config: RequestInit = { ...options, headers, credentials: "include", redirect: "error" };
  return fetch(url, config);
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  // Escape hatch for non-JSON endpoints
  raw: rawRequest,
};

// Sample endpoint types (extend as needed)
export interface SampleResponse {
  message: string;
  timestamp: string;
}

// Sample API functions
export const sampleApi = {
  getSample: () => api.get<SampleResponse>("/api/sample"),
};

export { ApiError };
