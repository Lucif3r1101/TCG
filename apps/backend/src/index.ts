import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectToDatabase } from "./db/mongo.js";
import { buildAuthRouter } from "./routes/auth.js";
import { buildCardsRouter } from "./routes/cards.js";
import { buildDecksRouter } from "./routes/decks.js";
import { buildMatchesRouter } from "./routes/matches.js";
import { seedBaseCards } from "./services/starterSetup.js";
import { registerRealtime } from "./services/realtime.js";
import { authLimiter, globalApiLimiter } from "./middleware/rateLimit.js";
import { isOriginAllowed, parseAllowedOrigins } from "./config/cors.js";

const requiredEnv = ["MONGODB_URI", "JWT_SECRET"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const mongoUri = process.env.MONGODB_URI as string;
const jwtSecret = process.env.JWT_SECRET as string;
const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);
const port = Number(process.env.PORT ?? 4000);

await connectToDatabase(mongoUri);
await seedBaseCards();

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  })
);
app.use(express.json());
app.use(globalApiLimiter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend", timestamp: new Date().toISOString() });
});

app.use("/auth", authLimiter, buildAuthRouter(jwtSecret));
app.use("/cards", buildCardsRouter());
app.use("/decks", buildDecksRouter(jwtSecret));
app.use("/matches", buildMatchesRouter(jwtSecret));

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  }
});

registerRealtime(io, jwtSecret);

server.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});

