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
  await page.getByRole("button", { name: /New chat/ }).click();
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
  await expect(page.getByText("Remember this conversation")).toBeVisible();
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
  await page.getByRole("button", { name: /New chat/ }).click();
  await page.getByLabel("Your message").fill("What Java version does my project use?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("I will use that project context.")).toBeVisible();
});
