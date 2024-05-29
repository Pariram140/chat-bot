package com.pari.chatbot.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

@Service
public class ChatGPTService {

    @Value("${openai.api.key}")
    private String GPT_API_KEY; // Inject GPT API key from application.properties

    private final String GPT_API_URL = "https://api.openai.com";

    private final WebClient webClient;

    public ChatGPTService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl(GPT_API_URL).build();
    }

    public Mono<String> getGPTResponse(String userInput) {
        String requestBody = "{\"model\":\"gpt-3.5-turbo\",\"messages\":[{\"role\":\"user\",\"content\":\"" + userInput + "\"}]}";

        return webClient.post()
                .uri("/v1/chat/completions")
                .header("Authorization", "Bearer " + GPT_API_KEY)
                .header("Content-Type", "application/json")
                .body(BodyInserters.fromValue(requestBody))
                .retrieve()
                .bodyToMono(String.class)
                .onErrorResume(WebClientResponseException.class, ex -> {
                    if (ex.getStatusCode().is4xxClientError() || ex.getStatusCode().is5xxServerError()) {
                        // Handle client and server errors specifically
                        return handleApiError(ex);
                    } else {
                        // Log and return error message for other exceptions
                        ex.printStackTrace();
                        return Mono.error(new RuntimeException("Error: " + ex.getMessage()));
                    }
                });
    }

    private Mono<String> handleApiError(WebClientResponseException ex) {
        System.err.println("API error: " + ex.getResponseBodyAsString());
        return Mono.just("Error: API error. Please check your request and try again.");
    }
}
