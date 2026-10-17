# Chatbot Spring Boot Application

A Spring Boot chatbot with a static web UI and the Gemini Developer API.

## Prerequisites

- Java 17
- Maven 3.8+ (the repository does not currently include the Maven wrapper)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Configure and run

Set the API key as an environment variable. Do not commit API keys to source control.

macOS/Linux:
```sh
export GEMINI_API_KEY="your_gemini_api_key"
mvn spring-boot:run
```

Windows PowerShell:
```powershell
$env:GEMINI_API_KEY = "your_gemini_api_key"
mvn spring-boot:run
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

## Continuous integration

GitHub Actions runs `mvn --batch-mode --no-transfer-progress verify` on pull requests targeting `main` and pushes to `main`. This builds the application and runs automated tests. The build does not need a Gemini API key because it does not make live Gemini requests.

## Free-tier notes

Gemini API free-tier access and quotas vary by model, project, and account. Check the current quotas in Google AI Studio. The free tier is rate-limited and Google may use submitted content to improve its products under the free-tier terms; avoid sending secrets or sensitive personal information.

## Deployment

Configure `GEMINI_API_KEY` as a secret environment variable in your hosting provider. Never place the key in frontend JavaScript or commit it to the repository.

## Deploy for free on Render

This repository includes a `Dockerfile` and `render.yaml` for a Render web service. The free instance is suitable for a hobby/demo deployment, not production.

1. Push or merge the deployment files to `main`.
2. Sign in to [Render](https://dashboard.render.com/) and choose **New → Blueprint**.
3. Connect this GitHub repository and select the `main` branch. Render reads `render.yaml`.
4. When prompted, enter your Gemini API key as the secret value for `GEMINI_API_KEY`. Do not put the key in Git or frontend code.
5. Create the service and follow the deploy logs. Once healthy, open the `onrender.com` URL.
6. Test the UI with a simple prompt. For a direct API check, send a POST request to `/chat` with JSON `{"content":"Reply with the word OK"}`.

Example API check:
```sh
curl -i -X POST "https://YOUR-SERVICE.onrender.com/chat" \
  -H "Content-Type: application/json" \
  -d '{"content":"Reply with the word OK"}'
```

The expected success response is HTTP 200 with a JSON `response` field. HTTP 502 generally indicates missing/invalid API-key configuration, Gemini quota exhaustion, or an upstream API error; inspect the Render service logs for details.

### Free-plan caveats

- Free web services sleep after 15 minutes without inbound traffic; the first request after sleeping can take about a minute to wake up.
- Free instances have limited CPU/RAM and monthly included usage. Keep an eye on the Render dashboard and Gemini API quotas.
- The GitHub Actions workflow checks compilation and automated tests; it does not call Gemini. A live chat test requires a configured API key and consumes Gemini quota.
