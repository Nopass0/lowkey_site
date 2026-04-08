"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, BookOpen, Brain, BookMarked, Gamepad2, Users,
  GraduationCap, Loader2, Command, ChevronRight, Sparkles,
  Plus, Mic, Zap, Flame, Target,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useCardsStore } from "@/store/cards";
import { apiClient } from "@/api/client";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

const PAGE_TITLES: Record<string, { title: string; sub?: string }> = {
  "/dashboard":     { title: "Главная" },
  "/study":         { title: "Карточки",       sub: "Интервальное повторение" },
  "/vocabulary":    { title: "Мои карточки",   sub: "Наборы и слова" },
  "/dictionary":    { title: "Переводчик",     sub: "Поиск слов и переводов" },
  "/grammar":       { title: "Грамматика",     sub: "Правила и упражнения" },
  "/pronunciation": { title: "Произношение",   sub: "Тренировка речи" },
  "/games":         { title: "Игры",           sub: "Ассоциации и практика" },
  "/quests":        { title: "Квесты",         sub: "AI ситуационные задания" },
  "/recordings":    { title: "Записи",         sub: "Мой речевой дневник" },
  "/writing":       { title: "Письмо",         sub: "Анализ грамматики AI" },
  "/progress":      { title: "Прогресс",       sub: "Статистика обучения" },
  "/settings":      { title: "Настройки" },
  "/premium":       { title: "Premium",        sub: "Планы подписки" },
  "/admin":         { title: "Администрирование", sub: "Управление платформой" },
  "/groups":        { title: "Группы",         sub: "Сообщества и курсы" },
};

type ActionItem = { label: string; href: string; icon: React.ElementType; accent?: string; bg?: string };

const PAGE_ACTIONS: Record<string, ActionItem[]> = {
  "/dashboard": [
    { label: "Учить карточки",   href: "/study",         icon: BookOpen },
    { label: "Добавить слова",   href: "/vocabulary",    icon: Plus },
    { label: "Тренировать речь", href: "/pronunciation", icon: Mic, accent: "text-violet-500" },
  ],
  "/vocabulary": [
    { label: "Начать изучение", href: "/study",      icon: BookOpen },
    { label: "Найти слово",     href: "/dictionary", icon: Search },
  ],
  "/study": [
    { label: "Все карточки", href: "/vocabulary", icon: Brain },
    { label: "Квесты",       href: "/quests",     icon: Zap, accent: "text-amber-500" },
  ],
  "/grammar": [
    { label: "Практиковать речь", href: "/pronunciation", icon: Mic },
    { label: "Квесты",            href: "/quests",        icon: Zap, accent: "text-amber-500" },
  ],
  "/pronunciation": [
    { label: "Записи",       href: "/recordings", icon: Mic },
    { label: "Словарь слов", href: "/vocabulary", icon: Brain },
  ],
  "/quests": [
    { label: "Грамматика",   href: "/grammar",       icon: BookOpen },
    { label: "Произношение", href: "/pronunciation", icon: Mic },
  ],
  "/dictionary": [
    { label: "Мои карточки", href: "/vocabulary", icon: Brain },
    { label: "Учить",        href: "/study",      icon: Zap, accent: "text-amber-500" },
  ],
  "/writing": [
    { label: "Грамматика",   href: "/grammar",       icon: BookOpen },
    { label: "Произношение", href: "/pronunciation", icon: Mic },
  ],
  "/games": [
    { label: "Квесты",       href: "/quests",     icon: Zap, accent: "text-amber-500" },
    { label: "Мои карточки", href: "/vocabulary", icon: Brain },
  ],
  "/groups": [
    { label: "Курсы",  href: "/groups?tab=courses", icon: GraduationCap },
    { label: "Тесты",  href: "/groups?tab=tests",   icon: BookMarked },
  ],
};

// ---------------------------------------------------------------------------
// Static game entries for search (no API endpoint)
// ---------------------------------------------------------------------------

const GAME_ENTRIES = [
  { id: "word-match",   title: "Совпадение слов",  sub: "Сопоставь слово с переводом", href: "/games?mode=word-match" },
  { id: "scramble",     title: "Перемешанные буквы", sub: "Составь слово из букв",     href: "/games?mode=scramble" },
  { id: "listening",    title: "Аудирование",       sub: "Угадай слово на слух",       href: "/games?mode=listening" },
  { id: "associations", title: "Ассоциации",        sub: "Ассоциативные связи",         href: "/games?mode=associations" },
  { id: "typing",       title: "Набор слов",        sub: "Печатай переводы быстро",     href: "/games?mode=typing" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchCategory = "decks" | "grammar" | "groups" | "games";

interface SearchResult {
  id: string;
  category: SearchCategory;
  title: string;
  sub: string;
  href: string;
}

interface GroupedResults {
  decks: SearchResult[];
  grammar: SearchResult[];
  groups: SearchResult[];
  games: SearchResult[];
}

const CATEGORY_META: Record<SearchCategory, { label: string; icon: React.ElementType; color: string }> = {
  decks:   { label: "Карточки",   icon: Brain,        color: "text-blue-500" },
  grammar: { label: "Грамматика", icon: BookOpen,     color: "text-violet-500" },
  groups:  { label: "Группы",     icon: Users,        color: "text-emerald-500" },
  games:   { label: "Игры",       icon: Gamepad2,     color: "text-amber-500" },
};

// ---------------------------------------------------------------------------
// Search modal
// ---------------------------------------------------------------------------

function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GroupedResults | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on open
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim().toLowerCase();
    if (!term) { setResults(null); setLoading(false); return; }

    setLoading(true);
    try {
      const [decksRes, grammarRes, groupsRes] = await Promise.allSettled([
        apiClient.get("/cards/decks").then((r) => r.data),
        apiClient.get("/grammar/topics").then((r) => r.data),
        apiClient.get("/social/groups").then((r) => r.data),
      ]);

      const toResults = <T extends object>(
        settled: PromiseSettledResult<T>,
        category: SearchCategory,
        extract: (item: any) => { id: string; title: string; sub: string; href: string } | null,
        filter: (item: any) => boolean,
      ): SearchResult[] => {
        if (settled.status !== "fulfilled") return [];
        const data = settled.value;
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.data)
            ? (data as any).data
            : Array.isArray((data as any)?.decks)
              ? (data as any).decks
              : Array.isArray((data as any)?.topics)
                ? (data as any).topics
                : Array.isArray((data as any)?.groups)
                  ? (data as any).groups
                  : [];
        return list
          .filter(filter)
          .slice(0, 5)
          .map((item) => {
            const extracted = extract(item);
            if (!extracted) return null;
            return { ...extracted, category } as SearchResult;
          })
          .filter(Boolean) as SearchResult[];
      };

      const deckResults = toResults(
        decksRes,
        "decks",
        (d) => ({
          id: d.id ?? d._id ?? String(Math.random()),
          title: d.name ?? d.title ?? "Набор",
          sub: `${d.cardCount ?? d.cards?.length ?? 0} карточек`,
          href: `/vocabulary?deck=${d.id ?? d._id}`,
        }),
        (d) => (d.name ?? d.title ?? "").toLowerCase().includes(term),
      );

      const grammarResults = toResults(
        grammarRes,
        "grammar",
        (t) => ({
          id: t.id ?? t._id ?? t.slug ?? String(Math.random()),
          title: t.title ?? t.name ?? "Тема",
          sub: t.level ?? t.description ?? "Грамматическая тема",
          href: `/grammar/${t.slug ?? t.id ?? t._id}`,
        }),
        (t) => (t.title ?? t.name ?? "").toLowerCase().includes(term),
      );

      const groupResults = toResults(
        groupsRes,
        "groups",
        (g) => ({
          id: g.id ?? g._id ?? String(Math.random()),
          title: g.name ?? "Группа",
          sub: `${g.memberCount ?? g.members?.length ?? 0} участников`,
          href: `/groups/${g.id ?? g._id}`,
        }),
        (g) => (g.name ?? "").toLowerCase().includes(term),
      );

      const gameResults: SearchResult[] = GAME_ENTRIES
        .filter((g) => g.title.toLowerCase().includes(term) || g.sub.toLowerCase().includes(term))
        .map((g) => ({ ...g, category: "games" as SearchCategory }));

      setResults({
        decks: deckResults,
        grammar: grammarResults,
        groups: groupResults,
        games: gameResults,
      });
    } catch {
      setResults({ decks: [], grammar: [], groups: [], games: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(val), 380);
  };

  const handleResultClick = (href: string) => {
    router.push(href);
    onClose();
  };

  const totalResults = results
    ? results.decks.length + results.grammar.length + results.groups.length + results.games.length
    : 0;

  const hasQuery = query.trim().length > 0;
  const isEmpty = hasQuery && !loading && results !== null && totalResults === 0;

  // Stagger variants
  const listVariants = {
    visible: { transition: { staggerChildren: 0.045 } },
    hidden:  {},
  };
  const itemVariants = {
    hidden:  { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  };

  const orderedCategories: SearchCategory[] = ["decks", "grammar", "groups", "games"];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="search-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="search-modal"
        initial={{ opacity: 0, scale: 0.96, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -12 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "fixed z-50 bg-background border border-border shadow-2xl overflow-hidden",
          // Desktop: centered command-palette
          "md:top-[12vh] md:left-1/2 md:-translate-x-1/2 md:w-[560px] md:max-h-[70vh] md:rounded-2xl",
          // Mobile: full screen
          "top-0 left-0 right-0 bottom-0 rounded-none md:bottom-auto",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {loading
            ? <Loader2 size={16} className="text-muted-foreground animate-spin flex-shrink-0" />
            : <Search size={16} className="text-muted-foreground flex-shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Поиск по карточкам, грамматике, играм..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Keyboard hint — desktop only */}
            <span className="hidden md:flex items-center gap-0.5 text-[10px] text-muted-foreground/40 font-mono select-none">
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border">esc</kbd>
            </span>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(100vh-140px)] md:max-h-[calc(70vh-56px)]">
          {/* Skeleton while loading */}
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-3"
              >
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div
                        className="h-3 bg-muted rounded-md animate-pulse"
                        style={{ width: `${55 + i * 8}%` }}
                      />
                      <div className="h-2.5 bg-muted/60 rounded-md animate-pulse w-1/3" />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Empty state */}
            {!loading && isEmpty && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6"
              >
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05, type: "spring", stiffness: 260, damping: 20 }}
                  className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"
                >
                  <Sparkles size={20} className="text-muted-foreground/50" />
                </motion.div>
                <p className="text-sm font-medium text-foreground">Не найдено</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
                  По запросу <span className="font-medium text-foreground">«{query}»</span> ничего не нашлось.
                  Попробуйте другое слово.
                </p>
              </motion.div>
            )}

            {/* Hint before query */}
            {!loading && !hasQuery && (
              <motion.div
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-1 p-4"
              >
                <p className="text-xs text-muted-foreground/60 px-1 mb-2">Быстрый переход</p>
                {[
                  { href: "/vocabulary", label: "Мои карточки",  icon: Brain,        color: "text-blue-500" },
                  { href: "/grammar",    label: "Грамматика",     icon: BookOpen,     color: "text-violet-500" },
                  { href: "/games",      label: "Игры",           icon: Gamepad2,     color: "text-amber-500" },
                  { href: "/groups",     label: "Группы",         icon: Users,        color: "text-emerald-500" },
                  { href: "/quests",     label: "Квесты",         icon: GraduationCap, color: "text-rose-500" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleResultClick(item.href)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-accent transition-colors text-left group"
                    >
                      <div className={cn("w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0", item.color)}>
                        <Icon size={13} />
                      </div>
                      <span className="text-sm text-foreground group-hover:text-foreground/90">{item.label}</span>
                      <ChevronRight size={12} className="ml-auto text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* Results grouped */}
            {!loading && results !== null && !isEmpty && (
              <motion.div
                key="results"
                variants={listVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                className="p-2"
              >
                {orderedCategories.map((cat) => {
                  const items = results[cat];
                  if (!items.length) return null;
                  const meta = CATEGORY_META[cat];
                  const CatIcon = meta.icon;
                  return (
                    <div key={cat} className="mb-1">
                      {/* Category label */}
                      <motion.div variants={itemVariants} className="flex items-center gap-2 px-3 py-1.5">
                        <CatIcon size={11} className={cn("flex-shrink-0", meta.color)} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {meta.label}
                        </span>
                      </motion.div>

                      {/* Items */}
                      {items.map((result) => {
                        const ResIcon = CATEGORY_META[result.category].icon;
                        return (
                          <motion.button
                            key={result.id}
                            variants={itemVariants}
                            onClick={() => handleResultClick(result.href)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-accent transition-colors text-left group"
                          >
                            <div
                              className={cn(
                                "w-7 h-7 rounded-lg bg-muted/80 flex items-center justify-center flex-shrink-0",
                                CATEGORY_META[result.category].color,
                              )}
                            >
                              <ResIcon size={13} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                              {result.sub && (
                                <p className="text-xs text-muted-foreground truncate">{result.sub}</p>
                              )}
                            </div>
                            <ChevronRight
                              size={12}
                              className="flex-shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors"
                            />
                          </motion.button>
                        );
                      })}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer hint — desktop */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2.5 border-t border-border/50 bg-muted/30">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-mono">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60">↵</kbd>
            <span className="ml-1">перейти</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-mono ml-auto">
            <Command size={9} />
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60">K</kbd>
            <span className="ml-1">поиск</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Topbar
// ---------------------------------------------------------------------------

export function Topbar({ title }: { title?: string }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const { dueCards } = useCardsStore();

  // Normalise pathname — strip query params for lookup
  const basePath = pathname.split("?")[0];
  const pageInfo = PAGE_TITLES[basePath] || { title: title || "" };
  const actions: ActionItem[] = [...(PAGE_ACTIONS[basePath] || [])];

  if (basePath !== "/study" && dueCards.length > 0) {
    const studyAction: ActionItem = {
      label: `Повторить ${dueCards.length}`,
      href: "/study",
      icon: Flame,
      accent: "text-orange-500",
      bg: "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400",
    };
    const idx = actions.findIndex((a) => a.href === "/study");
    if (idx === -1) actions.unshift(studyAction);
    else actions[idx] = studyAction;
  }

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header
        className="fixed top-0 right-0 left-0 md:left-60 h-14 border-b bg-background/90 backdrop-blur-xl flex items-center px-4 md:px-5 z-30 gap-3 md:gap-4"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        {/* Page title */}
        <div className="flex items-baseline gap-2 flex-shrink-0">
          {pageInfo.title && (
            <>
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                {pageInfo.title}
              </h1>
              {pageInfo.sub && (
                <>
                  <ChevronRight size={11} className="text-muted-foreground/40 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[180px]">
                    {pageInfo.sub}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Context action pills */}
        <AnimatePresence mode="wait">
          {actions.length > 0 && (
            <motion.div
              key={basePath}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-1.5 flex-1 overflow-hidden"
            >
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href}>
                    <motion.div
                      whileTap={{ scale: 0.96 }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                        action.bg ||
                          "bg-accent/70 hover:bg-accent text-muted-foreground hover:text-foreground border border-transparent hover:border-border/40",
                        "transition-colors duration-150 cursor-pointer whitespace-nowrap",
                      )}
                    >
                      <Icon size={11} className={action.accent || "text-muted-foreground"} />
                      {action.label}
                    </motion.div>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spacer when no actions */}
        {actions.length === 0 && <div className="flex-1" />}

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search button with Cmd+K hint */}
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              "flex items-center gap-2 h-8 rounded-xl transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              "px-2.5",
            )}
            aria-label="Открыть поиск (Cmd+K)"
          >
            <Search size={14} />
            <span className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40">
              <Command size={9} />
              <span>K</span>
            </span>
          </button>

          {/* Streak + goal badge */}
          {user && (
            <div className="hidden md:flex items-center gap-2">
              {(user.studyStreak || 0) > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/15 text-xs font-semibold text-orange-500">
                  <Flame size={11} />
                  <span>{user.studyStreak}</span>
                </div>
              )}
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/70 text-xs font-medium text-muted-foreground border border-border/30">
                <Target size={11} className="text-emerald-500" />
                <span>{user.dailyGoal || 20}/день</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Global search modal */}
      <AnimatePresence>
        {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
