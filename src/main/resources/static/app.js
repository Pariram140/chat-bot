const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const statusMessage = document.querySelector("#status-message");
const clearButton = document.querySelector("#clear-chat");

function addMessage(role, text, extraClass = "") {
  if (welcome) welcome.hidden = true;
  const row = document.createElement("article");
  row.className = `message ${role} ${extraClass}`.trim();
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "Y" : "✦";
  const content = document.createElement("div");
  content.className = "message-content";
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "Assistant";
  const body = document.createElement("div");
  body.textContent = text;
  content.append(label, body);
  row.append(avatar, content);
  messages.append(row);
  messages.scrollTop = messages.scrollHeight;
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return row;
}

function addTypingIndicator() {
  const row = addMessage("assistant", "");
  const body = row.querySelector(".message-content > div");
  body.className = "typing";
  body.setAttribute("aria-label", "Assistant is thinking");
  body.replaceChildren(...[1, 2, 3].map(() => document.createElement("span")));
  return row;
}

function extractAnswer(payload) {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    try { return extractAnswer(JSON.parse(trimmed)); }
    catch { return trimmed; }
  }
  if (payload && typeof payload === "object") {
    if (typeof payload.response === "string") return payload.response;
    if (typeof payload.text === "string") return payload.text;
    if (payload.choices?.[0]?.message?.content) return payload.choices[0].message.content;
    if (payload.candidates?.[0]?.content?.parts) {
      return payload.candidates[0].content.parts.map(part => part.text || "").join("").trim();
    }
    if (payload.error?.message) throw new Error(payload.error.message);
  }
  throw new Error("The server returned an unexpected response. Please try again.");
}

async function sendMessage(message) {
  addMessage("user", message);
  input.value = "";
  input.style.height = "auto";
  sendButton.disabled = true;
  input.disabled = true;
  statusMessage.textContent = "The first response may take longer if the free service is waking up.";
  const typingRow = addTypingIndicator();
  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json, text/plain" },
      body: JSON.stringify({ content: message })
    });
    const responseText = await response.text();
    let payload = responseText;
    try { payload = JSON.parse(responseText); } catch { /* Plain text response is supported. */ }
    if (!response.ok) {
      const detail = typeof payload === "string" ? payload : (payload.message || payload.error?.message);
      throw new Error(detail || `Request failed (HTTP ${response.status}).`);
    }
    const answer = extractAnswer(payload);
    if (!answer || answer.startsWith("Error:")) throw new Error(answer || "The assistant returned an empty response.");
    typingRow.remove();
    addMessage("assistant", answer);
    statusMessage.textContent = "AI responses can be inaccurate. Avoid sharing sensitive information.";
  } catch (error) {
    typingRow.remove();
    addMessage("assistant", error.message || "Something went wrong. Please try again.", "error");
    statusMessage.textContent = "Check your connection and try again.";
  } finally {
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || sendButton.disabled) return;
  sendMessage(message);
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
});
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    input.focus();
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  });
});
clearButton.addEventListener("click", () => {
  messages.querySelectorAll(".message").forEach(message => message.remove());
  if (welcome) welcome.hidden = false;
  statusMessage.textContent = "AI responses can be inaccurate. Avoid sharing sensitive information.";
  input.value = "";
  input.focus();
});