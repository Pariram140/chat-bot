const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
});

test("renders the chat UI and prompt suggestions", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "New chat" })).toBeVisible();
  await expect(page.getByLabel("Your message")).toBeVisible();
  await expect(page.getByRole("button", { name: "Explain a technical concept" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brainstorm an idea" })).toBeVisible();
});

test("suggestion fills the composer", async ({ page }) => {
  const input = page.getByLabel("Your message");
  await page.getByRole("button", { name: "Explain a technical concept" }).click();
  await expect(input).toHaveValue("Explain how Java HashMap works");
});

test("sends a message and renders the assistant response", async ({ page }) => {
  await page.route("**/chat", async route => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toEqual({ content: "CHAT TEST OK", history: [], memories: [] });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: "CHAT TEST OK" })
    });
  });

  await page.getByLabel("Your message").fill("CHAT TEST OK");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator("#messages").getByText("CHAT TEST OK").last()).toBeVisible();
  await expect(page.locator("#messages").getByText("Assistant", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your message")).toBeEnabled();
});

test("shows an error and re-enables input when the API fails", async ({ page }) => {
  await page.route("**/chat", route => route.fulfill({
    status: 502,
    contentType: "application/json",
    body: JSON.stringify({ error: "The assistant is temporarily unavailable." })
  }));

  await page.getByLabel("Your message").fill("trigger failure");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("The assistant is temporarily unavailable.")).toBeVisible();
  await expect(page.getByLabel("Your message")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
});

test("New chat starts a fresh view and previous conversation can be reopened", async ({ page }) => {
  await page.route("**/chat", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ response: "Test reply" })
  }));

  await page.getByLabel("Your message").fill("Hello");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Test reply")).toBeVisible();
  await page.locator("#clear-chat").click();
  await expect(page.getByText("Test reply")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Start with a question" })).toBeVisible();
  await page.getByRole("button", { name: "Hello", exact: true }).click();
  await expect(page.getByText("Test reply")).toBeVisible();
});

test("composer is usable on a mobile viewport", async ({ page }) => {
  await expect(page.getByLabel("Your message")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
});


test("conversation history survives a browser reload", async ({ page }) => {
  await page.route("**/chat", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ response: "Saved assistant answer" })
  }));
  await page.getByLabel("Your message").fill("Remember this conversation");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Saved assistant answer")).toBeVisible();
  await page.reload();
  await expect(page.locator("#messages").getByText("Remember this conversation", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved assistant answer")).toBeVisible();
});

test("saved memory is included in a new chat request", async ({ page }) => {
  await page.getByLabel("Memory to remember across chats").fill("My project uses Java 17");
  await page.getByRole("button", { name: "Save memory" }).click();
  await expect(page.getByText("My project uses Java 17")).toBeVisible();

  await page.route("**/chat", async route => {
    const body = route.request().postDataJSON();
    expect(body.memories).toContain("My project uses Java 17");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: "I will use that project context." })
    });
  });
  await page.locator("#clear-chat").click();
  await page.getByLabel("Your message").fill("What Java version does my project use?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("I will use that project context.")).toBeVisible();
});

test("sends prior conversation turns when asked what the user said before", async ({ page }) => {
  let requestNumber = 0;
  await page.route("**/chat", async route => {
    const body = route.request().postDataJSON();
    requestNumber += 1;

    if (requestNumber === 1) {
      expect(body.content).toBe("Test");
      expect(body.history).toEqual([]);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "Hello! Everything is working properly." })
      });
      return;
    }

    expect(body.content).toBe("What did I ask you before?");
    expect(body.history).toEqual([
      { role: "user", content: "Test" },
      { role: "assistant", content: "Hello! Everything is working properly." }
    ]);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: "You previously said: Test." })
    });
  });

  const input = page.getByLabel("Your message");
  await input.fill("Test");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Hello! Everything is working properly.")).toBeVisible();

  await input.fill("What did I ask you before?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("You previously said: Test.")).toBeVisible();
  expect(requestNumber).toBe(2);
});

test("a failed turn does not erase earlier context on the next request", async ({ page }) => {
  let requestNumber = 0;
  await page.route("**/chat", async route => {
    const body = route.request().postDataJSON();
    requestNumber += 1;

    if (requestNumber === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "I will remember this turn." })
      });
      return;
    }

    if (requestNumber === 2) {
      expect(body.history).toContainEqual({ role: "user", content: "Keep this context" });
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "The AI service could not complete the request." })
      });
      return;
    }

    expect(body.content).toBe("Try again");
    expect(body.history).toContainEqual({ role: "user", content: "Keep this context" });
    expect(body.history).toContainEqual({ role: "assistant", content: "I will remember this turn." });
    expect(body.history).not.toContainEqual({ role: "user", content: "failed request" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: "Earlier context is still available." })
    });
  });

  const input = page.getByLabel("Your message");
  await input.fill("Keep this context");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("I will remember this turn.")).toBeVisible();

  await input.fill("failed request");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("The AI service could not complete the request.")).toBeVisible();

  await input.fill("Try again");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Earlier context is still available.")).toBeVisible();
  expect(requestNumber).toBe(3);
});
