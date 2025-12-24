import { auth } from "@/server/auth";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect(`/admin/login`);
  }

  return (
    <AdminLayoutShell user={session.user as any}>
      {children}
    </AdminLayoutShell>
  );
}
