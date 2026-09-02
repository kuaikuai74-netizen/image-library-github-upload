import { describe, expect, it } from "vitest";
import { onlineMessageCreateSchema } from "../lib/messages/message-schema";

describe("online message schema", () => {
  it("accepts a non-empty message up to 2000 characters", () => {
    expect(onlineMessageCreateSchema.parse({ body: "  需要补充一个素材分类。  " }).body).toBe("需要补充一个素材分类。");
    expect(onlineMessageCreateSchema.parse({ body: "a".repeat(2_000) }).body).toHaveLength(2_000);
  });

  it("rejects blank or oversized messages", () => {
    expect(() => onlineMessageCreateSchema.parse({ body: "   " })).toThrow();
    expect(() => onlineMessageCreateSchema.parse({ body: "a".repeat(2_001) })).toThrow();
  });
});
