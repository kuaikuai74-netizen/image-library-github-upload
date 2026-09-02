import { z } from "zod";

export const onlineMessageCreateSchema = z.object({
  body: z.string().trim().min(1, "请输入留言内容。").max(2_000, "留言内容不能超过 2000 字。"),
});

export type OnlineMessageCreateInput = z.infer<typeof onlineMessageCreateSchema>;
