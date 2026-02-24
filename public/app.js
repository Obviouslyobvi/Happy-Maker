(() => {
  const intakeScreen = document.getElementById("intake-screen");
  const chatScreen = document.getElementById("chat-screen");
  const intakeForm = document.getElementById("intake-form");
  const chatForm = document.getElementById("chat-form");
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const backBtn = document.getElementById("back-btn");
  const clearBtn = document.getElementById("clear-btn");
  const stressSlider = document.getElementById("stress-level");
  const stressValue = document.getElementById("stress-value");
  const startBtn = document.getElementById("start-btn");

  const STORAGE_KEY = "happy-maker-session";

  let conversationHistory = [];
  let isStreaming = false;

  // ── Session persistence ──

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages: conversationHistory })
      );
    } catch (e) {
      // Storage full or unavailable — silently ignore
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.messages && data.messages.length > 0) return data;
    } catch (e) {
      // Corrupted data — clear it
      localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    conversationHistory = [];
  }

  // ── Restore previous session if it exists ──

  const savedSession = loadSession();
  if (savedSession) {
    conversationHistory = savedSession.messages;
    showChat();

    const banner = document.createElement("div");
    banner.className = "session-restored";
    banner.textContent = "Previous session restored";
    chatMessages.appendChild(banner);

    for (const msg of conversationHistory) {
      addMessage(msg.role, msg.content, false);
    }
    scrollToBottom();
  }

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

  function showIntake() {
    chatScreen.classList.remove("active");
    intakeScreen.classList.add("active");
  }

  backBtn.addEventListener("click", () => {
    if (
      conversationHistory.length === 0 ||
      confirm("Start a new session? Your current conversation will be cleared.")
    ) {
      clearSession();
      chatMessages.innerHTML = "";
      showIntake();
    }
  });

  clearBtn.addEventListener("click", () => {
    if (confirm("Clear this session and start over?")) {
      clearSession();
      chatMessages.innerHTML = "";
      showIntake();
    }
  });

  // ── Intake form submission ──

  intakeForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const challenge = document.getElementById("challenge").value.trim();
    const stressLevel = stressSlider.value;
    const timeCommitment = document.getElementById("time-commitment").value;

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

  function addMessage(role, content, animate = true) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;
    if (!animate) wrapper.style.animation = "none";

    const header = document.createElement("div");
    header.className = "message-header";

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "You" : "Reappraisal Coach";
    header.appendChild(roleLabel);

    if (role === "assistant" && content) {
      header.appendChild(createCopyButton(content));
    }

    const body = document.createElement("div");
    body.className = "message-body";

    if (role === "assistant") {
      body.innerHTML = renderMarkdown(content);
    } else {
      body.textContent = content;
    }

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    chatMessages.appendChild(wrapper);
    scrollToBottom();

    return { wrapper, header, body };
  }

  // ── Copy to clipboard ──

  function createCopyButton(text) {
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M8 4V2.5C8 1.95 7.55 1.5 7 1.5H2.5C1.95 1.5 1.5 1.95 1.5 2.5V7C1.5 7.55 1.95 8 2.5 8H4" stroke="currentColor" stroke-width="1.3"/></svg> Copy';

    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add("copied");
        btn.innerHTML =
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied';
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML =
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M8 4V2.5C8 1.95 7.55 1.5 7 1.5H2.5C1.95 1.5 1.5 1.95 1.5 2.5V7C1.5 7.55 1.95 8 2.5 8H4" stroke="currentColor" stroke-width="1.3"/></svg> Copy';
        }, 2000);
      } catch (e) {
        // Clipboard API not available
      }
    });

    return btn;
  }

  // ── Stream response from the API ──

  async function sendToAPI(userText) {
    isStreaming = true;
    sendBtn.disabled = true;
    startBtn.disabled = true;

    conversationHistory.push({ role: "user", content: userText });
    saveSession();

    // Create assistant message placeholder
    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";

    const header = document.createElement("div");
    header.className = "message-header";

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = "Reappraisal Coach";
    header.appendChild(roleLabel);

    const body = document.createElement("div");
    body.className = "message-body";
    body.innerHTML =
      '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    wrapper.appendChild(header);
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
        let errMsg = `Server error: ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody.error) errMsg = errBody.error;
        } catch (e) {
          // Response wasn't JSON — use the status code message
        }
        throw new Error(errMsg);
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
      saveSession();

      // Add copy button now that we have the full text
      header.appendChild(createCopyButton(fullText));
    } catch (err) {
      // Remove the failed user message so the user can retry
      conversationHistory.pop();
      saveSession();
      body.innerHTML = `<p style="color: var(--red);">${escapeHtml(err.message)}</p>`;
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      startBtn.disabled = false;
    }
  }

  // ── Markdown renderer ──

  function renderMarkdown(text) {
    let html = escapeHtml(text);

    // Tables: detect header | separator | rows pattern
    html = html.replace(
      /^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm,
      (match, headerLine, sepLine, bodyLines) => {
        const headers = headerLine
          .split("|")
          .filter((c) => c.trim())
          .map((c) => `<th>${c.trim()}</th>`)
          .join("");
        const rows = bodyLines
          .trim()
          .split("\n")
          .map((row) => {
            const cells = row
              .split("|")
              .filter((c) => c.trim())
              .map((c) => `<td>${c.trim()}</td>`)
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");
        return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    );

    // Headers
    html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
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
    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

    // Horizontal rules
    html = html.replace(/^---$/gm, "<hr>");

    // Unordered lists (handle nesting with indentation)
    html = html.replace(/^(?:[ ]*[-*] .+\n?)+/gm, (match) => {
      return parseList(match, "ul");
    });

    // Ordered lists (handle nesting)
    html = html.replace(/^(?:[ ]*\d+\. .+\n?)+/gm, (match) => {
      return parseList(match, "ol");
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Paragraphs (double newlines)
    html = html
      .split(/\n{2,}/)
      .map((block) => {
        block = block.trim();
        if (!block) return "";
        if (/^<(?:h[1-6]|ul|ol|table|blockquote|hr|p)/.test(block)) {
          return block;
        }
        return `<p>${block.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

    return html;
  }

  // Parse list content into nested HTML lists
  function parseList(text, tag) {
    const lines = text.trim().split("\n");
    const listPattern = tag === "ul" ? /^( *)[-*] (.+)/ : /^( *)\d+\. (.+)/;
    let result = `<${tag}>`;
    let prevIndent = 0;
    let depth = 0;

    for (const line of lines) {
      const m = line.match(listPattern);
      if (!m) continue;
      const indent = m[1].length;
      const content = m[2];

      if (indent > prevIndent && depth === 0) {
        // First nesting level — keep it simple, just add the item
        depth = 1;
      } else if (indent < prevIndent && depth > 0) {
        depth = 0;
      }
      result += `<li>${content}</li>`;
      prevIndent = indent;
    }

    result += `</${tag}>`;
    return result;
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
