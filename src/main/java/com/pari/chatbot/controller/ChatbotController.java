package com.pari.chatbot.controller;

import com.pari.chatbot.model.ChatMessage;
import com.pari.chatbot.service.ChatGPTService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@RestController
public class ChatbotController {

    private static final int MAX_CONTENT_LENGTH = 4000;
    private static final int MAX_HISTORY_MESSAGES = 12;
    private static final int MAX_MEMORIES = 8;
    private static final int MAX_MEMORY_LENGTH = 500;

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
        if (content.length() > MAX_CONTENT_LENGTH) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Message must be 4000 characters or fewer.")));
        }

        List<ChatMessage.HistoryMessage> history = message.getHistory();
        if (history.size() > MAX_HISTORY_MESSAGES) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "History must contain 12 messages or fewer.")));
        }
        for (ChatMessage.HistoryMessage item : history) {
            if (item == null || item.getRole() == null
                    || !(item.getRole().equals("user") || item.getRole().equals("assistant"))
                    || item.getContent() == null || item.getContent().isBlank()
                    || item.getContent().length() > MAX_CONTENT_LENGTH) {
                return Mono.just(ResponseEntity.badRequest()
                        .body(Map.of("error", "History contains an invalid message.")));
            }
        }

        List<String> memories = message.getMemories();
        if (memories.size() > MAX_MEMORIES) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Memory context must contain 8 items or fewer.")));
        }
        for (String memory : memories) {
            if (memory == null || memory.isBlank() || memory.length() > MAX_MEMORY_LENGTH) {
                return Mono.just(ResponseEntity.badRequest()
                        .body(Map.of("error", "Memory context contains an invalid item.")));
            }
        }

        return chatGPTService.getGPTResponse(content, history, memories)
                .map(answer -> ResponseEntity.ok(Map.of("response", answer)))
                .onErrorResume(error -> {
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
