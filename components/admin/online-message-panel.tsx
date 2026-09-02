"use client";

import { LoaderCircle, MessageSquareText, RefreshCw, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";
import type { AdminOnlineMessageItem } from "@/lib/messages/repository";

type OnlineMessagePanelProps = {
  initialMessages: AdminOnlineMessageItem[];
};

async function readResponse<T>(response: Response) {
  const body = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "请求失败，请稍后重试。");
  return body.data;
}

export function OnlineMessagePanel({ initialMessages }: OnlineMessagePanelProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (showProgress = true) => {
    if (showProgress) setRefreshing(true);
    try {
      setMessages(await readResponse<AdminOnlineMessageItem[]>(await fetch("/api/admin/messages", { cache: "no-store" })));
      setError("");
    } catch (requestError) {
      if (showProgress) setError(requestError instanceof Error ? requestError.message : "刷新失败，请稍后重试。");
    } finally {
      if (showProgress) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => { void refresh(false); }, 10_000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  return (
    <div className="admin-message-module">
      <div className="admin-message-toolbar"><span>每 10 秒自动刷新</span><button className="admin-secondary-button" type="button" onClick={() => { void refresh(); }} disabled={refreshing}>{refreshing ? <LoaderCircle aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}刷新</button></div>
      {error && <p className="admin-storage-message" role="alert">{error}</p>}
      {messages.length ? <div className="admin-message-list">{messages.map((message) => <article key={message.id}><UserRound aria-hidden="true" /><div><header><strong>{message.authorName}</strong><small>{message.authorEmail} · {message.createdAt}</small></header><p>{message.body}</p></div></article>)}</div> : <div className="admin-empty"><MessageSquareText aria-hidden="true" />暂无用户留言。</div>}
    </div>
  );
}
