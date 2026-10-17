const DB_NAME = "chatbot-prototype";
const DB_VERSION = 1;
const STORES = ["profiles", "conversations", "messages", "memories"];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

class IndexedDbConversationStore {
  constructor() {
    this.databasePromise = null;
  }

  async database() {
    if (!("indexedDB" in window)) throw new Error("This browser does not support IndexedDB.");
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("profiles")) {
            const store = db.createObjectStore("profiles", { keyPath: "id" });
            store.createIndex("updatedAt", "updatedAt");
          }
          if (!db.objectStoreNames.contains("conversations")) {
            const store = db.createObjectStore("conversations", { keyPath: "id" });
            store.createIndex("profileId", "profileId");
            store.createIndex("updatedAt", "updatedAt");
          }
          if (!db.objectStoreNames.contains("messages")) {
            const store = db.createObjectStore("messages", { keyPath: "id" });
            store.createIndex("conversationId", "conversationId");
            store.createIndex("createdAt", "createdAt");
          }
          if (!db.objectStoreNames.contains("memories")) {
            const store = db.createObjectStore("memories", { keyPath: "id" });
            store.createIndex("profileId", "profileId");
            store.createIndex("updatedAt", "updatedAt");
          }
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error || new Error("Could not open local storage."));
        request.onblocked = () => reject(new Error("Close other chatbot tabs to upgrade local storage."));
      });
    }
    return this.databasePromise;
  }

  async all(storeName) {
    const db = await this.database();
    return requestResult(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
  }

  async put(storeName, record) {
    const db = await this.database();
    return requestResult(db.transaction(storeName, "readwrite").objectStore(storeName).put(record));
  }

  async remove(storeName, id) {
    const db = await this.database();
    return requestResult(db.transaction(storeName, "readwrite").objectStore(storeName).delete(id));
  }

  async getProfiles() {
    return (await this.all("profiles")).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createProfile(name) {
    const now = new Date().toISOString();
    const profile = { id: crypto.randomUUID(), name: name.trim().slice(0, 60), createdAt: now, updatedAt: now };
    if (!profile.name) throw new Error("Enter a profile name.");
    await this.put("profiles", profile);
    return profile;
  }

  async getProfile(profileId) {
    return (await this.all("profiles")).find(profile => profile.id === profileId) || null;
  }

  async listConversations(profileId) {
    return (await this.all("conversations"))
      .filter(item => item.profileId === profileId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getConversation(profileId, conversationId) {
    const item = (await this.all("conversations")).find(c => c.id === conversationId && c.profileId === profileId);
    return item || null;
  }

  async createConversation(profileId) {
    const now = new Date().toISOString();
    const conversation = { id: crypto.randomUUID(), profileId, title: "New chat", createdAt: now, updatedAt: now };
    await this.put("conversations", conversation);
    return conversation;
  }

  async renameConversation(profileId, conversationId, title) {
    const conversation = await this.getConversation(profileId, conversationId);
    if (!conversation) throw new Error("Conversation not found in the active profile.");
    conversation.title = title.trim().slice(0, 80) || "New chat";
    conversation.updatedAt = new Date().toISOString();
    await this.put("conversations", conversation);
    return conversation;
  }

  async deleteConversation(profileId, conversationId) {
    const conversation = await this.getConversation(profileId, conversationId);
    if (!conversation) return;
    const messages = (await this.all("messages")).filter(m => m.conversationId === conversationId);
    const db = await this.database();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["conversations", "messages", "memories"], "readwrite");
      tx.objectStore("conversations").delete(conversationId);
      messages.forEach(message => tx.objectStore("messages").delete(message.id));
      const memories = tx.objectStore("memories").index("profileId").getAll(profileId);
      memories.onsuccess = () => memories.result
        .filter(memory => memory.sourceConversationId === conversationId)
        .forEach(memory => tx.objectStore("memories").delete(memory.id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Could not delete conversation."));
      tx.onabort = () => reject(tx.error || new Error("Conversation deletion was aborted."));
    });
  }

  async listMessages(profileId, conversationId) {
    if (!(await this.getConversation(profileId, conversationId))) return [];
    return (await this.all("messages"))
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async addMessage(profileId, conversationId, role, content, status = "complete") {
    const conversation = await this.getConversation(profileId, conversationId);
    if (!conversation) throw new Error("Conversation not found in the active profile.");
    const message = { id: crypto.randomUUID(), conversationId, role, content, status, createdAt: new Date().toISOString() };
    await this.put("messages", message);
    conversation.updatedAt = message.createdAt;
    if (role === "user" && conversation.title === "New chat") {
      conversation.title = content.trim().replace(/\s+/g, " ").slice(0, 48) || "New chat";
    }
    await this.put("conversations", conversation);
    return message;
  }

  async updateMessageStatus(messageId, status) {
    const message = (await this.all("messages")).find(item => item.id === messageId);
    if (!message) return;
    message.status = status;
    await this.put("messages", message);
  }

  async listMemories(profileId) {
    return (await this.all("memories"))
      .filter(memory => memory.profileId === profileId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveMemory(profileId, content, sourceConversationId = null) {
    const text = content.trim().slice(0, 500);
    if (!text) throw new Error("Memory cannot be empty.");
    const existing = (await this.listMemories(profileId)).find(memory => memory.content.toLowerCase() === text.toLowerCase());
    const now = new Date().toISOString();
    const memory = existing
      ? { ...existing, updatedAt: now, sourceConversationId: sourceConversationId || existing.sourceConversationId }
      : { id: crypto.randomUUID(), profileId, content: text, category: "user-saved", sourceConversationId, createdAt: now, updatedAt: now };
    await this.put("memories", memory);
    return memory;
  }

  async deleteMemory(profileId, memoryId) {
    const memory = (await this.all("memories")).find(item => item.id === memoryId && item.profileId === profileId);
    if (memory) await this.remove("memories", memoryId);
  }

  async deleteProfile(profileId) {
    const profile = await this.getProfile(profileId);
    if (!profile) return;
    const conversations = await this.listConversations(profileId);
    for (const conversation of conversations) await this.deleteConversation(profileId, conversation.id);
    const memories = await this.listMemories(profileId);
    for (const memory of memories) await this.deleteMemory(profileId, memory.id);
    await this.remove("profiles", profileId);
  }
}

export const conversationStore = new IndexedDbConversationStore();
