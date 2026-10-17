import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { Forum } from "@/modules/forum/components/Forum";
import { listForumPosts } from "@/modules/forum/queries";

export const metadata = { title: "Forum" };
export const dynamic = "force-dynamic";

export default async function ForumPage() {
  const user = await requireUser();
  if (!can(user, "forum.view")) notFound();
  const posts = await listForumPosts();

  return (
    <>
      <PageHeader title="Forum" description="Announcements, questions and updates for the lab — post, reply and track status." />
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
