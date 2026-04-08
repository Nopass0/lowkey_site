"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenLine, Sparkles, RotateCcw, CheckCircle2, AlertCircle,
  BookOpen, ChevronDown, ChevronUp, Loader2, History, X, Copy,
  ChevronLeft, ChevronRight, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { aiApi } from "@/api/client";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrammarError {
  text: string;
  correction: string;
  explanation: string;
  type: "grammar" | "spelling" | "style" | "punctuation";
  offset: number;
  length: number;
}

interface SentenceStructure {
  subject?: string;
  verb?: string;
  object?: string;
  complement?: string;
  adverbial?: string;
}

interface SentenceAnalysis {
  text: string;
  structure?: SentenceStructure;
  issues?: string[];
  isCorrect?: boolean;
}

interface GrammarRule {
  rule: string;
  category: string;
  status: "violated" | "ok" | "suggestion";
  examples?: string[];
}

interface AnalysisResult {
  score: number;
  grade: string;
  errors: GrammarError[];
  strengths: string[];
  improvements: string[];
  correctedText: string;
  wordCount: number;
  readabilityLevel: string;
  sentences?: SentenceAnalysis[];
  grammarRules?: GrammarRule[];
}

interface HistoryEntry {
  id: string;
  text: string;
  result: AnalysisResult;
  date: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPTS = [
  "Describe a place you visited recently or would love to visit",
  "Write about your job or studies in English",
  "Tell me about your hobbies and what you do in your free time",
  "Write a letter to a friend about your weekend plans",
  "Describe your perfect day from morning to night",
  "What do you think about technology and artificial intelligence?",
  "Write about a challenge you overcame and what you learned",
  "Describe your hometown and what makes it special",
];

const ERROR_COLORS: Record<string, string> = {
  grammar: "bg-red-500/20 border-red-500/40 text-red-400",
  spelling: "bg-orange-500/20 border-orange-500/40 text-orange-400",
  style: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  punctuation: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400",
};

const ERROR_UNDERLINE: Record<string, string> = {
  grammar: "border-red-500 bg-red-500/10 hover:bg-red-500/20",
  spelling: "border-orange-500 bg-orange-500/10 hover:bg-orange-500/20",
  style: "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20",
  punctuation: "border-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20",
};

const ERROR_DOT: Record<string, string> = {
  grammar: "bg-red-500",
  spelling: "bg-orange-500",
  style: "bg-blue-500",
  punctuation: "bg-yellow-500",
};

const GRADE_COLOR: Record<string, string> = {
  "A+": "text-emerald-400", "A": "text-emerald-500",
  "B+": "text-blue-400",   "B": "text-blue-500",
  "C+": "text-yellow-400", "C": "text-yellow-500",
  "D": "text-orange-500",  "F": "text-red-500",
};

const GRADE_BG: Record<string, string> = {
  "A+": "from-emerald-500/20 to-emerald-500/5",
  "A":  "from-emerald-500/20 to-emerald-500/5",
  "B+": "from-blue-500/20 to-blue-500/5",
  "B":  "from-blue-500/20 to-blue-500/5",
  "C+": "from-yellow-500/20 to-yellow-500/5",
  "C":  "from-yellow-500/20 to-yellow-500/5",
  "D":  "from-orange-500/20 to-orange-500/5",
  "F":  "from-red-500/20 to-red-500/5",
};

const RULE_CATEGORY_COLORS: Record<string, string> = {
  "Articles":               "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "Tenses":                 "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Prepositions":           "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Subject-Verb Agreement": "bg-red-500/15 text-red-400 border-red-500/30",
  "Word Order":             "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Punctuation":            "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

const STRUCTURE_LABELS: Record<keyof SentenceStructure, string> = {
  subject:    "Subject",
  verb:       "Verb",
  object:     "Object",
  complement: "Complement",
  adverbial:  "Adverbial",
};

const STRUCTURE_COLORS: Record<keyof SentenceStructure, string> = {
  subject:    "bg-blue-500/20 text-blue-300 border-blue-500/40",
  verb:       "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  object:     "bg-violet-500/20 text-violet-300 border-violet-500/40",
  complement: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  adverbial:  "bg-pink-500/20 text-pink-300 border-pink-500/40",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
};

const STORAGE_KEY = "writing_history";
const HISTORY_PER_PAGE = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHighlightedText(
  text: string,
  errors: GrammarError[],
  activeError: number | null,
  onErrorClick: (i: number) => void,
): React.ReactNode {
  if (!errors.length) return <span>{text}</span>;

  const sorted = [...errors]
    .map((e, i) => ({ ...e, originalIndex: i }))
    .sort((a, b) => a.offset - b.offset);

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  sorted.forEach((err) => {
    const i = err.originalIndex;
    if (err.offset > cursor) {
      parts.push(<span key={`plain-${cursor}`}>{text.slice(cursor, err.offset)}</span>);
    }
    const errEnd = err.offset + err.length;
    const errText = text.slice(err.offset, errEnd);
    parts.push(
      <button
        key={`err-${i}`}
        onClick={() => onErrorClick(i)}
        className={cn(
          "relative inline rounded-sm px-0.5 border-b-2 cursor-pointer transition-all focus:outline-none",
          ERROR_UNDERLINE[err.type] ?? "border-gray-500 bg-gray-500/10",
          activeError === i && "ring-1 ring-primary/60",
        )}
        title={err.explanation}
      >
        {errText}
      </button>,
    );
    cursor = errEnd;
  });

  if (cursor < text.length) {
    parts.push(<span key="plain-end">{text.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  const color = SCORE_COLOR(score);

  return (
    <div className="relative flex-shrink-0 w-16 h-16">
      <svg width="64" height="64" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-sm font-bold", GRADE_COLOR[grade] ?? "text-foreground")}>
          {grade}
        </span>
      </div>
    </div>
  );
}

function StructurePill({
  label,
  value,
  colorClass,
}: {
  label: string;
  value?: string;
  colorClass: string;
}) {
  if (value) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", colorClass)}>
          {value}
        </span>
        <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-0.5 opacity-40">
      <span className="px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/40 text-[10px] text-muted-foreground">
        —
      </span>
      <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function SentenceCard({ sentence, index }: { sentence: SentenceAnalysis; index: number }) {
  const [open, setOpen] = useState(false);
  const hasStructure = sentence.structure && Object.values(sentence.structure).some(Boolean);
  const hasIssues = sentence.issues && sentence.issues.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "rounded-xl border p-3 text-sm transition-colors",
        sentence.isCorrect
          ? "border-emerald-500/20 bg-emerald-500/5"
          : hasIssues
          ? "border-red-500/20 bg-red-500/5"
          : "border-border/60 bg-accent/20",
      )}
    >
      {/* Sentence text row */}
      <div className="flex items-start gap-2">
        <div className={cn(
          "mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold",
          sentence.isCorrect ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400",
        )}>
          {sentence.isCorrect ? "✓" : "!"}
        </div>
        <p className="flex-1 leading-relaxed text-foreground/90 text-xs">{sentence.text}</p>
        {(hasStructure || hasIssues) && (
          <button
            onClick={() => setOpen(!open)}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* Issues */}
      {hasIssues && (
        <div className="mt-2 ml-6 flex flex-wrap gap-1">
          {sentence.issues!.map((issue, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
              {issue}
            </span>
          ))}
        </div>
      )}

      {/* Structure breakdown */}
      <AnimatePresence>
        {open && hasStructure && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 ml-6 pt-2 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Sentence Structure</p>
              <div className="flex flex-wrap gap-3 items-end">
                {(Object.keys(STRUCTURE_LABELS) as Array<keyof SentenceStructure>).map((key) => (
                  <StructurePill
                    key={key}
                    label={STRUCTURE_LABELS[key]}
                    value={sentence.structure?.[key]}
                    colorClass={STRUCTURE_COLORS[key]}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GrammarRulesPanel({ rules }: { rules: GrammarRule[] }) {
  const grouped = rules.reduce<Record<string, GrammarRule[]>>((acc, rule) => {
    const cat = rule.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rule);
    return acc;
  }, {});

  const [openCats, setOpenCats] = useState<Set<string>>(new Set(Object.keys(grouped)));

  const toggleCat = (cat: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([cat, catRules]) => (
        <div key={cat} className="rounded-xl border border-border/50 overflow-hidden">
          <button
            onClick={() => toggleCat(cat)}
            className="w-full flex items-center justify-between px-3 py-2 bg-accent/30 hover:bg-accent/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                  RULE_CATEGORY_COLORS[cat] ?? "bg-muted/50 text-muted-foreground border-muted",
                )}
              >
                {cat}
              </span>
              <span className="text-[10px] text-muted-foreground">{catRules.length} rule{catRules.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {catRules.filter((r) => r.status === "violated").length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
                {catRules.filter((r) => r.status === "suggestion").length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
                {catRules.filter((r) => r.status === "ok").length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </div>
              {openCats.has(cat) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
          </button>
          <AnimatePresence>
            {openCats.has(cat) && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-2 space-y-1.5">
                  {catRules.map((rule, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-lg text-xs",
                        rule.status === "violated" ? "bg-red-500/8 border border-red-500/15" :
                        rule.status === "suggestion" ? "bg-blue-500/8 border border-blue-500/15" :
                        "bg-emerald-500/8 border border-emerald-500/15",
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 w-3 h-3 rounded-full flex-shrink-0",
                        rule.status === "violated" ? "bg-red-500/60" :
                        rule.status === "suggestion" ? "bg-blue-500/60" :
                        "bg-emerald-500/60",
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="leading-relaxed text-foreground/85">{rule.rule}</p>
                        {rule.examples && rule.examples.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {rule.examples.map((ex, ei) => (
                              <span key={ei} className="text-[10px] italic text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded">
                                {ex}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "text-[9px] font-semibold uppercase tracking-wider flex-shrink-0",
                        rule.status === "violated" ? "text-red-400" :
                        rule.status === "suggestion" ? "text-blue-400" :
                        "text-emerald-400",
                      )}>
                        {rule.status === "violated" ? "Error" : rule.status === "suggestion" ? "Tip" : "OK"}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function HistoryPanel({
  history,
  onSelect,
  onClose,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalPages = Math.ceil(history.length / HISTORY_PER_PAGE);
  const pageItems = history.slice(page * HISTORY_PER_PAGE, (page + 1) * HISTORY_PER_PAGE);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <History size={14} className="text-primary" />
            Writing History
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No history yet</p>
        ) : (
          <div className="space-y-1.5">
            {pageItems.map((entry) => (
              <div key={entry.id}>
                <motion.div
                  whileTap={{ scale: 0.99 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-accent/40 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div className={cn("text-base font-bold w-7 text-center flex-shrink-0", GRADE_COLOR[entry.result.grade] ?? "text-foreground")}>
                    {entry.result.grade}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground/80 truncate">
                      {entry.text.slice(0, 60)}{entry.text.length > 60 ? "…" : ""}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span>{new Date(entry.date).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>·</span>
                      <span>{entry.result.wordCount} words</span>
                      {entry.result.errors.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-red-400">{entry.result.errors.length} error{entry.result.errors.length !== 1 ? "s" : ""}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">{entry.result.score}%</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(entry); }}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium"
                    >
                      Load
                    </button>
                  </div>
                </motion.div>
                <AnimatePresence>
                  {expandedId === entry.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mx-2 mb-1 p-3 rounded-b-xl bg-accent/20 border border-t-0 border-border/40 text-xs leading-relaxed text-foreground/70">
                        {entry.text}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* Paginator */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-border/40">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="p-1 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page === totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WritingPage() {
  useAuthStore();

  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCorrected, setShowCorrected] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSentences, setShowSentences] = useState(true);
  const [showGrammarRules, setShowGrammarRules] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [promptIdx, setPromptIdx] = useState(0);
  const [activeError, setActiveError] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"errors" | "sentences" | "rules" | "strengths">("errors");

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);

  const saveToHistory = useCallback((newText: string, newResult: AnalysisResult) => {
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: newText,
      result: newResult,
      date: new Date().toISOString(),
    };
    setHistory((prev) => {
      const updated = [entry, ...prev].slice(0, 100);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const analyze = async () => {
    if (text.trim().split(/\s+/).length < 5) {
      toast.error("Write at least 5 words");
      return;
    }
    setLoading(true);
    setResult(null);
    setActiveError(null);
    setActiveTab("errors");
    try {
      const data = await aiApi.analyzeWriting({ text: text.trim() });
      setResult(data);
      saveToHistory(text.trim(), data);
    } catch {
      toast.error("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setText("");
    setResult(null);
    setActiveError(null);
  };

  const handleCopyCorrected = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.correctedText);
    toast.success("Corrected text copied!");
  };

  const handleDownload = () => {
    if (!result) return;
    const content = [
      "=== Original Text ===",
      text,
      "",
      "=== Corrected Text ===",
      result.correctedText,
      "",
      "=== Score ===",
      `${result.score}/100 (${result.grade})`,
      "",
      "=== Errors ===",
      ...result.errors.map((e) => `• [${e.type.toUpperCase()}] "${e.text}" → "${e.correction}"\n  ${e.explanation}`),
      "",
      "=== Strengths ===",
      ...result.strengths.map((s) => `• ${s}`),
      "",
      "=== Improvements ===",
      ...result.improvements.map((s) => `• ${s}`),
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `writing-analysis-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded!");
  };

  const handleSelectHistory = (entry: HistoryEntry) => {
    setText(entry.text);
    setResult(entry.result);
    setShowHistory(false);
    setActiveError(null);
    setActiveTab("errors");
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const activeErrorData = result && activeError !== null ? result.errors[activeError] : null;

  // Determine right panel tab availability
  const hasSentences = !!(result?.sentences && result.sentences.length > 0);
  const hasRules = !!(result?.grammarRules && result.grammarRules.length > 0);

  const TABS = [
    { id: "errors" as const, label: "Errors", count: result?.errors.length, show: true },
    { id: "sentences" as const, label: "Sentences", count: result?.sentences?.length, show: hasSentences },
    { id: "rules" as const, label: "Rules", count: result?.grammarRules?.length, show: hasRules },
    { id: "strengths" as const, label: "Strengths", count: result?.strengths.length, show: !!(result?.strengths?.length) },
  ].filter((t) => t.show);

  return (
    <div className="max-w-6xl mx-auto space-y-5 page-enter">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <PenLine size={20} className="text-primary" />
            Writing Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI checks grammar, style, sentence structure and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleDownload}>
              <Download size={13} />
              <span className="hidden sm:inline text-xs">Export</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setShowHistory(!showHistory)}>
            <History size={14} />
            <span className="hidden sm:inline text-xs">History</span>
            {history.length > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {history.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── History drawer ── */}
      <AnimatePresence>
        {showHistory && (
          <HistoryPanel
            history={history}
            onSelect={handleSelectHistory}
            onClose={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Main two-column grid ── */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* ── LEFT: Editor + annotated text ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Prompt suggestion */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPromptIdx((promptIdx + 1) % PROMPTS.length)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group"
            >
              <Sparkles size={11} className="text-violet-400 group-hover:text-violet-300 transition-colors" />
              <span className="italic">{PROMPTS[promptIdx]}</span>
              <span className="text-[10px] opacity-50 group-hover:opacity-80 transition-opacity">(next →)</span>
            </button>
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start writing in English here… Click the prompt above for topic ideas."
              className="w-full h-52 md:h-64 p-4 rounded-2xl border border-border bg-card text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground/40 font-normal"
              disabled={loading}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-3 text-[10px] text-muted-foreground/60">
              <span>{wordCount} words</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1 btn-gradient gap-2 font-medium"
              onClick={analyze}
              disabled={loading || !text.trim() || wordCount < 5}
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" />Analyzing…</>
                : <><Sparkles size={14} />Check Writing</>
              }
            </Button>
            {text && (
              <Button variant="outline" size="icon" onClick={handleReset} title="Clear">
                <RotateCcw size={14} />
              </Button>
            )}
          </div>

          {/* ── Annotated text view ── */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Annotated Text
                  </h4>
                  {result.errors.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {[
                        { type: "grammar", label: "Grammar" },
                        { type: "spelling", label: "Spelling" },
                        { type: "style", label: "Style" },
                        { type: "punctuation", label: "Punct." },
                      ].filter((t) => result.errors.some((e) => e.type === t.type)).map((t) => (
                        <span key={t.type} className="flex items-center gap-1">
                          <span className={cn("w-1.5 h-1.5 rounded-full", ERROR_DOT[t.type])} />
                          {t.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Highlighted text */}
                <p className="text-sm leading-loose">
                  {result.errors.length > 0
                    ? buildHighlightedText(text, result.errors, activeError, (i) =>
                        setActiveError(activeError === i ? null : i)
                      )
                    : <span>{text}</span>
                  }
                </p>

                {/* Active error detail */}
                <AnimatePresence>
                  {activeErrorData && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className={cn("p-3 rounded-xl border text-xs", ERROR_COLORS[activeErrorData.type])}
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-semibold mb-1">
                            <span className="line-through opacity-60 mr-1">{activeErrorData.text}</span>
                            <span className="mx-1 opacity-40">→</span>
                            <span className="font-bold">{activeErrorData.correction}</span>
                          </div>
                          <p className="opacity-80 leading-relaxed">{activeErrorData.explanation}</p>
                          <span className="mt-1.5 inline-block text-[10px] opacity-60 capitalize font-medium bg-current/10 px-1.5 py-0.5 rounded">
                            {activeErrorData.type}
                          </span>
                        </div>
                        <button
                          onClick={() => setActiveError(null)}
                          className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {result.errors.length === 0 && (
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-medium">
                    <CheckCircle2 size={13} />
                    No errors detected — great writing!
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Corrected text collapsible ── */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  onClick={() => setShowCorrected(!showCorrected)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-accent/50 hover:bg-accent text-sm transition-colors"
                >
                  <span className="font-medium flex items-center gap-2">
                    <BookOpen size={14} className="text-primary" />
                    Corrected Text
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyCorrected(); }}
                      className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy corrected text"
                    >
                      <Copy size={12} />
                    </button>
                    {showCorrected ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>
                <AnimatePresence>
                  {showCorrected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="glass-card rounded-t-none rounded-b-2xl p-4 border-t-0">
                        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          {result.correctedText}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT: Score + Analysis panels ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Empty state */}
          {!result && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[220px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <PenLine size={22} className="text-primary/50" />
              </div>
              <div>
                <p className="font-semibold text-sm">Write & Analyze</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  AI will break down your text sentence by sentence, highlight errors, and explain grammar rules
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {[
                  { label: "Grammar", color: "bg-red-500/10 text-red-400 border-red-500/20" },
                  { label: "Spelling", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
                  { label: "Style", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
                  { label: "Structure", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
                  { label: "Rules", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                ].map((t) => (
                  <span key={t.label} className={cn("px-2 py-0.5 rounded-full border text-[10px] font-medium", t.color)}>
                    {t.label}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Loading spinner */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[220px]"
            >
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Analyzing your writing…</p>
                <p className="text-xs text-muted-foreground mt-1">Checking grammar, structure & style</p>
              </div>
            </motion.div>
          )}

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* ── Score card ── */}
                <div className={cn(
                  "rounded-2xl p-4 bg-gradient-to-br border border-border/50",
                  GRADE_BG[result.grade] ?? "from-muted/30 to-muted/10",
                )}>
                  <div className="flex items-center gap-4">
                    <ScoreRing score={result.score} grade={result.grade} />
                    <div className="flex-1 min-w-0">
                      <div className="text-3xl font-bold leading-none">
                        {result.score}
                        <span className="text-base text-muted-foreground font-normal">/100</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.readabilityLevel} · {result.wordCount} words
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        {result.errors.length === 0 ? (
                          <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                            <CheckCircle2 size={11} />Perfect!
                          </span>
                        ) : (
                          <span className="text-red-400 text-xs font-medium">
                            {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score bar by error type */}
                  {result.errors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-current/10">
                      <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Error breakdown</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["grammar", "spelling", "style", "punctuation"] as const).map((type) => {
                          const count = result.errors.filter((e) => e.type === type).length;
                          if (!count) return null;
                          return (
                            <span key={type} className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                              ERROR_COLORS[type],
                            )}>
                              {count} {type}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Tabbed analysis panels ── */}
                {TABS.length > 0 && (
                  <div className="glass-card rounded-2xl overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-border/50 bg-accent/20">
                      {TABS.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "flex-1 px-2 py-2.5 text-[11px] font-medium transition-colors relative",
                            activeTab === tab.id
                              ? "text-foreground"
                              : "text-muted-foreground hover:text-foreground/70",
                          )}
                        >
                          {tab.label}
                          {tab.count !== undefined && tab.count > 0 && (
                            <span className={cn(
                              "ml-1 text-[9px] px-1 py-px rounded-full font-bold",
                              activeTab === tab.id ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground",
                            )}>
                              {tab.count}
                            </span>
                          )}
                          {activeTab === tab.id && (
                            <motion.div
                              layoutId="writing-tab-indicator"
                              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                            />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="p-3 max-h-[480px] overflow-y-auto">
                      <AnimatePresence mode="wait">
                        {/* Errors tab */}
                        {activeTab === "errors" && (
                          <motion.div
                            key="errors"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className="space-y-1.5"
                          >
                            {result.errors.length === 0 ? (
                              <div className="flex flex-col items-center gap-2 py-6 text-emerald-500">
                                <CheckCircle2 size={24} />
                                <p className="text-xs font-medium">No errors found!</p>
                              </div>
                            ) : (
                              result.errors.map((err, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                  className={cn(
                                    "p-2.5 rounded-xl border text-xs cursor-pointer transition-all select-none",
                                    ERROR_COLORS[err.type],
                                    activeError === i && "ring-2 ring-primary/30 scale-[1.01]",
                                  )}
                                  onClick={() => setActiveError(activeError === i ? null : i)}
                                >
                                  <div className="flex items-start gap-2">
                                    <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div>
                                        <span className="line-through opacity-60">{err.text}</span>
                                        <span className="mx-1 opacity-40">→</span>
                                        <span className="font-semibold">{err.correction}</span>
                                      </div>
                                      <AnimatePresence>
                                        {activeError === i && (
                                          <motion.p
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden text-[11px] opacity-75 mt-1 leading-relaxed"
                                          >
                                            {err.explanation}
                                          </motion.p>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                    <span className="text-[9px] opacity-50 flex-shrink-0 capitalize font-medium">{err.type}</span>
                                  </div>
                                </motion.div>
                              ))
                            )}
                          </motion.div>
                        )}

                        {/* Sentences tab */}
                        {activeTab === "sentences" && hasSentences && (
                          <motion.div
                            key="sentences"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className="space-y-2"
                          >
                            {result.sentences!.map((s, i) => (
                              <SentenceCard key={i} sentence={s} index={i} />
                            ))}
                          </motion.div>
                        )}

                        {/* Grammar rules tab */}
                        {activeTab === "rules" && hasRules && (
                          <motion.div
                            key="rules"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                          >
                            <GrammarRulesPanel rules={result.grammarRules!} />
                          </motion.div>
                        )}

                        {/* Strengths tab */}
                        {activeTab === "strengths" && (
                          <motion.div
                            key="strengths"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className="space-y-4"
                          >
                            {result.strengths.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Strengths</p>
                                {result.strengths.map((s, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-start gap-2 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-2.5"
                                  >
                                    <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0" />
                                    <span className="leading-relaxed">{s}</span>
                                  </motion.div>
                                ))}
                              </div>
                            )}
                            {result.improvements.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Suggestions</p>
                                {result.improvements.map((s, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 + 0.1 }}
                                    className="flex items-start gap-2 text-xs text-blue-400 bg-blue-500/8 border border-blue-500/15 rounded-xl p-2.5"
                                  >
                                    <Sparkles size={11} className="mt-0.5 flex-shrink-0" />
                                    <span className="leading-relaxed">{s}</span>
                                  </motion.div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
