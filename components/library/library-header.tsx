"use client";

import { Images, LogOut, Search, Upload, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { LibraryUser } from "@/lib/auth/roles";

type LibraryHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onUpload: () => void;
  currentUser: LibraryUser;
  roleLabel: string;
  canUpload: boolean;
};

export function LibraryHeader({ query, onQueryChange, onUpload, currentUser, roleLabel, canUpload }: LibraryHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand" aria-label="跨境电商视觉资产">
        <span className="brand-mark"><Images aria-hidden="true" /></span>
        <span>
          <strong>跨境电商视觉资产</strong>
          <small>集中管理跨境渠道图片素材</small>
        </span>
      </div>

      <label className="global-search">
        <Search aria-hidden="true" />
        <span className="sr-only">全局搜索</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索 SPU、文件名、SKU 或品类"
        />
      </label>

      <div className="header-actions">
        <ThemeToggle />
        {canUpload && <button className="upload-button" type="button" onClick={onUpload}>
          <Upload aria-hidden="true" />
          <span>上传素材</span>
        </button>}
        <button className="avatar" type="button" aria-label={`当前用户：${currentUser.name}`}>
          <UserRound aria-hidden="true" />
          <span><strong>{currentUser.name}</strong><small>{roleLabel}</small></span>
        </button>
        <button className="sign-out" type="button" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="退出登录"><LogOut aria-hidden="true" /></button>
      </div>
    </header>
  );
}
