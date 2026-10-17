package com.pari.chatbot.service;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * Application counters use bounded tags only. Never add request IDs, user content,
 * memory text, or other high-cardinality/sensitive values as metric tags.
 */
@Component
public class ChatMetrics {

    private final MeterRegistry registry;

    public ChatMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public void recordChatOutcome(String outcome) {
        registry.counter("chat.requests", "outcome", outcome).increment();
    }

    public void recordGeminiOutcome(String outcome, String errorCategory) {
        registry.counter("gemini.requests",
                "outcome", outcome,
                "error.category", errorCategory).increment();
    }
}
