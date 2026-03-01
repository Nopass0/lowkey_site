"use client";

import {
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Moon,
  Sun,
  UserCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { useTheme } from "@/hooks/useTheme";
import { Skeleton } from "@/components/ui/skeleton";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { user, logout } = useAuth();
  const { profile, isLoading } = useUser();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  if (!user) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback
                  className="rounded-lg text-primary-foreground font-bold"
                  style={{
                    backgroundColor: `#${user.avatarHash.substring(0, 6)}`,
                  }}
                >
                  {user.login.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.login}</span>
                {isLoading ? (
                  <Skeleton className="h-3 w-16" />
                ) : profile?.subscription ? (
                  <span className="truncate text-xs text-primary font-medium">
                    {profile.subscription.planName}
                  </span>
                ) : (
                  <span className="truncate text-xs text-muted-foreground">
                    Без подписки
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback
                    className="rounded-lg text-primary-foreground font-bold"
                    style={{
                      backgroundColor: `#${user.avatarHash.substring(0, 6)}`,
                    }}
                  >
                    {user.login.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.login}</span>
                  <span className="truncate text-xs font-mono">
                    {profile?.balance || 0} ₽
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={toggleTheme}
                className="cursor-pointer"
              >
                {theme === "dark" ? (
                  <Sun className="mr-2 size-4" />
                ) : (
                  <Moon className="mr-2 size-4" />
                )}
                {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/me/billing")}
                className="cursor-pointer"
              >
                <CreditCard className="mr-2 size-4" />
                Кошелек
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer font-medium"
              onClick={() => {
                logout();
                router.push("/");
              }}
            >
              <LogOut className="mr-2 size-4" />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
