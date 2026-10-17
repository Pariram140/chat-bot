const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the chat UI and prompt suggestions", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "What can I help with?" })).toBeVisible();
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
    expect(request.postDataJSON()).toEqual({ content: "CHAT TEST OK" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: "CHAT TEST OK" })
    });
  });

  await page.getByLabel("Your message").fill("CHAT TEST OK");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("CHAT TEST OK").last()).toBeVisible();
  await expect(page.getByText("Assistant", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your message")).toBeEnabled();
});

test("shows an error and re-enables input when the API fails", async ({ page }) => {
  await page.route("**/chat", route => route.fulfill({
    status: 502,
    contentType: "application/json",
    body: JSON.stringify({ message: "The assistant is temporarily unavailable." })
  }));

  await page.getByLabel("Your message").fill("trigger failure");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("The assistant is temporarily unavailable.")).toBeVisible();
  await expect(page.getByLabel("Your message")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
});

test("New chat clears the conversation", async ({ page }) => {
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
});

test("composer is usable on a mobile viewport", async ({ page }) => {
  await expect(page.getByLabel("Your message")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
});
