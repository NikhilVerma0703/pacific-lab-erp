import { AppShell } from "@/components/shell/AppShell";
import { permissionsFor } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }} permissions={permissionsFor(user.role)}>
      {children}
    </AppShell>
  );
}
