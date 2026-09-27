const express = require("express");
const rateLimit = require("express-rate-limit");
const Anthropic = require("@anthropic-ai/sdk").default;
const { SYSTEM_PROMPT } = require("./system-prompt");

const app = express();
const PORT = process.env.PORT || 3000;

// Small bodies only: a chat turn never needs more than this, and it keeps
// someone from posting megabytes at the model on our key.
app.use(express.json({ limit: "64kb" }));
app.use(express.static("public"));

// Cap how often one visitor can hit the model. Without this, anyone who finds
// the URL can run up the Anthropic bill with a script.
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes and try again." },
});

const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;

function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  return messages.every(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length > 0 &&
      m.content.length <= MAX_MESSAGE_CHARS
  );
}

let client;
try {
  client = new Anthropic();
} catch (err) {
  console.error("Failed to initialize Anthropic client:", err.message);
}

app.post("/api/chat", chatLimiter, async (req, res) => {
  if (!client) {
    return res.status(500).json({
      error:
        "ANTHROPIC_API_KEY is not set. Please set it in your environment and restart the server.",
    });
  }

  const { messages } = req.body;

  if (!validMessages(messages)) {
    return res.status(400).json({
      error: `messages must be 1 to ${MAX_MESSAGES} user/assistant turns, each up to ${MAX_MESSAGE_CHARS} characters`,
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-5-20241022",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Claude API error:", error.message);

    let userMessage = "Failed to get response from Claude.";
    if (
      error.message &&
      error.message.includes("authentication")
    ) {
      userMessage =
        "Invalid API key. Check your ANTHROPIC_API_KEY and restart the server.";
    } else if (error.status === 429) {
      userMessage = "Rate limited. Please wait a moment and try again.";
    } else if (error.status === 529 || error.status === 503) {
      userMessage = "Claude is temporarily overloaded. Please try again shortly.";
    }

    if (!res.headersSent) {
      res.status(500).json({ error: userMessage });
    } else {
      res.write(`data: ${JSON.stringify({ error: userMessage })}\n\n`);
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Happy-Maker running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "\n  ⚠  ANTHROPIC_API_KEY is not set. The app will not work until you set it.\n" +
        "     Run: export ANTHROPIC_API_KEY=your-key-here\n"
    );
  }
});
