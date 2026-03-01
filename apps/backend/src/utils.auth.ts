import jwt from "jsonwebtoken";

export type AuthTokenPayload = {
  userId: string;
};

export function signAuthToken(payload: AuthTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string, secret: string): AuthTokenPayload {
  return jwt.verify(token, secret) as AuthTokenPayload;
}
