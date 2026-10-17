const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const MAX_MEMORIES = 8;
const MAX_MEMORY_CHARS = 500;

export function buildModelContext(messages, memories) {
  const history = messages
    .filter(message => ["user", "assistant"].includes(message.role) && message.status !== "failed")
    .slice(-MAX_HISTORY_MESSAGES)
    .map(message => ({
      role: message.role,
      content: String(message.content || "").slice(0, MAX_MESSAGE_CHARS)
    }));

  const selectedMemories = memories
    .slice(0, MAX_MEMORIES)
    .map(memory => String(memory.content || "").trim().slice(0, MAX_MEMORY_CHARS))
    .filter(Boolean);

  return { history, memories: selectedMemories };
}
