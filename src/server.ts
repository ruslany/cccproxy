import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleMessages } from "./routes/messages";

const app = new Hono();

// Enable CORS for localhost only (security: prevent cross-origin attacks from arbitrary websites)
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (e.g., same-origin, curl, CLI tools)
      if (!origin) return null;
      // Only allow localhost origins
      const url = new URL(origin);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return origin;
      }
      return null;
    },
  })
);

// Anthropic Messages API endpoint
app.post("/v1/messages", handleMessages);

// Health check
app.get("/", (c) => c.json({ status: "ok" }));

export default app;
