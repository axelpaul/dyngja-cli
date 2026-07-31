export const DEFAULT_API_URL = "https://dyngja.reynirf.com";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  auth?: boolean;
};

export class DyngjaApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, details: unknown) {
    super(`Dyngja API request failed with HTTP ${status}`);
    this.name = "DyngjaApiError";
    this.status = status;
    this.details = details;
  }
}

export class DyngjaApi {
  readonly baseUrl: string;
  readonly token?: string;

  constructor({ baseUrl = Bun.env.DYNGJA_API_URL ?? DEFAULT_API_URL, token = Bun.env.DYNGJA_TOKEN } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
  }

  async request<T>(path: string, { method = "GET", body, auth = true }: RequestOptions = {}): Promise<T> {
    const url = path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers({ Accept: "application/json" });

    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (auth) {
      if (!this.token) {
        throw new Error("This command needs DYNGJA_TOKEN. Run `dyngja auth login` first.");
      }
      headers.set("Authorization", `Token ${this.token}`);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    let data: unknown = null;

    if (raw.length > 0) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    if (!response.ok) {
      throw new DyngjaApiError(response.status, data);
    }

    return data as T;
  }

  appInfo() {
    return this.request("/api/v3/app-info/", { auth: false });
  }

  login(username: string, password: string) {
    return this.request<{ token: string }>("/auth/login/", {
      method: "POST",
      auth: false,
      body: { username, password },
    });
  }

  register({ email, password, name }: { email: string; password: string; name?: string }) {
    return this.request("/auth/register/", {
      method: "POST",
      auth: false,
      body: {
        type: "app",
        username: email,
        email,
        password,
        ...(name ? { name } : {}),
      },
    });
  }

  confirmAccount(email: string, code: string) {
    return this.request("/auth/confirm-account/", {
      method: "POST",
      auth: false,
      body: { email, code },
    });
  }

  resendConfirmation(email: string) {
    return this.request("/auth/re-send/", {
      method: "POST",
      auth: false,
      body: { email },
    });
  }

  profile() {
    return this.request("/api/v3/users/myself/");
  }

  transactions(query: URLSearchParams = new URLSearchParams()) {
    const suffix = query.toString();
    return this.request(`/api/v3/transactions/${suffix ? `?${suffix}` : ""}`);
  }

  rawGet(path: string) {
    return this.request(path, { method: "GET" });
  }
}
