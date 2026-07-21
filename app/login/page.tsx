import { Images } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth/server";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-top">
          <span className="login-mark"><Images aria-hidden="true" /></span>
          <ThemeToggle />
        </div>
        <p>跨境电商视觉资产</p>
        <h1 id="login-title">登录跨境电商视觉资产</h1>
        <LoginForm callbackUrl={safeCallbackUrl} />
      </section>
    </main>
  );
}
