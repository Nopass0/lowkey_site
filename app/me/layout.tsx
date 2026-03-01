"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

const routeTitles: Record<string, string> = {
  "/me": "Управление аккаунтом",
  "/me/billing": "Финансы и подписки",
  "/me/promo": "Активация промокодов",
  "/me/downloads": "Скачать приложение",
  "/me/devices": "Подключенные устройства",
};

export default function MeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentTitle = routeTitles[pathname] || "Панель управления";

  return (
    <SidebarProvider>
      {/* Hide the existing standard Sidebar on small screens entirely */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>
      <SidebarInset className="bg-muted/10 md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear bg-background/50 backdrop-blur-md sticky top-0 z-30 border-b border-border/50">
          <div className="flex items-center gap-2 px-4 w-full">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-lg p-2 hidden md:inline-flex" />
            <Separator
              orientation="vertical"
              className="mr-2 h-4 border-border hidden md:block"
            />
            <Breadcrumb className="hidden md:block">
              <BreadcrumbList>
                <BreadcrumbItem className="text-muted-foreground">
                  Панель управления
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-semibold text-sm tracking-tight text-foreground">
                    {currentTitle}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-8 p-4 md:p-10 pt-8 pb-24 md:pb-10 w-full max-w-[1400px] mx-auto">
          {children}
        </div>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}
