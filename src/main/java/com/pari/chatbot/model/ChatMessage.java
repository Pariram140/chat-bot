package com.pari.chatbot.model;

import java.util.ArrayList;
import java.util.List;

public class ChatMessage {
    private String content;
    private List<HistoryMessage> history = new ArrayList<>();
    private List<String> memories = new ArrayList<>();

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public List<HistoryMessage> getHistory() {
        return history;
    }

    public void setHistory(List<HistoryMessage> history) {
        this.history = history == null ? new ArrayList<>() : history;
    }

    public List<String> getMemories() {
        return memories;
    }

    public void setMemories(List<String> memories) {
        this.memories = memories == null ? new ArrayList<>() : memories;
    }

    public static class HistoryMessage {
        private String role;
        private String content;

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }
    }
}
