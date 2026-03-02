import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleMessages } from "./routes/messages";

const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

// Anthropic Messages API endpoint
app.post("/v1/messages", handleMessages);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
