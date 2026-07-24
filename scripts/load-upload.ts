import sharp from "sharp";

type ApiSuccess<T> = { data: T };
type ApiFailure = { error: { code: string; message: string } };
type UserCredential = { identifier: string; password: string };
type Channel = { id: string; name: string };
type Category = { id: string; name: string };
type UploadResponse = { status: string; files: Array<{ status: string; assetId: string | null; errorMessage: string | null }> };

const baseUrl = process.env.LOAD_BASE_URL ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const uploadsPerUser = positiveInteger("LOAD_UPLOADS_PER_USER", 10);
const filesPerUpload = positiveInteger("LOAD_FILES_PER_UPLOAD", 2);
const clientConcurrency = positiveInteger("LOAD_CLIENT_CONCURRENCY", 5);
const assetType = process.env.LOAD_ASSET_TYPE ?? "主副图";
const countryCode = process.env.LOAD_COUNTRY_CODE ?? "DE";

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function parseUsers() {
  if (process.env.LOAD_USERS_JSON) return JSON.parse(process.env.LOAD_USERS_JSON) as UserCredential[];
  const identifier = process.env.LOAD_ADMIN_EMAIL ?? process.env.E2E_ADMIN_EMAIL;
  const password = process.env.LOAD_ADMIN_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("Set LOAD_USERS_JSON or LOAD_ADMIN_EMAIL/LOAD_ADMIN_PASSWORD before running upload load tests.");
  return [{ identifier, password }];
}

function extractSetCookies(headers: Headers) {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  const cookies = withGetter.getSetCookie?.();
  if (cookies?.length) return cookies;
  const cookieHeader = headers.get("set-cookie");
  return cookieHeader ? cookieHeader.split(/,(?=[^;,]+=)/) : [];
}

function mergeCookies(current: string, headers: Headers) {
  const jar = new Map(current.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return [part.slice(0, separator), part.slice(separator + 1)] as const;
  }));
  for (const cookie of extractSetCookies(headers)) {
    const pair = cookie.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function requestJson<T>(url: string, cookie: string) {
  const response = await fetch(`${baseUrl}${url}`, { headers: { cookie }, cache: "no-store" });
  const body = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : `Request failed: ${url}`);
  return body.data;
}

async function login({ identifier, password }: UserCredential) {
  let cookie = "";
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`, { cache: "no-store" });
  cookie = mergeCookies(cookie, csrfResponse.headers);
  const csrfBody = await csrfResponse.json() as { csrfToken: string };
  const body = new URLSearchParams({ csrfToken: csrfBody.csrfToken, identifier, password, callbackUrl: baseUrl, json: "true" });
  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie },
    body,
    redirect: "manual",
  });
  cookie = mergeCookies(cookie, loginResponse.headers);
  if (!loginResponse.ok && loginResponse.status !== 302) throw new Error(`Login failed for ${identifier}: ${loginResponse.status}`);
  return cookie;
}

async function createImage(userIndex: number, uploadIndex: number, fileIndex: number) {
  return sharp({
    create: {
      width: 32 + fileIndex,
      height: 24 + uploadIndex,
      channels: 3,
      background: { r: 40 + userIndex * 20, g: 100 + uploadIndex * 3, b: 160 + fileIndex * 20 },
    },
  }).png().toBuffer();
}

async function uploadBatch(cookie: string, userIndex: number, uploadIndex: number, channelId: string, categoryId: string) {
  const form = new FormData();
  form.set("channelId", channelId);
  form.set("categoryId", categoryId);
  form.set("spu", `LOAD-${Date.now()}-${userIndex}-${uploadIndex}`);
  form.set("countryCode", countryCode);
  form.set("assetType", assetType);
  form.set("idempotencyKey", crypto.randomUUID());
  form.set("metadata", JSON.stringify(Array.from({ length: filesPerUpload }, (_item, fileIndex) => ({ assetType, color: "load-test", sortOrder: fileIndex + 1 }))));
  for (let fileIndex = 0; fileIndex < filesPerUpload; fileIndex += 1) {
    const image = await createImage(userIndex, uploadIndex, fileIndex);
    form.append("files", new File([Uint8Array.from(image)], `load-${userIndex}-${uploadIndex}-${fileIndex}.png`, { type: "image/png" }));
  }
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/uploads/context`, { method: "POST", headers: { cookie }, body: form });
  const elapsedMs = performance.now() - started;
  const body = await response.json() as ApiSuccess<UploadResponse> | ApiFailure;
  if (!response.ok || "error" in body) return { ok: false, elapsedMs, message: "error" in body ? body.error.message : `HTTP ${response.status}` };
  const failedFiles = body.data.files.filter((file) => file.status !== "ACTIVE");
  return { ok: failedFiles.length === 0, elapsedMs, message: failedFiles[0]?.errorMessage ?? body.data.status };
}

async function worker<T>(items: T[], concurrency: number, run: (item: T) => Promise<void>) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await run(items[index]);
    }
  }));
}

async function main() {
  const users = parseUsers();
  console.log(`Upload load test target: ${baseUrl}`);
  console.log(`Users: ${users.length}; uploads/user: ${uploadsPerUser}; files/upload: ${filesPerUpload}; client concurrency: ${clientConcurrency}`);
  const cookies = await Promise.all(users.map(login));
  const channels = await requestJson<Channel[]>("/api/channels", cookies[0]);
  const categories = await requestJson<Category[]>("/api/categories", cookies[0]);
  const channel = channels[0];
  const category = categories[0];
  if (!channel || !category) throw new Error("Seed at least one channel and category before load testing.");

  const jobs = cookies.flatMap((cookie, userIndex) => Array.from({ length: uploadsPerUser }, (_item, uploadIndex) => ({ cookie, userIndex, uploadIndex })));
  const results: Array<{ ok: boolean; elapsedMs: number; message: string }> = [];
  await worker(jobs, clientConcurrency, async (job) => {
    results.push(await uploadBatch(job.cookie, job.userIndex, job.uploadIndex, channel.id, category.id));
  });

  const elapsed = results.map((result) => result.elapsedMs).sort((left, right) => left - right);
  const percentile = (value: number) => elapsed[Math.min(elapsed.length - 1, Math.floor((elapsed.length - 1) * value))] ?? 0;
  const failed = results.filter((result) => !result.ok);
  console.log(`Requests: ${results.length}; succeeded: ${results.length - failed.length}; failed: ${failed.length}`);
  console.log(`Latency ms: p50=${percentile(0.5).toFixed(0)} p95=${percentile(0.95).toFixed(0)} max=${(elapsed.at(-1) ?? 0).toFixed(0)}`);
  if (failed.length) {
    console.error("Failures:");
    failed.slice(0, 10).forEach((failure) => console.error(`- ${failure.message}`));
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
