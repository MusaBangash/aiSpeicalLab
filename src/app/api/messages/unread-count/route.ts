/** GET /api/messages/unread-count — poll target for the login toast; also read by the student layout's nav badge. */
import { auth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/messages";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await getUnreadCount(session.user.id);
  return Response.json({ count });
}
