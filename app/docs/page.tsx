import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/server";
import { getVisibleDocumentPages } from "@/lib/content/repository";

function groupDocuments<T extends { category: string }>(documents: T[]) {
  const groups = new Map<string, T[]>();
  for (const document of documents) groups.set(document.category, [...(groups.get(document.category) ?? []), document]);
  return [...groups.entries()];
}

function renderDocumentBody(body: string) {
  return body.split(/\n{2,}/).map((block, index) => {
    const text = block.trim();
    if (!text) return null;
    if (text.startsWith("### ")) return <h4 key={index}>{text.slice(4)}</h4>;
    if (text.startsWith("## ")) return <h3 key={index}>{text.slice(3)}</h3>;
    if (text.startsWith("# ")) return <h2 key={index}>{text.slice(2)}</h2>;
    if (text.startsWith("- ")) {
      return <ul key={index}>{text.split("\n").map((line, itemIndex) => <li key={itemIndex}>{line.replace(/^-\s*/, "")}</li>)}</ul>;
    }
    return <p key={index}>{text}</p>;
  });
}

export default async function DocsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/docs");
  const documents = await getVisibleDocumentPages(user);
  const groups = groupDocuments(documents);

  return (
    <main className="docs-shell">
      <aside className="docs-rail" aria-label="文档分类">
        <Link className="admin-back" href="/"><ArrowLeft aria-hidden="true" />返回素材库</Link>
        <div className="admin-brand"><BookOpen aria-hidden="true" /><div><strong>使用文档</strong><small>按权限展示已发布内容</small></div></div>
        <nav>{groups.map(([category, items]) => <a href={`#${category}`} key={category}>{category}<span>{items.length}</span></a>)}</nav>
      </aside>
      <section className="docs-main">
        <header className="docs-header"><div><p>Documentation</p><h1>文档中心</h1></div><span>{user.name}</span></header>
        {documents.length ? groups.map(([category, items]) => <section className="docs-section" id={category} key={category} aria-labelledby={`docs-${category}`}><div className="docs-section-heading"><FileText aria-hidden="true" /><div><p>{items.length} 篇文档</p><h2 id={`docs-${category}`}>{category}</h2></div></div><div className="docs-list">{items.map((document) => <article key={document.id}><header><div><strong>{document.title}</strong><small>/{document.slug} · 更新 {document.updatedAt}</small></div></header><div className="docs-body">{renderDocumentBody(document.body)}</div></article>)}</div></section>) : <div className="docs-empty">暂无可查看文档。</div>}
      </section>
    </main>
  );
}
