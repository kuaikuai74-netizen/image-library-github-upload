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
  await expect(page.getByLabel("渠道")).toHaveText(/Amazon[\s\S]*多渠道/);
  await expect(page.getByLabel("品类")).toHaveText(/桌类[\s\S]*板式[\s\S]*户外[\s\S]*电竞椅[\s\S]*沙发[\s\S]*蹦床[\s\S]*宠物/);
  await expect(page.getByLabel("SPU")).toHaveAttribute("type", "text");
  await expect(page.getByLabel("国家")).toHaveText(/德国[\s\S]*英国[\s\S]*法国[\s\S]*意大利[\s\S]*西班牙[\s\S]*荷兰[\s\S]*波兰/);
  await expect(page.getByLabel("素材组")).toHaveText(/主副图[\s\S]*A\+详情页[\s\S]*品牌营销[\s\S]*其他/);
  await page.getByRole("button", { name: "ZIP 自动分国" }).click();
  await expect(page.getByText("ZIP 自动识别")).toBeVisible();
  await expect(page.getByRole("button", { name: "选择 ZIP 压缩包" })).toBeVisible();
  await page.getByRole("button", { name: "单国图片" }).click();
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
