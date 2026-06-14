import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

// Configuration & Routers
import { connectDB } from "./config/db.js";
import aiRoutes from "./routes/ai.js";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import friendsRoutes from "./routes/friends.js";
import inviteRoutes from "./routes/invite.js";
import meetingRoutes from "./routes/meetings.js";
import taskRoutes from "./routes/tasks.js";
import { handleSocketConnections } from "./services/socket.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Resolve current directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard Middlewares
// Allow permissive CORS in development for local/testing convenience.
// Standard Middlewares
const allowedOrigins = [
  "http://localhost:5173",
  "http://10.231.137.47:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

console.log("CORS origin:", allowedOrigins);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up public static folders for uploads
const publicUploads = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(publicUploads)) {
  fs.mkdirSync(publicUploads, { recursive: true });
}
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// DB Connection
connectDB();

// API Route Bindings
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/invite", inviteRoutes);
app.use("/api/friends", friendsRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    mode: "Mongoose (Production DB)",
    timestamp: new Date(),
  });
});

// Serve Frontend in Production
const clientDist = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  console.log("📦 Serving production frontend from client/dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    // Only send index.html if it's not an API request
    if (!req.path.startsWith("/api/")) {
      res.sendFile(path.join(clientDist, "index.html"));
    } else {
      res.status(404).json({ message: "API Route Not Found" });
    }
  });
}

// Configure Web Socket Connections
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,  
  },
});
handleSocketConnections(io);

// Express global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Server Error Handler:", err.message);
  res.status(500).json({
    message: err.message || "An unexpected server error occurred",
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("======================================================");
  console.log(`🚀 IntellMeet Backend running on: http://localhost:${PORT} 🚀`);
  console.log(`🔌 WebSockets server active & listening on same port.`);
  console.log("======================================================");
});
