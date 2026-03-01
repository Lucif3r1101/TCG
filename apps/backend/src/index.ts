import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend", timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT ?? 4000);
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173"
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