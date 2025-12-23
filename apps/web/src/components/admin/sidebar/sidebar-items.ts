import {
  LayoutDashboard,
  Users,
  Settings,
  Calendar,
  Image as ImageIcon,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const organizerSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 2,
    label: "Events",
    items: [
      {
        title: "My Events",
        url: "/admin/events",
        icon: Calendar,
      },
      {
        title: "Results",
        url: "/admin/results",
        icon: Trophy,
      },
      {
        title: "Photos",
        url: "/admin/photos",
        icon: ImageIcon,
      },
    ],
  },
  {
    id: 3,
    label: "Management",
    items: [
      {
        title: "Staff",
        url: "/admin/staff",
        icon: Users,
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

export const superAdminSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "System",
    items: [
      {
        title: "Global Stats",
        url: "/admin",
        icon: LayoutDashboard,
      },
      {
        title: "Organizations",
        url: "/admin/organizations",
        icon: Users,
      },
    ],
  },
];
