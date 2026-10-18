import { permanentRedirect } from "next/navigation";

/** The Forum was renamed Announcement — saved links keep working. */
export default function ForumPage() {
  permanentRedirect("/announcements");
}
