"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  Gamepad2,
  TrendingUp,
  Settings,
  Crown,
  Shield,
  BookMarked,
  Swords,
  Search,
  Volume2,
  PenLine,
  ChevronRight,
  ChevronDown,
  Star,
  Flame,
  Zap,
  LogOut,
  Sun,
  Moon,
  Users,
  GraduationCap,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

const navGroups = [
  {
    label: "Обучение",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Главная" },
      { href: "/study", icon: BookOpen, label: "Карточки" },
      { href: "/vocabulary", icon: Brain, label: "Словарь" },
      { href: "/dictionary", icon: Search, label: "Переводчик" },
      { href: "/grammar", icon: BookMarked, label: "Грамматика" },
    ],
  },
  {
    label: "Практика",
    items: [
      { href: "/pronunciation", icon: Volume2, label: "Произношение" },
      { href: "/games", icon: Gamepad2, label: "Игры" },
      { href: "/quests", icon: Swords, label: "Квесты" },
      { href: "/writing", icon: PenLine, label: "Письмо" },
    ],
  },
  {
    label: "Сообщество",
    items: [
      { href: "/groups", icon: Users, label: "Группы" },
      {
        href: "/courses",
        icon: GraduationCap,
        label: "Публичные курсы",
      },
      { href: "/tests", icon: ClipboardList, label: "Тесты" },
    ],
  },
  {
    label: "Аналитика",
    items: [
      { href: "/progress", icon: TrendingUp, label: "Прогресс" },
      { href: "/settings", icon: Settings, label: "Настройки" },
    ],
  },
];

function NavGroup({
  group,
  pathname,
}: {
  group: (typeof navGroups)[number];
  pathname: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 mb-1 group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 group-hover:text-muted-foreground/90 transition-colors">
          {group.label}
        </span>
        <motion.div
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.18 }}
        >
          <ChevronDown
            size={11}
            className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors"
          />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="items"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    !item.href.includes("?") &&
                    pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                      )}
                    >
                      <Icon
                        size={15}
                        className={cn(
                          "flex-shrink-0",
                          isActive ? "text-primary" : "",
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="nav-dot"
                          className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"
                        />
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const planLabel = user?.isPremium ? "Premium" : "Бесплатный";
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const lvl =
    user?.level === "beginner"
      ? "A1"
      : user?.level === "intermediate"
        ? "B1"
        : user?.level === "advanced"
          ? "C1"
          : "A1";

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-full w-60 flex-col z-40 border-r"
      style={{
        background: "hsl(var(--sidebar))",
        borderColor: "hsl(var(--sidebar-border))",
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 flex-shrink-0">
            <img
              src="/logo.svg"
              alt="LowKey English"
              width={36}
              height={36}
              className="w-9 h-9 object-contain rounded-lg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="leading-none">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              LowKey
            </div>
            <div className="font-bold text-base tracking-tight gradient-text">
              English
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-4 py-2">
        {navGroups.map((group) => (
          <NavGroup key={group.label} group={group} pathname={pathname} />
        ))}

        {user?.role === "admin" && (
          <div>
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Система
            </div>
            <div className="space-y-0.5">
              <Link href="/admin">
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                    pathname.startsWith("/admin")
                      ? "bg-violet-500/10 text-violet-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <Shield size={15} className="flex-shrink-0" />
                  <span className="flex-1 truncate">Администрирование</span>
                  {pathname.startsWith("/admin") && (
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                  )}
                </motion.div>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div
        className="px-3 pb-4 space-y-2 border-t pt-3"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        {/* Premium CTA (free users only) */}
        {user && !user.isPremium && (
          <Link href="/premium">
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/25 cursor-pointer"
            >
              <Crown size={13} className="text-amber-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex-1">
                Получить Premium
              </span>
              <ChevronRight
                size={11}
                className="text-amber-500/60 flex-shrink-0"
              />
            </motion.div>
          </Link>
        )}

        {/* Theme toggle + logout */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            <span>{theme === "dark" ? "Светлая" : "Тёмная"}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Выйти"
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Profile card */}
        {user && (
          <Link href="/settings">
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                "p-3 rounded-2xl border cursor-pointer transition-all mt-2",
                user.isPremium
                  ? "bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/20 premium-glow"
                  : "bg-accent/50 border-border/40 hover:border-border",
              )}
            >
              {/* Avatar + name row */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shadow-sm overflow-hidden">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        className="w-10 h-10 rounded-full object-cover"
                        alt={user.name}
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  {user.isPremium && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm ring-2 ring-background">
                      <Crown size={8} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate leading-tight">
                    {user.name}
                  </div>
                  <div
                    className={cn(
                      "text-[10px] font-semibold mt-0.5 flex items-center gap-1",
                      user.isPremium
                        ? "text-amber-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {user.isPremium && <Crown size={9} />}
                    {planLabel}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-background/50 py-1.5 px-1">
                  <div className="flex items-center gap-0.5 text-orange-500">
                    <Flame size={11} />
                    <span className="text-[12px] font-bold leading-none">
                      {user.studyStreak || 0}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted-foreground leading-none">
                    серия
                  </div>
                </div>
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-background/50 py-1.5 px-1">
                  <div className="flex items-center gap-0.5 text-yellow-500">
                    <Star size={11} />
                    <span className="text-[12px] font-bold leading-none">
                      {(user.xp || 0) >= 1000
                        ? `${Math.floor((user.xp || 0) / 1000)}k`
                        : user.xp || 0}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted-foreground leading-none">
                    XP
                  </div>
                </div>
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-background/50 py-1.5 px-1">
                  <div className="flex items-center gap-0.5 text-blue-500">
                    <Zap size={11} />
                    <span className="text-[12px] font-bold leading-none">
                      {lvl}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted-foreground leading-none">
                    уровень
                  </div>
                </div>
              </div>
            </motion.div>
          </Link>
        )}
      </div>
    </aside>
  );
}
