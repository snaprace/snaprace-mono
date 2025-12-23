import { auth } from "@/server/auth";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session) {
    redirect(`/${locale}/admin/login`);
  }

  return (
    <AdminLayoutShell user={session.user as any}>
      {children}
    </AdminLayoutShell>
  );
}
