import { AssetLibrary } from "@/components/library/asset-library";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getVisibleAnnouncements } from "@/lib/content/repository";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const announcements = await getVisibleAnnouncements(user);
  return <AssetLibrary currentUser={user} announcements={announcements} />;
}
