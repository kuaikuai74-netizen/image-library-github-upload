import { expect, test } from "@playwright/test";

const administratorEmail = process.env.E2E_ADMIN_EMAIL;
const administratorPassword = process.env.E2E_ADMIN_PASSWORD;

test.beforeAll(() => {
  if (!administratorEmail || !administratorPassword) {
    throw new Error("E2E tests require E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a seeded administrator.");
  }
});

test("administrator manages an uploaded asset from login through sign-out", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("用户名或邮箱").fill(administratorEmail ?? "");
  await page.getByLabel("密码").fill(administratorPassword ?? "");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("banner").getByText("跨境电商视觉资产")).toBeVisible();

  await page.getByRole("button", { name: "上传素材" }).click();
  await expect(page.getByRole("heading", { name: "上传静态素材" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: `e2e-${Date.now()}.png`,
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/gJ+Oc3nAAAAAElFTkSuQmCC", "base64"),
  });
  await page.getByRole("button", { name: /上传 1 个文件/ }).click();
  await expect(page.getByText("状态：ACTIVE")).toBeVisible();

  await page.getByRole("button", { name: "返回素材库" }).click();
  await expect(page.getByPlaceholder("搜索 SPU、文件名、SKU 或品类")).toBeVisible();
  await page.getByPlaceholder("搜索 SPU、文件名、SKU 或品类").fill("e2e-");
  await expect(page.locator('[aria-label^="预览"]').first()).toBeVisible();
  await page.locator('[aria-label^="预览"]').first().click();
  await page.getByLabel("颜色").fill("E2E 蓝");
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.getByText("素材信息已保存。")).toBeVisible();

  await page.locator('[aria-label^="预览"]').first().click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载原图" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "移入回收站" }).click();
  await expect(page.getByText("素材已移入回收站。")).toBeVisible();

  await page.getByRole("button", { name: "回收站" }).click();
  await expect(page.getByRole("heading", { name: "回收站" })).toBeVisible();
  await page.getByRole("button", { name: "恢复" }).first().click();
  await expect(page.getByText("素材已恢复。")).toBeVisible();
  await page.getByRole("button", { name: "关闭回收站" }).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByRole("heading", { name: "登录跨境电商视觉资产" })).toBeVisible();
});
