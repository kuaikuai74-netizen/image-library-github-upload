import { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";

export function success<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data }, { status });
}

export function failure(code: string, message: string, status: number) {
  return NextResponse.json<ApiFailure>({ error: { code, message } }, { status });
}
