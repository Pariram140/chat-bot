package com.pari.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class ChatGPTService {

    private final WebClient webClient;
    private final String apiKey;
    private final String model;

    public ChatGPTService(
            WebClient.Builder webClientBuilder,
            @Value("${gemini.api.key:}") String apiKey,
            @Value("${gemini.api.model:gemini-2.5-flash-lite}") String model) {
        this.webClient = webClientBuilder
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
        this.apiKey = apiKey;
        this.model = model;
    }

    public Mono<String> getGPTResponse(String userInput) {
        if (apiKey == null || apiKey.isBlank()) {
            return Mono.error(new IllegalStateException(
                    "The server is not configured. Set the GEMINI_API_KEY environment variable."));
        }

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", userInput)))
                )
        );

        return webClient.post()
                .uri("/v1beta/models/{model}:generateContent", model)
                .header("x-goog-api-key", apiKey)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(this::extractText);
    }

    private String extractText(JsonNode response) {
        JsonNode parts = response.path("candidates").path(0).path("content").path("parts");
        if (parts.isArray()) {
            StringBuilder answer = new StringBuilder();
            for (JsonNode part : parts) {
                if (part.hasNonNull("text")) {
                    if (!answer.isEmpty()) {
                        answer.append("\n");
                    }
                    answer.append(part.get("text").asText());
                }
            }
            if (!answer.isEmpty()) {
                return answer.toString();
            }
        }

        String providerMessage = response.path("error").path("message").asText("");
        if (!providerMessage.isBlank()) {
            throw new IllegalStateException("Gemini API error: " + providerMessage);
        }
        throw new IllegalStateException("Gemini returned no text. Try a different prompt.");
    }
}