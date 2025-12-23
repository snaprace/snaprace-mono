"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";

interface AdminLayoutShellProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

export function AdminLayoutShell({ children, user }: AdminLayoutShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <h1 className="text-sm font-medium">Dashboard</h1>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
