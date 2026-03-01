import type { Request, Response } from "express";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { signAuthToken } from "../utils.auth.js";
import { requireAuth } from "../middleware/auth.js";
import { grantStarterSetForUser } from "../services/starterSetup.js";

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

