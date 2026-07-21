"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      identifier: formData.get("identifier"),
      password: formData.get("password"),
      redirect: false,
    });
    setIsSubmitting(false);

    if (!result?.ok) {
      setError("用户名或密码错误，请重试。");
      return;
    }

    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        <span>用户名或邮箱</span>
        <input name="identifier" type="text" autoComplete="username" required />
      </label>
      <label>
        <span>密码</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="login-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LockKeyhole aria-hidden="true" /> : <LogIn aria-hidden="true" />}
        {isSubmitting ? "验证中" : "登录"}
      </button>
    </form>
  );
}
