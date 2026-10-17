package com.pari.chatbot.controller;

import com.pari.chatbot.model.ChatMessage;
import com.pari.chatbot.service.ChatGPTService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
public class ChatbotController {

    private final ChatGPTService chatGPTService;

    public ChatbotController(ChatGPTService chatGPTService) {
        this.chatGPTService = chatGPTService;
    }

    @PostMapping("/chat")
    public Mono<ResponseEntity<Map<String, String>>> chat(@RequestBody ChatMessage message) {
        String content = message == null ? null : message.getContent();
        if (content == null || content.isBlank()) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Message content must not be empty.")));
        }
        if (content.length() > 4000) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Message must be 4000 characters or fewer.")));
        }

        return chatGPTService.getGPTResponse(content)
                .map(answer -> ResponseEntity.ok(Map.of("response", answer)))
                .onErrorResume(error -> {
                    // Keep credentials and upstream response details out of the public API.
                    System.err.println("Chat request failed: " + error.getClass().getSimpleName()
                            + ": " + error.getMessage());
                    String messageText = error instanceof IllegalStateException
                            && error.getMessage() != null
                            && error.getMessage().contains("GEMINI_API_KEY")
                            ? "The AI service is not configured. Set GEMINI_API_KEY on the server."
                            : "The AI service could not complete the request. Check the server key and Gemini quota.";
                    return Mono.just(ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                            .body(Map.of("error", messageText)));
                });
    }
}