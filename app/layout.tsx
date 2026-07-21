import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "跨境电商视觉资产",
  description: "跨境电商视觉资产管理系统",
};

const themeScript = `
(() => {
  try {
    const theme = localStorage.getItem("visual-asset-theme");
    document.documentElement.dataset.theme = theme === "light" || theme === "dark" ? theme : "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
