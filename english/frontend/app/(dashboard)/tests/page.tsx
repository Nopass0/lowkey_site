"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Search, Filter, X, ChevronLeft, ChevronRight,
  HelpCircle, CheckSquare, GitMerge, Clock, BookOpen
} from "lucide-react";
import { socialApi } from "@/api/client";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const LEVELS = [
  { value: "", label: "Все уровни" },
  { value: "beginner", label: "A1 — Начинающий" },
  { value: "elementary", label: "A2 — Элементарный" },
  { value: "intermediate", label: "B1 — Средний" },
  { value: "upper-intermediate", label: "B2 — Выше среднего" },
  { value: "advanced", label: "C1 — Продвинутый" },
  { value: "proficient", label: "C2 — Свободный" },
];

const LEVEL_LABELS: Record<string, string> = {
  beginner: "A1",
  elementary: "A2",
  intermediate: "B1",
  "upper-intermediate": "B2",
  advanced: "C1",
  proficient: "C2",
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: "text-green-400 bg-green-400/10 border-green-400/20",
  elementary: "text-teal-400 bg-teal-400/10 border-teal-400/20",
  intermediate: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "upper-intermediate": "text-violet-400 bg-violet-400/10 border-violet-400/20",
  advanced: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  proficient: "text-red-400 bg-red-400/10 border-red-400/20",
};

function QuestionTypeIcon({ type }: { type: string }) {
  if (type === "multiple_choice") return <CheckSquare size={11} />;
  if (type === "match") return <GitMerge size={11} />;
  return <HelpCircle size={11} />;
}

function countByType(questions: any[]) {
  const counts: Record<string, number> = {};
  for (const q of questions) {
    const t = q.type || q.questionType || "single_choice";
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

function TestCard({ test }: { test: any }) {
  const router = useRouter();
  const questions: any[] = test.questions || [];
  const typeCounts = countByType(questions);
  const levelLabel = LEVEL_LABELS[test.courseLevel] || "A1";
  const levelColor = LEVEL_COLORS[test.courseLevel] || LEVEL_COLORS.beginner;

  const gradients = [
    "from-indigo-600 to-blue-700",
    "from-purple-600 to-violet-700",
    "from-emerald-600 to-teal-700",
    "from-amber-600 to-orange-700",
    "from-rose-600 to-pink-700",
  ];
  const grad = gradients[test.id.charCodeAt(0) % gradients.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={() => router.push(`/groups/${test.groupId}/courses/${test.courseId}/tests/${test.id}`)}
      className="glass-card rounded-2xl overflow-hidden cursor-pointer group"
    >
      {/* Color strip */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${grad}`} />

      <div className="p-4">
        {/* Course badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen size={11} />
            <span className="truncate max-w-[140px]">{test.courseTitle}</span>
          </div>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md border", levelColor)}>
            {levelLabel}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {test.title}
        </h3>

        {test.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{test.description}</p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/30">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <HelpCircle size={11} />
            {questions.length} вопросов
          </span>
          {test.timeLimitSeconds && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={11} />
              {Math.ceil(test.timeLimitSeconds / 60)} мин
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {Object.entries(typeCounts).slice(0, 2).map(([type]) => (
              <span key={type} className="p-1 rounded-md bg-accent/50 text-muted-foreground">
                <QuestionTypeIcon type={type} />
              </span>
            ))}
          </div>
        </div>

        {test.passingScore && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Проходной балл: <span className="font-semibold text-foreground">{test.passingScore}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function PublicTestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await socialApi.getPublicTests({ search, level, page, limit: 12 });
      setTests(data.tests || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      toast.error("Не удалось загрузить тесты");
    } finally {
      setLoading(false);
    }
  }, [search, level, page]);

  useEffect(() => { fetchTests(); }, [fetchTests]);
  useEffect(() => { setPage(1); }, [search, level]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList size={24} className="text-primary" />
            Публичные тесты
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0 ? `${total} тестов доступно` : "Проверяйте знания с тестами сообщества"}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border",
            showFilters
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-accent/50 border-border/40 text-muted-foreground hover:text-foreground"
          )}
        >
          <Filter size={14} />
          Фильтры
          {level && <span className="w-2 h-2 rounded-full bg-primary" />}
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск тестов..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 py-1">
                {LEVELS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setLevel(l.value === level ? "" : l.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border",
                      level === l.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-accent/50 border-border/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
              <div className="h-1.5 bg-muted/30" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-muted/30 rounded w-3/4" />
                <div className="h-4 bg-muted/30 rounded" />
                <div className="h-3 bg-muted/30 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
            <ClipboardList size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Тесты не найдены</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search || level
              ? "Попробуйте изменить фильтры"
              : "Публичные тесты появятся здесь из открытых курсов"}
          </p>
          {(search || level) && (
            <button
              onClick={() => { setSearch(""); setLevel(""); }}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tests.map(test => (
              <TestCard key={test.id} test={test} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let p = i + 1;
                  if (totalPages > 5) {
                    if (page <= 3) p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                        page === p
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
