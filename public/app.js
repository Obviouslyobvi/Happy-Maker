(() => {
  const intakeScreen = document.getElementById("intake-screen");
  const chatScreen = document.getElementById("chat-screen");
  const intakeForm = document.getElementById("intake-form");
  const chatForm = document.getElementById("chat-form");
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const backBtn = document.getElementById("back-btn");
  const stressSlider = document.getElementById("stress-level");
  const stressValue = document.getElementById("stress-value");
  const startBtn = document.getElementById("start-btn");

  let conversationHistory = [];
  let isStreaming = false;

  // ── Stress slider live update ──

  stressSlider.addEventListener("input", () => {
    stressValue.textContent = stressSlider.value;
  });

  // ── Auto-resize chat input ──

  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + "px";
  });

  // ── Screen transitions ──

  function showChat() {
    intakeScreen.classList.remove("active");
    chatScreen.classList.add("active");
  }

  backBtn.addEventListener("click", () => {
    if (
      confirm(
        "Start a new session? Your current conversation will be cleared."
      )
    ) {
      conversationHistory = [];
      chatMessages.innerHTML = "";
      chatScreen.classList.remove("active");
      intakeScreen.classList.add("active");
    }
  });

  // ── Intake form submission ──

  intakeForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const challenge = document.getElementById("challenge").value.trim();
    const stressLevel = stressSlider.value;
    const timeCommitment =
      document.getElementById("time-commitment").value;

    if (!challenge) return;

    const userMessage = [
      `My current challenge or recurring negative thought: ${challenge}`,
      `My stress level (1-10): ${stressLevel}`,
      `Time I can commit daily to this practice: ${timeCommitment} minutes`,
    ].join("\n\n");

    showChat();
    addMessage("user", userMessage);
    sendToAPI(userMessage);
  });

  // ── Chat form submission ──

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || isStreaming) return;

    addMessage("user", text);
    chatInput.value = "";
    chatInput.style.height = "auto";
    sendToAPI(text);
  });

  // ── Enter to send (shift+enter for newline) ──

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event("submit"));
    }
  });

  // ── Add a message to the chat ──

  function addMessage(role, content) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "You" : "Reappraisal Coach";

    const body = document.createElement("div");
    body.className = "message-body";

    if (role === "assistant") {
      body.innerHTML = renderMarkdown(content);
    } else {
      body.textContent = content;
    }

    wrapper.appendChild(roleLabel);
    wrapper.appendChild(body);
    chatMessages.appendChild(wrapper);
    scrollToBottom();

    return body;
  }

  // ── Stream response from the API ──

  async function sendToAPI(userText) {
    isStreaming = true;
    sendBtn.disabled = true;
    startBtn.disabled = true;

    conversationHistory.push({ role: "user", content: userText });

    // Create assistant message placeholder
    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = "Reappraisal Coach";

    const body = document.createElement("div");
    body.className = "message-body";
    body.innerHTML =
      '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    wrapper.appendChild(roleLabel);
    wrapper.appendChild(body);
    chatMessages.appendChild(wrapper);
    scrollToBottom();

    let fullText = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationHistory }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              fullText += parsed.text;
              body.innerHTML = renderMarkdown(fullText);
              scrollToBottom();
            }
          } catch (parseErr) {
            // Skip malformed chunks
          }
        }
      }

      conversationHistory.push({ role: "assistant", content: fullText });
    } catch (err) {
      body.innerHTML = `<p style="color: var(--red);">Something went wrong: ${escapeHtml(err.message)}. Please try again.</p>`;
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      startBtn.disabled = false;
    }
  }

  // ── Minimal Markdown renderer ──

  function renderMarkdown(text) {
    let html = escapeHtml(text);

    // Headers
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(
      /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
      "<em>$1</em>"
    );

    // Blockquotes
    html = html.replace(
      /^&gt; (.+)$/gm,
      "<blockquote>$1</blockquote>"
    );

    // Horizontal rules
    html = html.replace(/^---$/gm, "<hr>");

    // Unordered lists
    html = html.replace(
      /^(?:[-*] .+\n?)+/gm,
      (match) => {
        const items = match
          .trim()
          .split("\n")
          .map((line) => `<li>${line.replace(/^[-*] /, "")}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
    );

    // Ordered lists
    html = html.replace(
      /^(?:\d+\. .+\n?)+/gm,
      (match) => {
        const items = match
          .trim()
          .split("\n")
          .map((line) => `<li>${line.replace(/^\d+\. /, "")}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
    );

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Paragraphs (double newlines)
    html = html
      .split(/\n{2,}/)
      .map((block) => {
        block = block.trim();
        if (!block) return "";
        if (
          block.startsWith("<h") ||
          block.startsWith("<ul") ||
          block.startsWith("<ol") ||
          block.startsWith("<blockquote") ||
          block.startsWith("<hr")
        ) {
          return block;
        }
        return `<p>${block.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

    return html;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
})();
