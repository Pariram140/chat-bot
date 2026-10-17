import { conversationStore } from "./conversation-store.js";
import { buildModelContext } from "./context-builder.js";

const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const statusMessage = document.querySelector("#status-message");
const clearButton = document.querySelector("#clear-chat");
const profileSelect = document.querySelector("#profile-select");
const addProfileButton = document.querySelector("#add-profile");
const conversationList = document.querySelector("#conversation-list");
const memoryForm = document.querySelector("#memory-form");
const memoryInput = document.querySelector("#memory-input");
const memoryList = document.querySelector("#memory-list");
const chatHeading = document.querySelector("#chat-heading");

let activeProfileId = null;
let activeConversationId = null;
let sending = false;

function newId() {
  return crypto.randomUUID();
}

function renderMessage(role, text, status = "complete") {
  if (welcome) welcome.hidden = true;
  const row = document.createElement("article");
  row.className = `message ${role === "user" ? "user" : "assistant"} ${status === "failed" ? "error" : ""}`.trim();
  row.dataset.status = status;
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
  return row;
}

function showWelcome() {
  messages.querySelectorAll(".message").forEach(row => row.remove());
  if (welcome) welcome.hidden = false;
}

async function renderConversationList() {
  const conversations = await conversationStore.listConversations(activeProfileId);
  conversationList.replaceChildren();
  for (const conversation of conversations) {
    const item = document.createElement("div");
    item.className = "conversation-item";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "conversation-open";
    open.textContent = conversation.title;
    open.title = conversation.title;
    open.setAttribute("aria-current", conversation.id === activeConversationId ? "page" : "false");
    if (conversation.id === activeConversationId) open.classList.add("active");
    open.addEventListener("click", () => openConversation(conversation.id));
    const actions = document.createElement("div");
    actions.className = "conversation-actions";
    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "icon-button";
    rename.textContent = "✎";
    rename.title = "Rename conversation";
    rename.setAttribute("aria-label", `Rename ${conversation.title}`);
    rename.addEventListener("click", async () => {
      const title = window.prompt("Conversation name", conversation.title);
      if (title === null) return;
      try {
        await conversationStore.renameConversation(activeProfileId, conversation.id, title);
        await renderConversationList();
      } catch (error) { setStatus(error.message); }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "×";
    remove.title = "Delete conversation";
    remove.setAttribute("aria-label", `Delete ${conversation.title}`);
    remove.addEventListener("click", async () => {
      if (!window.confirm("Delete this conversation and memories saved from it?")) return;
      await conversationStore.deleteConversation(activeProfileId, conversation.id);
      if (activeConversationId === conversation.id) {
        activeConversationId = null;
        await startNewConversation();
      } else {
        await renderConversationList();
      }
      await renderMemoryList();
    });
    actions.append(rename, remove);
    item.append(open, actions);
    conversationList.append(item);
  }
}

async function renderMemoryList() {
  const memories = await conversationStore.listMemories(activeProfileId);
  memoryList.replaceChildren();
  if (!memories.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No saved memories yet.";
    memoryList.append(empty);
    return;
  }
  for (const memory of memories) {
    const item = document.createElement("div");
    item.className = "memory-item";
    const text = document.createElement("span");
    text.textContent = memory.content;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "×";
    remove.title = "Delete memory";
    remove.setAttribute("aria-label", "Delete saved memory");
    remove.addEventListener("click", async () => {
      await conversationStore.deleteMemory(activeProfileId, memory.id);
      await renderMemoryList();
    });
    item.append(text, remove);
    memoryList.append(item);
  }
}

async function loadProfiles(preferredId = null) {
  let profiles = await conversationStore.getProfiles();
  if (!profiles.length) {
    const profile = await conversationStore.createProfile("My profile");
    profiles = [profile];
  }
  profileSelect.replaceChildren();
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    profileSelect.append(option);
  }
  const target = profiles.find(profile => profile.id === preferredId) || profiles[0];
  activeProfileId = target.id;
  profileSelect.value = target.id;
  localStorage.setItem("chatbot-active-profile", target.id);
}

async function openConversation(conversationId) {
  const conversation = await conversationStore.getConversation(activeProfileId, conversationId);
  if (!conversation) {
    setStatus("That conversation is not available in this local profile.");
    return;
  }
  activeConversationId = conversation.id;
  chatHeading.textContent = conversation.title;
  showWelcome();
  const history = await conversationStore.listMessages(activeProfileId, conversation.id);
  if (history.length && welcome) welcome.hidden = true;
  history.forEach(message => renderMessage(message.role, message.content, message.status));
  await renderConversationList();
  input.focus();
}

async function startNewConversation() {
  const conversation = await conversationStore.createConversation(activeProfileId);
  activeConversationId = conversation.id;
  chatHeading.textContent = "New chat";
  showWelcome();
  await renderConversationList();
  input.value = "";
  input.focus();
}

function setStatus(text) {
  statusMessage.textContent = text;
}

async function sendMessage(message) {
  if (sending || !activeConversationId) return;
  sending = true;
  const profileId = activeProfileId;
  const conversationId = activeConversationId;
  input.value = "";
  input.style.height = "auto";
  sendButton.disabled = true;
  input.disabled = true;
  setStatus("Saving conversation and preparing context…");

  const userMessage = await conversationStore.addMessage(profileId, conversationId, "user", message, "pending");
  renderMessage("user", message, "pending");
  const typingRow = renderMessage("assistant", "Thinking…", "pending");
  try {
    const [allMessages, memories] = await Promise.all([
      conversationStore.listMessages(profileId, conversationId),
      conversationStore.listMemories(profileId)
    ]);
    const priorMessages = allMessages.filter(item => item.id !== userMessage.id);
    const context = buildModelContext(priorMessages, memories);
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ content: message, history: context.history, memories: context.memories })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The assistant could not complete the request.");
    if (typeof payload.response !== "string" || !payload.response.trim()) throw new Error("The assistant returned an empty response.");

    await conversationStore.updateMessageStatus(userMessage.id, "complete");
    typingRow.remove();
    await conversationStore.addMessage(profileId, conversationId, "assistant", payload.response);
    renderMessage("assistant", payload.response);
    setStatus("AI responses can be inaccurate. Avoid sharing sensitive information.");
  } catch (error) {
    await conversationStore.updateMessageStatus(userMessage.id, "failed");
    typingRow.remove();
    renderMessage("assistant", error.message || "Something went wrong. Please try again.", "failed");
    setStatus("Your message is saved locally but was not answered. Retry by sending it again.");
  } finally {
    sending = false;
    sendButton.disabled = false;
    input.disabled = false;
    await renderConversationList();
    await renderMemoryList();
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const message = input.value.trim();
  if (message && !sending) sendMessage(message);
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

clearButton.addEventListener("click", startNewConversation);

addProfileButton.addEventListener("click", async () => {
  const name = window.prompt("Name for this local profile");
  if (!name || !name.trim()) return;
  try {
    const profile = await conversationStore.createProfile(name);
    await loadProfiles(profile.id);
    activeConversationId = null;
    await renderMemoryList();
    await startNewConversation();
  } catch (error) { setStatus(error.message); }
});

profileSelect.addEventListener("change", async () => {
  activeProfileId = profileSelect.value;
  localStorage.setItem("chatbot-active-profile", activeProfileId);
  activeConversationId = null;
  await renderMemoryList();
  await startNewConversation();
});

memoryForm.addEventListener("submit", async event => {
  event.preventDefault();
  const content = memoryInput.value.trim();
  if (!content) return;
  try {
    await conversationStore.saveMemory(activeProfileId, content, activeConversationId);
    memoryInput.value = "";
    await renderMemoryList();
    setStatus("Memory saved for this local profile and will be included in future chats.");
  } catch (error) { setStatus(error.message); }
});

async function initialize() {
  try {
    await loadProfiles(localStorage.getItem("chatbot-active-profile"));
    await renderMemoryList();
    const conversations = await conversationStore.listConversations(activeProfileId);
    if (conversations.length) await openConversation(conversations[0].id);
    else await startNewConversation();
  } catch (error) {
    setStatus(`Local storage is unavailable: ${error.message}`);
    sendButton.disabled = true;
  } finally {
    document.body.dataset.ready = "true";
  }
}

initialize();
