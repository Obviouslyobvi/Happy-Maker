const express = require("express");
const Anthropic = require("@anthropic-ai/sdk").default;
const { SYSTEM_PROMPT } = require("./system-prompt");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const client = new Anthropic();

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-5",
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
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to get response from Claude" });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
      );
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Happy-Maker running at http://localhost:${PORT}`);
});
