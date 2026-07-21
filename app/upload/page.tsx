import { redirect } from "next/navigation";
import { UploadWorkspace } from "@/components/upload/upload-workspace";
import { hasAssetPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/server";

type UploadPageProps = { searchParams: Promise<{ assetGroupId?: string }> };

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/upload");
  if (!hasAssetPermission(user.role, "upload", { userId: user.id })) redirect("/");
  const { assetGroupId } = await searchParams;
  return <UploadWorkspace initialAssetGroupId={assetGroupId} />;
}
