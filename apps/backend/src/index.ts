import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectToDatabase } from "./db/mongo";
import { buildAuthRouter } from "./routes/auth";
import { buildCardsRouter } from "./routes/cards";
import { buildDecksRouter } from "./routes/decks";
import { seedBaseCards } from "./services/starterSetup";

const requiredEnv = ["MONGODB_URI", "JWT_SECRET"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const mongoUri = process.env.MONGODB_URI as string;
const jwtSecret = process.env.JWT_SECRET as string;
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const port = Number(process.env.PORT ?? 4000);

await connectToDatabase(mongoUri);
await seedBaseCards();

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend", timestamp: new Date().toISOString() });
});

app.use("/auth", buildAuthRouter(jwtSecret));
app.use("/cards", buildCardsRouter());
app.use("/decks", buildDecksRouter(jwtSecret));

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOrigin
  }
});

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`socket disconnected: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
