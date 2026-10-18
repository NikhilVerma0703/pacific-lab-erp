import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { Forum } from "@/modules/forum/components/Forum";
import { listForumPosts } from "@/modules/forum/queries";

export const metadata = { title: "Announcement" };
export const dynamic = "force-dynamic";

export default async function AnnouncementPage() {
  const user = await requireUser();
  if (!can(user, "forum.view")) notFound();
  const posts = await listForumPosts();

  return (
    <>
      <PageHeader title="Announcement" description="Announcements, questions and updates for the lab — post, reply and track status." />
      <Forum
        posts={posts}
        userId={user.id}
        isAdmin={user.role === "ADMIN"}
        canPost={can(user, "forum.post")}
        canReply={can(user, "forum.reply")}
        canStatus={can(user, "forum.status")}
      />
    </>
  );
}
