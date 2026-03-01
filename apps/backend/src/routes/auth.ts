import type { Request, Response } from "express";
import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { signAuthToken } from "../utils.auth.js";
import { requireAuth } from "../middleware/auth.js";
import { grantStarterSetForUser } from "../services/starterSetup.js";
import { sendPasswordResetEmail } from "../services/email.js";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().regex(PASSWORD_RULE)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().regex(PASSWORD_RULE)
});

export function buildAuthRouter(jwtSecret: string): Router {
  const router = Router();

  router.post("/register", async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid registration payload." });
      return;
    }

    const { email, username, password } = parsed.data;

    const existingByEmail = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingByEmail) {
      res.status(409).json({ message: "Email is already in use." });
      return;
    }

    const existingByUsername = await UserModel.findOne({ username });
    if (existingByUsername) {
      res.status(409).json({ message: "Username is already in use." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      email,
      username,
      passwordHash
    });

    await grantStarterSetForUser(user.id);

    const token = signAuthToken({ userId: user.id }, jwtSecret);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  });

  router.post("/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid login payload." });
      return;
    }

    const { email, password } = parsed.data;
    const user = await UserModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const token = signAuthToken({ userId: user.id }, jwtSecret);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  });

  router.post("/forgot-password", async (req: Request, res: Response) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid forgot password payload." });
      return;
    }

    const { email } = parsed.data;
    const user = await UserModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.json({ message: "If the email is registered, a reset link has been generated." });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    const response: Record<string, string> = {
      message: "If the email is registered, a reset link has been generated."
    };

    const sent = await sendPasswordResetEmail({
      to: user.email,
      username: user.username,
      resetToken,
      resetPasswordUrl: process.env.RESET_PASSWORD_URL
    });

    if (!sent && process.env.NODE_ENV === "production") {
      console.error("Password reset email could not be sent. Check RESEND_API_KEY/EMAIL_FROM config.");
    }

    if (process.env.NODE_ENV !== "production") {
      response.resetToken = resetToken;
    }

    res.json(response);
  });

  router.post("/reset-password", async (req: Request, res: Response) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid reset password payload." });
      return;
    }

    const { token, password } = parsed.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await UserModel.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({ message: "Reset token is invalid or expired." });
      return;
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    res.json({ message: "Password updated successfully." });
  });

  router.get("/me", requireAuth(jwtSecret), async (req: Request, res: Response) => {
    const user = await UserModel.findById(req.authUserId);

    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  });

  return router;
}

