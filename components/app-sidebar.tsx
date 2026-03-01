"use client";

import * as React from "react";
import {
  CreditCard,
  Download,
  Gift,
  Home,
  Laptop,
  VenetianMask,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import Link from "next/link";

const data = {
  navMain: [
    {
      title: "Кабинет",
      url: "/me",
      icon: Home,
    },
    {
      title: "Финансы",
      url: "/me/billing",
      icon: CreditCard,
    },
    {
      title: "Промокоды",
      url: "/me/promo",
      icon: Gift,
    },
    {
      title: "Приложения",
      url: "/me/downloads",
      icon: Download,
    },
    {
      title: "Устройства",
      url: "/me/devices",
      icon: Laptop,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/50 bg-background/50 backdrop-blur-xl"
      {...props}
    >
      <SidebarHeader className="pt-6 pb-2 px-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-transparent cursor-pointer"
            >
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shadow-md shadow-primary/20 shrink-0">
                  <VenetianMask className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight ml-2">
                  <span className="truncate font-bold text-[15px] tracking-tight text-foreground">
                    lowkey
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                    Workspace
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-3 mt-8">
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="p-3 pb-6">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
