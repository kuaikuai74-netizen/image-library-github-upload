import { ZodError, type ZodType } from "zod";
import { AuthorizationError } from "@/lib/auth/server";
import { UploadError } from "@/lib/assets/upload-errors";
import { failure } from "@/lib/api/response";

export function parseQuery<T>(schema: ZodType<T>, searchParams: URLSearchParams) {
  return schema.parse(Object.fromEntries(searchParams.entries()));
}

export function routeFailure(error: unknown) {
  if (error instanceof AuthorizationError) return failure(error.message, "无权访问此资源。", error.status);
  if (error instanceof UploadError) return failure(error.code, error.message, error.status);
  if (error instanceof ZodError) return failure("INVALID_QUERY", "查询参数无效。", 400);
  return failure("INTERNAL_ERROR", "服务暂时不可用，请稍后重试。", 500);
}
