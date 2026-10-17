package com.pari.chatbot.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChatGPTServiceTest {

    @Test
    void classifiesRateLimitAndTimeoutStatuses() {
        assertEquals("provider_rate_limited", ChatGPTService.classifyStatus(429));
        assertEquals("provider_timeout", ChatGPTService.classifyStatus(408));
        assertEquals("provider_timeout", ChatGPTService.classifyStatus(504));
    }

    @Test
    void classifiesProviderServerErrors() {
        assertEquals("provider_server_error", ChatGPTService.classifyStatus(500));
        assertEquals("provider_server_error", ChatGPTService.classifyStatus(503));
    }

    @Test
    void classifiesAuthenticationAndRequestErrors() {
        assertEquals("provider_auth_or_permission_error", ChatGPTService.classifyStatus(401));
        assertEquals("provider_auth_or_permission_error", ChatGPTService.classifyStatus(403));
        assertEquals("provider_request_rejected", ChatGPTService.classifyStatus(400));
    }
}
