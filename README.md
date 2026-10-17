# Chatbot Spring Boot Application

A Spring Boot chatbot with a static web UI and the Gemini Developer API.

## Prerequisites

- Java 17
- Maven (or the included Maven wrapper, if present)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Configure and run

Set the API key as an environment variable. Do not commit API keys to source control.

macOS/Linux:
```sh
export GEMINI_API_KEY="your_gemini_api_key"
./mvnw spring-boot:run
```

Windows PowerShell:
```powershell
$env:GEMINI_API_KEY = "your_gemini_api_key"
.mvnw.cmd spring-boot:run
```

The default model is `gemini-2.5-flash-lite`. To override it, set `GEMINI_MODEL` to a model available to your Gemini API project.

Open [http://localhost:8080](http://localhost:8080) to use the chat interface.

## API

### `POST /chat`

Request:
```json
{
  "content": "Hello!"
}
```

Success response:
```json
{
  "response": "Hello! How can I help you today?"
}
```

Invalid or empty input returns HTTP 400. Missing configuration or upstream AI errors return HTTP 502 with an `error` field.

## Free-tier notes

Gemini API free-tier access and quotas vary by model, project, and account. Check the current quotas in Google AI Studio. The free tier is rate-limited and Google may use submitted content to improve its products under the free-tier terms; avoid sending secrets or sensitive personal information.

## Deployment

Configure `GEMINI_API_KEY` as a secret environment variable in your hosting provider. Never place the key in frontend JavaScript or commit it to the repository.
