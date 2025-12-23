"use client";

import * as React from "react";
import { Command } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { organizerSidebarItems, superAdminSidebarItems } from "./sidebar-items";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const items = user.role === "SUPER_ADMIN" ? superAdminSidebarItems : organizerSidebarItems;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="size-4"><Command className="size-4" /></span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-lg">SnapRace</span>
                  <span className="truncate text-xs">Admin Console</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
