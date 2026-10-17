package com.pari.chatbot.controller;

import com.pari.chatbot.service.ChatGPTService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import reactor.core.publisher.Mono;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ChatbotFunctionalTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ChatGPTService chatGPTService;

    @Test
    void servesChatUi() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("id=\"chat-form\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/app.js")));
    }

    @Test
    void servesFrontendScript() throws Exception {
        mockMvc.perform(get("/app.js"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/javascript")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/chat")));
    }

    @Test
    void validChatRequestReturnsAssistantResponse() throws Exception {
        when(chatGPTService.getGPTResponse("Hello")).thenReturn(Mono.just("Hello from the assistant"));

        MvcResult result = mockMvc.perform(post("/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Hello\"}"))
                .andReturn();

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response").value("Hello from the assistant"));

        verify(chatGPTService).getGPTResponse("Hello");
    }

    @Test
    void blankChatRequestIsRejectedWithoutCallingAiService() throws Exception {
        MvcResult result = mockMvc.perform(post("/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"   \"}"))
                .andReturn();

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Message content must not be empty."));

        verify(chatGPTService, never()).getGPTResponse(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void oversizedChatRequestIsRejectedWithoutCallingAiService() throws Exception {
        String tooLongMessage = "a".repeat(4001);
        String requestBody = new com.fasterxml.jackson.databind.ObjectMapper()
                .createObjectNode()
                .put("content", tooLongMessage)
                .toString();

        MvcResult result = mockMvc.perform(post("/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andReturn();

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Message must be 4000 characters or fewer."));

        verify(chatGPTService, never()).getGPTResponse(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void upstreamAiFailureReturnsSafeBadGatewayResponse() throws Exception {
        when(chatGPTService.getGPTResponse("Hello"))
                .thenReturn(Mono.error(new IllegalStateException("sensitive upstream detail")));

        MvcResult result = mockMvc.perform(post("/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Hello\"}"))
                .andReturn();

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value(
                        "The AI service could not complete the request. Check the server key and Gemini quota."))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("sensitive upstream detail"))));
    }
}
