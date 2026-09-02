"use client";

import { LoaderCircle, MessageSquareText, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";
import type { OnlineMessageItem } from "@/lib/messages/repository";

type OnlineMessageWorkspaceProps = {
  initialMessages: OnlineMessageItem[];
};

async function readResponse<T>(response: Response) {
  const body = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "请求失败，请稍后重试。");
  return body.data;
}

export function OnlineMessageWorkspace({ initialMessages }: OnlineMessageWorkspaceProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      setMessages(await readResponse<OnlineMessageItem[]>(await fetch("/api/messages", { cache: "no-store" })));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "刷新失败，请稍后重试。");
    } finally {
      setRefreshing(false);
    }
  }

  async function submit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const message = await readResponse<OnlineMessageItem>(await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: content }),
      }));
      setMessages((current) => [message, ...current]);
      setContent("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "发送失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="message-workspace">
      <section className="message-panel" aria-labelledby="message-compose-title">
        <header className="message-panel-header">
          <div><span className="message-kicker">New Message</span><h1 id="message-compose-title">发送留言</h1></div>
          <div className="message-actions"><button className="message-refresh" type="button" onClick={() => { void refresh(); }} disabled={refreshing}>{refreshing ? <LoaderCircle aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}刷新</button><button className="message-submit" type="button" onClick={() => { void submit(); }} disabled={!content.trim() || submitting}>{submitting ? <LoaderCircle aria-hidden="true" /> : <Send aria-hidden="true" />}发送留言</button></div>
        </header>
        <label className="message-input"><span>留言内容</span><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2_000} placeholder="请输入问题详情，最多 2000 字" /></label>
        <div className="message-input-meta"><span>{content.length}/2000</span>{error && <p role="alert">{error}</p>}</div>
      </section>

      <section className="message-panel message-history" aria-labelledby="message-history-title">
        <header><div><span className="message-kicker">History</span><h2 id="message-history-title">我的留言记录</h2></div></header>
        {messages.length ? <div className="message-list">{messages.map((message) => <article key={message.id}><MessageSquareText aria-hidden="true" /><div><p>{message.body}</p><small>{message.createdAt}</small></div></article>)}</div> : <div className="message-empty">暂无留言记录</div>}
      </section>
    </div>
  );
}
