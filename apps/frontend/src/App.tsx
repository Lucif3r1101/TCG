import { FormEvent, useEffect, useMemo, useState } from "react";

type AuthMode = "register" | "login";

type AuthUser = {
  id: string;
  email: string;
  username: string;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
};

const TOKEN_KEY = "tcg_auth_token";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function callApi<T>(path: string, method: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = (await response.json()) as T | { message?: string };

  if (!response.ok) {
    const message = (data as { message?: string }).message ?? "Request failed.";
    throw new Error(message);
  }

  return data as T;
}

export function App() {
  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canSubmit = useMemo(() => {
    if (!email || !password) {
      return false;
    }

    if (mode === "register" && !username) {
      return false;
    }

    return true;
  }, [email, password, username, mode]);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }

    void (async () => {
      try {
        const response = await callApi<{ user: AuthUser }>("/auth/me", "GET", undefined, token);
        setCurrentUser(response.user);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setCurrentUser(null);
      }
    })();
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const payload = mode === "register" ? { email, username, password } : { email, password };
      const response = await callApi<AuthResponse>(endpoint, "POST", payload);

      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setCurrentUser(response.user);
      setPassword("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setCurrentUser(null);
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "520px", margin: "0 auto" }}>
      <h1>TCG Auth - Day 2</h1>
      <p>Mongo-backed registration/login flow.</p>

      {currentUser ? (
        <section>
          <h2>Logged In</h2>
          <p>
            <strong>Username:</strong> {currentUser.username}
          </p>
          <p>
            <strong>Email:</strong> {currentUser.email}
          </p>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </section>
      ) : (
        <section>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
            <button type="button" onClick={() => setMode("register")} disabled={mode === "register"}>
              Register
            </button>
            <button type="button" onClick={() => setMode("login")} disabled={mode === "login"}>
              Login
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                style={{ width: "100%" }}
              />
            </label>

            {mode === "register" ? (
              <label>
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </label>
            ) : null}

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                style={{ width: "100%" }}
              />
            </label>

            {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}

            <button type="submit" disabled={isLoading || !canSubmit}>
              {isLoading ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
