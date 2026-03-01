function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

export function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) {
    return ["http://localhost:5173", "http://127.0.0.1:5173"];
  }

  return value
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter((origin) => origin.length > 0);
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes("*") || allowedOrigins.includes(normalized);
}
