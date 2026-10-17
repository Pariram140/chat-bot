package com.pari.chatbot.controller;

import com.pari.chatbot.model.ChatMessage;
import com.pari.chatbot.service.ChatGPTService;
import com.pari.chatbot.service.ChatMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class ChatbotController {

    private static final Logger log = LoggerFactory.getLogger(ChatbotController.class);
    private static final int MAX_CONTENT_LENGTH = 4000;
    private static final int MAX_HISTORY_MESSAGES = 12;
    private static final int MAX_MEMORIES = 8;
    private static final int MAX_MEMORY_LENGTH = 500;

    private final ChatGPTService chatGPTService;
    private final ChatMetrics chatMetrics;

    public ChatbotController(ChatGPTService chatGPTService, ChatMetrics chatMetrics) {
        this.chatGPTService = chatGPTService;
        this.chatMetrics = chatMetrics;
    }

    @PostMapping("/chat")
    public Mono<ResponseEntity<Map<String, String>>> chat(@RequestBody ChatMessage message) {
        String requestId = UUID.randomUUID().toString();
        String content = message == null ? null : message.getContent();
        if (content == null || content.isBlank()) {
            log.warn("event=chat_rejected requestId={} errorCategory=invalid_empty_content", requestId);
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Message content must not be empty.", "requestId", requestId)));
        }
        if (content.length() > MAX_CONTENT_LENGTH) {
            log.warn("event=chat_rejected requestId={} errorCategory=content_too_long contentChars={}", requestId, content.length());
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Message must be 4000 characters or fewer.", "requestId", requestId)));
        }

        List<ChatMessage.HistoryMessage> history = message.getHistory();
        if (history.size() > MAX_HISTORY_MESSAGES) {
            log.warn("event=chat_rejected requestId={} errorCategory=history_too_large historyCount={}", requestId, history.size());
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "History must contain 12 messages or fewer.", "requestId", requestId)));
        }
        for (ChatMessage.HistoryMessage item : history) {
            if (item == null || item.getRole() == null
                    || !(item.getRole().equals("user") || item.getRole().equals("assistant"))
                    || item.getContent() == null || item.getContent().isBlank()
                    || item.getContent().length() > MAX_CONTENT_LENGTH) {
                log.warn("event=chat_rejected requestId={} errorCategory=invalid_history", requestId);
                return Mono.just(ResponseEntity.badRequest()
                        .body(Map.of("error", "History contains an invalid message.", "requestId", requestId)));
            }
        }

        List<String> memories = message.getMemories();
        if (memories.size() > MAX_MEMORIES) {
            log.warn("event=chat_rejected requestId={} errorCategory=too_many_memories memoryCount={}", requestId, memories.size());
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "Memory context must contain 8 items or fewer.", "requestId", requestId)));
        }
        for (String memory : memories) {
            if (memory == null || memory.isBlank() || memory.length() > MAX_MEMORY_LENGTH) {
                log.warn("event=chat_rejected requestId={} errorCategory=invalid_memory", requestId);
                return Mono.just(ResponseEntity.badRequest()
                        .body(Map.of("error", "Memory context contains an invalid item.", "requestId", requestId)));
            }
        }

        int userHistoryCount = (int) history.stream().filter(item -> "user".equals(item.getRole())).count();
        int assistantHistoryCount = history.size() - userHistoryCount;
        int historyChars = history.stream().mapToInt(item -> item.getContent().length()).sum();
        int memoryChars = memories.stream().mapToInt(String::length).sum();
        log.info("event=chat_received requestId={} contentChars={} historyCount={} historyUserCount={} historyAssistantCount={} historyChars={} memoryCount={} memoryChars={}",
                requestId, content.length(), history.size(), userHistoryCount, assistantHistoryCount, historyChars, memories.size(), memoryChars);

        long startedAt = System.nanoTime();
        return chatGPTService.getGPTResponse(content, history, memories, requestId)
                .map(answer -> {
                    chatMetrics.recordChatOutcome("success");
                    log.info("event=chat_completed requestId={} durationMs={} responseChars={}",
                            requestId, (System.nanoTime() - startedAt) / 1_000_000, answer.length());
                    return ResponseEntity.ok(Map.of("response", answer, "requestId", requestId));
                })
                .onErrorResume(error -> {
                    chatMetrics.recordChatOutcome("failure");
                    log.error("event=chat_failed requestId={} durationMs={} errorCategory=ai_service_failure errorType={}",
                            requestId, (System.nanoTime() - startedAt) / 1_000_000, error.getClass().getSimpleName());
                    String messageText = error instanceof IllegalStateException
                            && error.getMessage() != null
                            && error.getMessage().contains("GEMINI_API_KEY")
                            ? "The AI service is not configured. Set GEMINI_API_KEY on the server."
                            : "The AI service could not complete the request. Check the server key and Gemini quota.";
                    return Mono.just(ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                            .body(Map.of("error", messageText, "requestId", requestId)));
                });
    }
}
