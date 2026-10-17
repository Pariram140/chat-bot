package com.pari.chatbot.service;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChatMetricsTest {

    @Test
    void recordsChatAndProviderOutcomesWithBoundedTags() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ChatMetrics metrics = new ChatMetrics(registry);

        metrics.recordChatOutcome("success");
        metrics.recordChatOutcome("failure");
        metrics.recordGeminiOutcome("failure", "provider_rate_limited");

        assertEquals(1.0, registry.get("chat.requests").tag("outcome", "success").counter().count());
        assertEquals(1.0, registry.get("chat.requests").tag("outcome", "failure").counter().count());
        assertEquals(1.0, registry.get("gemini.requests")
                .tag("outcome", "failure")
                .tag("error.category", "provider_rate_limited")
                .counter().count());
    }
}
