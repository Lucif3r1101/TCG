import { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../utils.auth";

export function requireAuth(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.header("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Missing or invalid authorization header." });
      return;
    }

    const token = authHeader.replace("Bearer ", "").trim();

    try {
      const payload = verifyAuthToken(token, jwtSecret);
      req.authUserId = payload.userId;
      next();
    } catch {
      res.status(401).json({ message: "Invalid or expired token." });
    }
  };
}
