# Chatbot Spring Boot Application

This is a Spring Boot application that interacts with the OpenAI API to create a chatbot. The chatbot accepts user input and responds with generated text using OpenAI's provided model.

## Prerequisites

- Java 11 or higher
- Maven
- OpenAI API key

## Getting Started

### 1. Clone the Repository

```sh
git clone https://github.com/yourusername/chat-bot.git
cd chatbot
```
### 2. Add Your OpenAI API Key
Open the src/main/resources/application.properties file and add your OpenAI API key:

```
openai.api.key=your_openai_api_key_here
```
### 3. Build and Run the Application
You can run the application using Maven or Gradle.

Using Maven
```sh
./mvnw spring-boot:run
```
### 4. Test the API
You can test the chatbot endpoint using Postman or cURL.

Using cURL
```sh
curl --location 'http://localhost:8080/chat' \
--header 'Content-Type: application/json' \
--data-raw '{
    "content": "Hello!"
}'
```
### API Endpoints
#### POST /chat
This endpoint accepts a JSON payload with the user's message and returns the chatbot's response.

Request Body:

```json
{
  "content": "Hello!"
}
```
Response Body:

```json
{
  "response": "Hello! How can I help you today?"
}
```


### Error Handling
The application handles errors gracefully and provides informative error messages. For instance, it will notify you if the API key is missing or invalid, or if there are issues connecting to the OpenAI API.


## Acknowledgments

- [Spring Boot](https://spring.io/projects/spring-boot)
- [OpenAI](https://www.openai.com/)
- [WebClient](https://docs.spring.io/spring/docs/current/javadoc-api/org/springframework/web/reactive/function/client/WebClient.html)
