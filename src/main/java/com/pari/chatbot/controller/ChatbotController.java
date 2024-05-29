package com.pari.chatbot.controller;

import com.pari.chatbot.model.ChatMessage;
import com.pari.chatbot.service.ChatGPTService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@CrossOrigin(origins = "http://localhost:3000") // Allow requests from React frontend
public class ChatbotController {

    @Autowired
    private ChatGPTService chatGPTService;

    @PostMapping("/chat")
    public Mono<String> chat(@RequestBody ChatMessage message) {
        return chatGPTService.getGPTResponse(message.getContent())
                .onErrorResume(e -> {
                    e.printStackTrace();
                    return Mono.just("Error: " + e.getMessage());
                });
    }
}
