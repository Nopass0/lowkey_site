"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Circle, BookOpen, Loader2,
  Edit3, Award, RotateCcw,
  FileText, Hash, CreditCard, Video as VideoIcon, ClipboardList,
  ExternalLink, Lock, Brain, ThumbsUp, ThumbsDown, Layers, PlusCircle, X,
  ChevronLeft, ChevronRight, Clock, Trophy, AlertCircle, Send,
  Check, MoveVertical, ArrowRight, Zap, Target, XCircle,
} from "lucide-react";
import { socialApi, cardsApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";
import { PatternHeader, getPatternForId } from "@/components/course/pattern-header";
import { MarkdownContent } from "@/components/course/markdown-content";
import { useContextMenu, ContextMenuPortal } from "@/components/ui/context-menu-custom";

// ─── Types ────────────────────────────────────────────────────────────────────

type Block = {
  id: string;
  courseId: string;
  type: string;
  title: string | null;
  content: any;
  orderIndex: number;
};

type Course = {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  emoji: string;
  color: string;
  level: string;
  blockCount: number;
  isPublished: boolean;
  imageUrl?: string | null;
};

type Progress = {
  completedBlockIds: string[];
  percentComplete: number;
  testScores: any[];
};

type Question = {
  id: string;
  type: string;
  question: string;
  options?: string[];
  correctAnswer?: any;
  pairs?: { left: string; right: string }[];
};

type Test = {
  id: string;
  title: string;
  description: string | null;
  timeLimitSeconds: number | null;
  passingScore: number;
  maxAttempts: number | null;
  pointsPerQuestion: number;
  allowRetry: boolean;
  questions: Question[];
};

type Attempt = {
  id: string;
  score: number;
  passed: boolean;
  answers: Array<{ questionId: string; userAnswer: any; correct: boolean; correctAnswer: any }>;
  timeTakenSeconds: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Начинающий",
  elementary: "Элементарный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

const BLOCK_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  text:    { label: "Текст",      icon: FileText,     color: "text-blue-400"   },
  grammar: { label: "Грамматика", icon: Hash,         color: "text-violet-400" },
  cards:   { label: "Карточки",   icon: CreditCard,   color: "text-amber-400"  },
  test:    { label: "Тест",       icon: ClipboardList, color: "text-rose-400"  },
  video:   { label: "Видео",      icon: VideoIcon,    color: "text-emerald-400" },
};

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─── Flip card ────────────────────────────────────────────────────────────────

function FlipCard({ card }: { card: { front: string; back: string; example?: string } }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div onClick={() => setFlipped(f => !f)} className="cursor-pointer" style={{ perspective: 800 }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.38, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d" }}
        className="relative h-32"
      >
        <div className="absolute inset-0 rounded-2xl border flex flex-col items-center justify-center p-4"
          style={{ backfaceVisibility: "hidden", background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-white font-semibold text-base text-center">{card.front}</p>
          <p className="text-white/25 text-xs mt-2">нажмите, чтобы перевернуть</p>
        </div>
        <div className="absolute inset-0 rounded-2xl border flex flex-col items-center justify-center p-4"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.25)" }}>
          <p className="text-indigo-300 font-semibold text-base text-center">{card.back}</p>
          {card.example && <p className="text-white/40 text-xs mt-2 text-center italic">{card.example}</p>}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Mini study session ───────────────────────────────────────────────────────

function MiniStudySession({ cards, onFinish }: { cards: any[]; onFinish: (knownCount: number) => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [done, setDone] = useState(false);
  const shuffled = useRef(cards.slice().sort(() => Math.random() - 0.5)).current;
  const total = shuffled.length;
  const card = shuffled[index];

  const handleAnswer = (isKnown: boolean) => {
    const nextKnown = isKnown ? known + 1 : known;
    if (index + 1 >= total) {
      setKnown(nextKnown);
      setDone(true);
    } else {
      setKnown(nextKnown);
      setIndex(i => i + 1);
      setFlipped(false);
    }
  };

  if (done) {
    const pct = Math.round((known / total) * 100);
    return (
      <div className="flex flex-col items-center py-6 gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: pct >= 80 ? "rgba(52,211,153,0.15)" : "rgba(99,102,241,0.15)" }}>
          <Award className={cn("w-7 h-7", pct >= 80 ? "text-emerald-400" : "text-indigo-400")} />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">{pct >= 80 ? "Отлично!" : "Продолжайте учить"}</p>
          <p className="text-white/50 text-sm mt-1">Знаете {known} из {total} ({pct}%)</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setIndex(0); setFlipped(false); setKnown(0); setDone(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/8 hover:bg-white/12 text-white/70 hover:text-white border border-white/10 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Повторить
          </button>
          <button
            onClick={() => onFinish(known)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Завершить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full flex items-center justify-between mb-1">
        <span className="text-xs text-white/30">{index + 1} / {total}</span>
        <div className="h-1 flex-1 mx-3 bg-white/8 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="text-xs text-emerald-400">{known} знаю</span>
      </div>

      <div onClick={() => setFlipped(f => !f)} className="w-full cursor-pointer" style={{ perspective: 800 }}>
        <motion.div
          key={`${index}-${flipped}`}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.36, ease: "easeInOut" }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative h-36 w-full"
        >
          <div className="absolute inset-0 rounded-2xl border flex flex-col items-center justify-center p-5 select-none"
            style={{ backfaceVisibility: "hidden", background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-white font-semibold text-xl text-center">{card?.front}</p>
            <p className="text-white/25 text-xs mt-3">нажмите, чтобы увидеть перевод</p>
          </div>
          <div className="absolute inset-0 rounded-2xl border flex flex-col items-center justify-center p-5 select-none"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)" }}>
            <p className="text-indigo-300 font-semibold text-xl text-center">{card?.back}</p>
            {card?.example && <p className="text-white/35 text-xs mt-3 text-center italic">{card.example}</p>}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {flipped && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3 w-full">
            <button
              onClick={() => handleAnswer(false)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-red-500/12 hover:bg-red-500/20 text-red-400 border border-red-500/15 transition-all"
            >
              <ThumbsDown className="w-4 h-4" />
              Не знаю
            </button>
            <button
              onClick={() => handleAnswer(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/15 transition-all"
            >
              <ThumbsUp className="w-4 h-4" />
              Знаю
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Cards block ──────────────────────────────────────────────────────────────

function CardsBlockContent({ content, onStudied }: { content: any; onStudied?: () => void }) {
  const deckId: string | null = content?.deckId || null;
  const requireBeforeNext: boolean = content?.requireBeforeNext || false;
  const [deck, setDeck] = useState<any>(null);
  const [deckCards, setDeckCards] = useState<any[]>([]);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [adopted, setAdopted] = useState(false);
  const [studyMode, setStudyMode] = useState(false);

  useEffect(() => {
    if (!deckId) return;
    setLoadingDeck(true);
    Promise.all([
      cardsApi.getDecks(),
      cardsApi.getCards({ deckId }),
    ]).then(([decksData, cardsData]) => {
      const decks: any[] = decksData?.decks || decksData || [];
      const found = decks.find((d: any) => d.id === deckId);
      setDeck(found || { id: deckId, name: "Колода" });
      setDeckCards(cardsData?.cards || cardsData || []);
    }).catch(() => {}).finally(() => setLoadingDeck(false));
  }, [deckId]);

  const handleAdopt = async () => {
    if (!deckId) return;
    setAdopting(true);
    try {
      await cardsApi.adoptDeck(deckId);
      setAdopted(true);
      toast.success("Колода добавлена в вашу коллекцию!");
    } catch { toast.error("Не удалось добавить колоду"); }
    finally { setAdopting(false); }
  };

  const handleStudyFinish = (knownCount: number) => {
    setStudyMode(false);
    const total = deckCards.length || (content?.cards || []).length;
    const pct = total > 0 ? Math.round((knownCount / total) * 100) : 0;
    if (pct >= 70 && onStudied) onStudied();
    else if (pct < 70) toast("Изучите карточки ещё раз для продолжения", { icon: "📚" });
  };

  const displayCards: any[] = deckCards.length > 0 ? deckCards : (content?.cards || []);

  if (loadingDeck) {
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>;
  }

  if (studyMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white/70">Изучение карточек</p>
          <button onClick={() => setStudyMode(false)} className="p-1 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <MiniStudySession cards={displayCards} onFinish={handleStudyFinish} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deck && (
        <div className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.12)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/90">{deck.name || "Колода"}</p>
              <p className="text-xs text-white/40">{displayCards.length} карточек</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!adopted ? (
              <button
                onClick={handleAdopt}
                disabled={adopting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 transition-all"
              >
                {adopting ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3" />}
                В коллекцию
              </button>
            ) : (
              <span className="flex items-center gap-1 text-xs text-emerald-400 px-2 py-1">
                <CheckCircle2 className="w-3 h-3" />
                Добавлено
              </span>
            )}
          </div>
        </div>
      )}

      {requireBeforeNext && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-amber-300/70"
          style={{ background: "rgba(251,191,36,0.05)", border: "1px dashed rgba(251,191,36,0.2)" }}>
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          Следующий блок откроется после изучения карточек
        </div>
      )}

      {displayCards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayCards.slice(0, 6).map((card: any, i: number) => (
            <FlipCard key={i} card={card} />
          ))}
          {displayCards.length > 6 && (
            <div className="rounded-2xl border flex items-center justify-center h-32 text-white/30 text-sm"
              style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              +{displayCards.length - 6} ещё
            </div>
          )}
        </div>
      ) : (
        <p className="text-white/30 text-sm italic">Карточки не добавлены</p>
      )}

      {displayCards.length > 0 && (
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setStudyMode(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/20 transition-all"
          >
            <Brain className="w-4 h-4" />
            Учить карточки
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Block content renderers ──────────────────────────────────────────────────

function TextBlockContent({ content }: { content: any }) {
  const md = content?.markdown || content?.text || content?.content || "";
  if (!md) return <p className="text-white/30 text-sm italic">Контент не добавлен</p>;
  return <MarkdownContent content={md} />;
}

function GrammarBlockContent({ content }: { content: any }) {
  return (
    <div className="space-y-4">
      {content?.explanation && (
        <p className="text-white/70 text-[15px] leading-relaxed">{content.explanation}</p>
      )}
      {content?.rules?.length > 0 && (
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Правила</p>
          <div className="space-y-2">
            {content.rules.map((r: any, i: number) => (
              <div key={i} className="px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", borderLeft: "2px solid rgba(139,92,246,0.5)" }}>
                <p className="text-white/85 text-sm font-medium">{r.rule}</p>
                {r.example && <p className="text-indigo-400 text-xs mt-1.5 italic">{r.example}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {content?.examples?.length > 0 && (
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Примеры</p>
          <div className="space-y-2">
            {content.examples.map((ex: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                <div>
                  <p className="text-white/80 text-sm">{ex.en}</p>
                  <p className="text-white/40 text-xs mt-0.5">{ex.ru}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VideoBlockContent({ content }: { content: any }) {
  const url = content?.url || "";
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  const videoId = match?.[1];
  if (!videoId) return <p className="text-white/40 text-sm">Неверная ссылка на видео</p>;
  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-xl">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

// ─── Question components (for inline test) ────────────────────────────────────

function SingleChoice({ question, answer, onChange, submitted }: {
  question: Question; answer: string; onChange: (v: string) => void; submitted: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {(question.options || []).map((opt, i) => {
        const isSelected = answer === opt;
        const isCorrect = submitted && question.correctAnswer === opt;
        const isWrong = submitted && isSelected && question.correctAnswer !== opt;
        return (
          <motion.button
            key={i}
            onClick={() => !submitted && onChange(opt)}
            disabled={submitted}
            whileTap={!submitted ? { scale: 0.98 } : {}}
            className={cn(
              "w-full text-left px-4 py-3.5 rounded-xl text-sm transition-all border flex items-center gap-3",
              !submitted && !isSelected && "hover:bg-white/5 border-white/8 text-white/70",
              !submitted && isSelected && "bg-indigo-500/15 border-indigo-500/40 text-white",
              submitted && isCorrect && "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
              submitted && isWrong && "bg-red-500/15 border-red-500/40 text-red-300",
              submitted && !isSelected && !isCorrect && "border-white/5 text-white/35 opacity-60",
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
              !submitted && isSelected ? "border-indigo-400 bg-indigo-500" : "",
              !submitted && !isSelected ? "border-white/20" : "",
              submitted && isCorrect ? "border-emerald-400 bg-emerald-500" : "",
              submitted && isWrong ? "border-red-400 bg-red-500" : "",
              submitted && !isSelected && !isCorrect ? "border-white/15" : "",
            )}>
              {!submitted && isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              {submitted && isCorrect && <Check className="w-3 h-3 text-white" />}
              {submitted && isWrong && <XCircle className="w-3 h-3 text-white" />}
            </div>
            <span className="flex-1">{opt}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function MultipleChoice({ question, answer, onChange, submitted }: {
  question: Question; answer: string[]; onChange: (v: string[]) => void; submitted: boolean;
}) {
  const correctArr: string[] = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
  return (
    <div className="space-y-2.5">
      {(question.options || []).map((opt, i) => {
        const isSelected = answer.includes(opt);
        const isCorrect = submitted && correctArr.includes(opt);
        const isWrong = submitted && isSelected && !correctArr.includes(opt);
        const isMissed = submitted && !isSelected && correctArr.includes(opt);
        return (
          <motion.button
            key={i}
            onClick={() => !submitted && onChange(isSelected ? answer.filter(x => x !== opt) : [...answer, opt])}
            disabled={submitted}
            whileTap={!submitted ? { scale: 0.98 } : {}}
            className={cn(
              "w-full text-left px-4 py-3.5 rounded-xl text-sm transition-all border flex items-center gap-3",
              !submitted && !isSelected && "hover:bg-white/5 border-white/8 text-white/70",
              !submitted && isSelected && "bg-indigo-500/15 border-indigo-500/40 text-white",
              submitted && isCorrect && "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
              submitted && isWrong && "bg-red-500/15 border-red-500/40 text-red-300",
              submitted && isMissed && "bg-amber-500/15 border-amber-500/40 text-amber-300",
              submitted && !isSelected && !isCorrect && "border-white/5 text-white/35 opacity-60",
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all",
              !submitted && isSelected ? "border-indigo-400 bg-indigo-500" : "border-white/20",
              submitted && isCorrect ? "border-emerald-400 bg-emerald-500" : "",
              submitted && isWrong ? "border-red-400 bg-red-500" : "",
            )}>
              {(isSelected || (submitted && isCorrect)) && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="flex-1">{opt}</span>
            {submitted && isMissed && <span className="text-[10px] text-amber-400 ml-auto">пропущено</span>}
          </motion.button>
        );
      })}
      <p className="text-white/30 text-xs text-right">Можно выбрать несколько вариантов</p>
    </div>
  );
}

function TextInputQ({ question, answer, onChange, submitted }: {
  question: Question; answer: string; onChange: (v: string) => void; submitted: boolean;
}) {
  const isCorrect = submitted && (answer.trim().toLowerCase() === String(question.correctAnswer || "").toLowerCase());
  return (
    <div className="space-y-2">
      <input
        value={answer}
        onChange={e => !submitted && onChange(e.target.value)}
        disabled={submitted}
        placeholder="Введите ответ..."
        className={cn(
          "w-full rounded-xl px-4 py-3 text-sm transition-all border outline-none",
          !submitted && "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500",
          submitted && isCorrect && "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
          submitted && !isCorrect && "bg-red-500/10 border-red-500/30 text-red-300",
        )}
      />
      {submitted && !isCorrect && (
        <p className="text-xs text-white/50">
          Правильный ответ: <span className="text-emerald-400 font-medium">{question.correctAnswer}</span>
        </p>
      )}
    </div>
  );
}

function MatchPairs({ question, answer, onChange, submitted }: {
  question: Question; answer: Record<string, string>; onChange: (v: Record<string, string>) => void; submitted: boolean;
}) {
  const pairs = question.pairs || [];
  const lefts = pairs.map(p => p.left);
  const rights = [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
  const [shuffled] = useState(rights);
  const [selected, setSelected] = useState<string | null>(null);
  const correctMap = Object.fromEntries(pairs.map(p => [p.left, p.right]));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Понятия</p>
          {lefts.map((left, i) => {
            const isMatched = !!answer[left];
            const isSel = selected === left;
            const isCorrect = submitted && answer[left] === correctMap[left];
            const isWrong = submitted && isMatched && answer[left] !== correctMap[left];
            return (
              <button key={i} onClick={() => !submitted && setSelected(left)} disabled={submitted}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm border transition-all",
                  !submitted && isSel && "bg-indigo-500/20 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10",
                  !submitted && !isSel && isMatched && "bg-white/8 border-white/15 text-white/80",
                  !submitted && !isSel && !isMatched && "border-white/8 text-white/60 hover:bg-white/5",
                  submitted && isCorrect && "bg-emerald-500/15 border-emerald-500/35 text-emerald-300",
                  submitted && isWrong && "bg-red-500/15 border-red-500/35 text-red-300",
                  submitted && !isMatched && "border-white/5 text-white/30",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px]">{left}</span>
                  {isMatched && !submitted && <ArrowRight className="w-3 h-3 text-white/40" />}
                  {submitted && isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  {submitted && isWrong && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                </div>
                {isMatched && <p className="text-xs text-white/40 mt-1">{answer[left]}</p>}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Значения</p>
          {shuffled.map((right, i) => {
            const isUsed = Object.values(answer).includes(right);
            const isHighlighted = !submitted && selected !== null;
            return (
              <button key={i}
                onClick={() => {
                  if (submitted || isUsed || !selected) return;
                  onChange({ ...answer, [selected]: right });
                  setSelected(null);
                }}
                disabled={submitted || isUsed}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-[13px] border transition-all",
                  !submitted && !isUsed && isHighlighted && "border-indigo-500/40 text-white/90 hover:bg-indigo-500/15 hover:border-indigo-500/60",
                  !submitted && !isUsed && !isHighlighted && "border-white/8 text-white/60 hover:bg-white/5",
                  isUsed && !submitted && "border-white/5 text-white/25 opacity-50",
                  submitted && "border-white/8 text-white/50",
                )}
              >
                {right}
              </button>
            );
          })}
        </div>
      </div>
      {!submitted && (
        <p className="text-white/30 text-xs text-center">
          {selected ? `Выбрано: "${selected}" — теперь выберите значение справа` : "Выберите понятие слева, затем значение справа"}
        </p>
      )}
      {submitted && (
        <div className="space-y-1 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Правильные ответы</p>
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/50">
              <span className="text-white/70">{p.left}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="text-emerald-400">{p.right}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderItems({ question, answer, onChange, submitted }: {
  question: Question; answer: string[]; onChange: (v: string[]) => void; submitted: boolean;
}) {
  const correctOrder: string[] = Array.isArray((question as any).items) ? (question as any).items : [];
  const [shuffled] = useState<string[]>(() => {
    if (answer && answer.length > 0) return answer;
    const arr = [...correctOrder];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const items = (answer && answer.length > 0) ? answer : shuffled;

  const move = (from: number, to: number) => {
    if (submitted) return;
    const arr = [...items];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onChange(arr);
  };

  return (
    <div className="space-y-2">
      <p className="text-white/40 text-xs mb-3 flex items-center gap-1">
        <MoveVertical className="w-3 h-3" />
        Расставьте элементы в правильном порядке
      </p>
      {items.map((item, i) => {
        const correctIdx = correctOrder.indexOf(item);
        const isCorrectPos = submitted && correctIdx === i;
        const isWrongPos = submitted && correctIdx !== i;
        return (
          <motion.div key={item} layout
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm border transition-all",
              !submitted && "bg-white/5 border-white/8 text-white/80",
              submitted && isCorrectPos && "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
              submitted && isWrongPos && "bg-red-500/15 border-red-500/30 text-red-300",
            )}
          >
            <span className="font-mono text-[11px] text-white/25 w-4 text-center flex-shrink-0">{i + 1}</span>
            <span className="flex-1">{item}</span>
            {!submitted && (
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, i - 1)} disabled={i === 0}
                  className="text-white/20 hover:text-white/60 disabled:opacity-10 text-xs leading-none">▲</button>
                <button onClick={() => move(i, i + 1)} disabled={i >= items.length - 1}
                  className="text-white/20 hover:text-white/60 disabled:opacity-10 text-xs leading-none">▼</button>
              </div>
            )}
            {submitted && <span className="text-[10px] text-white/30">#{correctIdx + 1}</span>}
          </motion.div>
        );
      })}
      {submitted && (
        <div className="mt-3 rounded-xl border border-white/8 p-3 space-y-1">
          <p className="text-[11px] text-white/35 font-semibold uppercase tracking-wider mb-1.5">Правильный порядок</p>
          {correctOrder.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/50">
              <span className="font-mono w-4 text-white/30">{i + 1}.</span>
              <span className="text-emerald-400">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionView({ question, answer, onChange, submitted }: {
  question: Question; answer: any; onChange: (v: any) => void; submitted: boolean;
}) {
  if (question.type === "single_choice") return <SingleChoice question={question} answer={answer || ""} onChange={onChange} submitted={submitted} />;
  if (question.type === "multiple_choice") return <MultipleChoice question={question} answer={answer || []} onChange={onChange} submitted={submitted} />;
  if (question.type === "fill_blank" || question.type === "text_input") return <TextInputQ question={question} answer={answer || ""} onChange={onChange} submitted={submitted} />;
  if (question.type === "match") return <MatchPairs question={question} answer={answer || {}} onChange={onChange} submitted={submitted} />;
  if (question.type === "order") return <OrderItems question={question} answer={answer || []} onChange={onChange} submitted={submitted} />;
  return <TextInputQ question={question} answer={typeof answer === "string" ? answer : ""} onChange={onChange} submitted={submitted} />;
}

// ─── Inline test ──────────────────────────────────────────────────────────────

function InlineTest({
  content, groupId, courseId,
  onPass,
}: {
  content: any; groupId: string; courseId: string;
  onPass?: () => void;
}) {
  const testId: string = content?.testId;
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const timerRef = useRef<any>(null);
  const [mode, setMode] = useState<"all" | "one">("one");

  useEffect(() => {
    if (!testId) { setLoading(false); return; }
    socialApi.getTest(groupId, courseId, testId)
      .then(data => {
        setTest(data);
        if (data.timeLimitSeconds) setTimeLeft(data.timeLimitSeconds);
        setMode(data.questions?.length <= 5 ? "all" : "one");
      })
      .catch(() => toast.error("Ошибка загрузки теста"))
      .finally(() => setLoading(false));
  }, [groupId, courseId, testId]);

  const handleSubmit = useCallback(async () => {
    if (!test || submitting) return;
    clearTimeout(timerRef.current);
    setSubmitting(true);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const formattedAnswers = test.questions.map(q => ({
      questionId: q.id,
      id: q.id,
      answer: answers[q.id] ?? "",
    }));
    try {
      const result = await socialApi.submitTest(groupId, courseId, testId, {
        answers: formattedAnswers,
        timeTakenSeconds: timeTaken,
      });
      const att = result.attempt || result;
      setAttempt(att);
      if (att.passed) {
        toast.success(`Тест пройден! ${att.score}%`);
        if (onPass) onPass();
      } else {
        toast(`Результат: ${att.score}%`, { icon: "📊" });
      }
    } catch { toast.error("Ошибка отправки"); }
    finally { setSubmitting(false); }
  }, [test, submitting, answers, groupId, courseId, testId, startTime, onPass]);

  useEffect(() => {
    if (timeLeft === null || attempt) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => Math.max(0, (t ?? 0) - 1)), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, attempt, handleSubmit]);

  if (!testId) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 flex items-center justify-center mb-4">
          <ClipboardList className="w-6 h-6 text-rose-400" />
        </div>
        <p className="text-white/40 text-sm">Тест не привязан к этому блоку</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-rose-400" /></div>;
  }

  if (!test) {
    return <div className="text-center text-white/40 text-sm py-8">Тест не найден</div>;
  }

  const questions = test.questions || [];
  const answered = Object.keys(answers).length;

  // ── Results view ────────────────────────────────────────────────────────────
  if (attempt) {
    const gradedAnswers = attempt.answers || [];
    const correct = gradedAnswers.filter((a: any) => a.correct).length;
    const grade =
      attempt.score >= 90 ? { label: "A+", color: "#34d399" } :
      attempt.score >= 80 ? { label: "A",  color: "#34d399" } :
      attempt.score >= 70 ? { label: "B+", color: "#60a5fa" } :
      attempt.score >= 60 ? { label: "B",  color: "#60a5fa" } :
      attempt.score >= 50 ? { label: "C",  color: "#fbbf24" } :
                            { label: "F",  color: "#f87171" };

    return (
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl p-6 text-center"
          style={{
            background: attempt.passed
              ? "linear-gradient(135deg, rgba(52,211,153,0.12),rgba(99,102,241,0.12))"
              : "linear-gradient(135deg, rgba(248,113,113,0.12),rgba(99,102,241,0.08))",
            border: `1px solid ${attempt.passed ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
          }}
        >
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4", attempt.passed ? "bg-emerald-500/20" : "bg-red-500/20")}>
            {attempt.passed
              ? <Trophy className="w-8 h-8 text-emerald-400" />
              : <AlertCircle className="w-8 h-8 text-red-400" />}
          </div>
          <div className="text-5xl font-black mb-1" style={{ color: grade.color }}>{attempt.score}%</div>
          <div className="text-xl font-bold text-white mb-2">{attempt.passed ? "Тест пройден!" : "Попробуйте снова"}</div>
          <p className="text-white/50 text-sm mb-1">Оценка: <span className="font-bold" style={{ color: grade.color }}>{grade.label}</span></p>
          <p className="text-white/40 text-sm mb-2">{correct} из {questions.length} правильно</p>
          <div className="flex items-center justify-center gap-1.5 text-white/35 text-sm">
            <Clock className="w-4 h-4" />
            {formatTime(attempt.timeTakenSeconds)}
          </div>
          {!attempt.passed && test.allowRetry && (
            <button
              onClick={() => { setAttempt(null); setAnswers({}); setCurrentQ(0); if (test.timeLimitSeconds) setTimeLeft(test.timeLimitSeconds); }}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 text-white/70 text-sm hover:bg-white/12 transition-colors border border-white/10 mx-auto"
            >
              <RotateCcw className="w-4 h-4" />
              Попробовать ещё раз
            </button>
          )}
        </motion.div>

        {/* Answer breakdown */}
        <h3 className="text-white/40 text-xs font-semibold uppercase tracking-wider">Разбор ответов</h3>
        <div className="space-y-2">
          {questions.map((q, i) => {
            const ga = gradedAnswers.find((a: any) => a.questionId === q.id);
            return (
              <div key={q.id} className="rounded-xl p-3.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-start gap-3">
                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", ga?.correct ? "bg-emerald-500/15" : "bg-red-500/15")}>
                    {ga?.correct
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-white/80 text-sm font-medium mb-1">{i + 1}. {q.question}</p>
                    <p className="text-white/45 text-xs">
                      Ваш ответ: <span className={cn("font-medium", ga?.correct ? "text-emerald-400" : "text-red-400")}>
                        {Array.isArray(ga?.userAnswer) ? ga.userAnswer.join(", ") : typeof ga?.userAnswer === "object" ? JSON.stringify(ga?.userAnswer) : String(ga?.userAnswer ?? "—")}
                      </span>
                    </p>
                    {!ga?.correct && ga?.correctAnswer !== undefined && (
                      <p className="text-white/45 text-xs mt-0.5">
                        Правильно: <span className="text-emerald-400 font-medium">
                          {Array.isArray(ga.correctAnswer) ? ga.correctAnswer.join(", ") : typeof ga.correctAnswer === "object" ? JSON.stringify(ga.correctAnswer) : String(ga.correctAnswer)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Test-taking view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Test header */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-white">{test.title}</h3>
            {test.description && <p className="text-white/45 text-sm mt-0.5">{test.description}</p>}
          </div>
          {timeLeft !== null && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono font-bold flex-shrink-0",
              timeLeft < 30 ? "bg-red-500/15 text-red-400 border border-red-500/25" :
              timeLeft < 60 ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" :
                              "bg-white/8 text-white border border-white/10",
            )}>
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-white/40 mb-3">
          <span className="flex items-center gap-1"><Target className="w-3 h-3" />{questions.length} вопросов</span>
          <span>Порог: {test.passingScore}%</span>
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" />За прохождение начисляются очки</span>
        </div>

        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: mode === "all" ? `${(answered / questions.length) * 100}%` : `${((currentQ + 1) / questions.length) * 100}%` }}
            className="h-full bg-rose-500 rounded-full transition-all"
          />
        </div>

        {questions.length > 1 && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => setMode("one")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", mode === "one" ? "bg-rose-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/8")}>
              По одному
            </button>
            <button onClick={() => setMode("all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", mode === "all" ? "bg-rose-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/8")}>
              Все сразу
            </button>
          </div>
        )}
      </div>

      {/* Questions */}
      {mode === "all" ? (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-white font-medium text-sm mb-4 leading-relaxed">
                <span className="text-white/35 mr-2 font-mono">{i + 1}.</span>
                {q.question}
              </p>
              <QuestionView question={q} answer={answers[q.id]} onChange={val => setAnswers(p => ({ ...p, [q.id]: val }))} submitted={false} />
            </motion.div>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={currentQ} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}
            className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/35 text-sm font-mono">Вопрос {currentQ + 1} / {questions.length}</span>
              {answers[questions[currentQ]?.id] !== undefined && (
                <span className="text-emerald-400 text-xs flex items-center gap-1"><Check className="w-3 h-3" />Ответ дан</span>
              )}
            </div>
            <p className="text-white font-medium text-base mb-5 leading-relaxed">{questions[currentQ]?.question}</p>
            <QuestionView
              question={questions[currentQ]}
              answer={answers[questions[currentQ]?.id]}
              onChange={val => setAnswers(p => ({ ...p, [questions[currentQ].id]: val }))}
              submitted={false}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {mode === "one" && (
          <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}
            className="p-2.5 rounded-xl bg-white/5 text-white/50 disabled:opacity-25 hover:bg-white/10 transition-colors border border-white/8">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {mode === "one" && currentQ < questions.length - 1 ? (
          <button onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}
            className="flex-1 py-3 rounded-xl bg-white/8 hover:bg-white/12 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-white/8">
            Следующий
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || answered === 0}
            className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Отправить ответы
          </button>
        )}
      </div>

      <p className="text-center text-white/25 text-xs">
        Отвечено: {answered} из {questions.length}
      </p>
    </div>
  );
}

// ─── Block content dispatcher ─────────────────────────────────────────────────

function BlockContent({
  block, groupId, courseId,
  onStudied, onTestPass,
}: {
  block: Block;
  groupId: string;
  courseId: string;
  onStudied: () => void;
  onTestPass: () => void;
}) {
  switch (block.type) {
    case "text":
      return <TextBlockContent content={block.content} />;
    case "grammar":
      return <GrammarBlockContent content={block.content} />;
    case "cards":
      return <CardsBlockContent content={block.content} onStudied={onStudied} />;
    case "video":
      return <VideoBlockContent content={block.content} />;
    case "test":
      return <InlineTest content={block.content} groupId={groupId} courseId={courseId} onPass={onTestPass} />;
    case "image":
      if (block.content?.url) return (
        <div className="rounded-xl overflow-hidden">
          <img src={block.content.url} alt={block.content.caption || ""} className="w-full max-h-96 object-cover" />
          {block.content.caption && <p className="text-white/40 text-xs text-center mt-2 italic">{block.content.caption}</p>}
        </div>
      );
      return <p className="text-white/30 text-sm italic">Изображение не добавлено</p>;
    case "code":
      return (
        <pre className="bg-black/40 rounded-xl p-4 text-sm text-green-300 font-mono overflow-x-auto">
          <code>{block.content?.code || ""}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary/50 pl-4 italic">
          <p className="text-white/80 text-base">{block.content?.text}</p>
          {block.content?.author && <p className="text-white/40 text-sm mt-1">— {block.content.author}</p>}
        </blockquote>
      );
    case "divider":
      return <hr className="border-white/10" />;
    case "file":
      if (block.content?.url) return (
        <a href={block.content.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <ExternalLink size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{block.content.name || "Файл"}</p>
            <p className="text-xs text-white/40">Скачать файл</p>
          </div>
        </a>
      );
      return null;
    default:
      return <p className="text-white/30 text-sm italic">Неизвестный тип блока</p>;
  }
}

// ─── Stepper view ─────────────────────────────────────────────────────────────

function StepperView({
  blocks,
  currentIndex,
  onNavigate,
  completedIds,
  studiedCardBlockIds,
  onMarkComplete,
  onStudied,
  onTestPass,
  marking,
  groupId,
  courseId,
}: {
  blocks: Block[];
  currentIndex: number;
  onNavigate: (idx: number) => void;
  completedIds: string[];
  studiedCardBlockIds: Set<string>;
  onMarkComplete: (blockId: string) => void;
  onStudied: (blockId: string) => void;
  onTestPass: (blockId: string) => void;
  marking: string | null;
  groupId: string;
  courseId: string;
}) {
  const block = blocks[currentIndex];
  if (!block) return null;

  const isCompleted = completedIds.includes(block.id);
  const isMarking = marking === block.id;

  const isBlockLocked = (idx: number): boolean => {
    for (let i = 0; i < idx; i++) {
      const b = blocks[i];
      if (b.type === "cards" && b.content?.requireBeforeNext && !studiedCardBlockIds.has(b.id)) return true;
    }
    return false;
  };

  const meta = BLOCK_TYPE_META[block.type] || BLOCK_TYPE_META.text;
  const Icon = meta.icon;

  const canGoBack = currentIndex > 0;
  const canGoNext = currentIndex < blocks.length - 1 && !isBlockLocked(currentIndex + 1);
  const showMarkComplete = block.type !== "test" && block.type !== "cards" && block.type !== "divider";

  return (
    <div className="space-y-4">
      {/* Block navigation dots */}
      <div className="flex items-center gap-1.5 flex-wrap pb-1">
        {blocks.map((b, i) => {
          const done = completedIds.includes(b.id);
          const locked = isBlockLocked(i);
          const isCurrent = i === currentIndex;
          const bMeta = BLOCK_TYPE_META[b.type] || BLOCK_TYPE_META.text;
          const BIcon = bMeta.icon;
          const testScore = null; // could extend with progress.testScores if needed
          return (
            <button
              key={b.id}
              onClick={() => {
                if (locked) { toast("Изучите предыдущие карточки, чтобы открыть этот блок", { icon: "🔒" }); return; }
                onNavigate(i);
              }}
              title={b.title || `Блок ${i + 1}`}
              className={cn(
                "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                locked
                  ? "bg-white/3 border-white/6 text-white/20 cursor-not-allowed"
                  : isCurrent
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : done
                      ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25"
                      : "bg-white/5 border-white/8 text-white/40 hover:bg-white/10 hover:text-white/70",
              )}
            >
              {locked ? (
                <Lock className="w-3 h-3" />
              ) : done ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <BIcon className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">{b.title || bMeta.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Current block card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={block.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22 }}
          className={cn(
            "rounded-2xl overflow-hidden",
            isCompleted ? "ring-1 ring-emerald-500/15" : "",
          )}
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Block header */}
          <div className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
              isCompleted ? "bg-emerald-500/20" : "bg-white/5",
            )}>
              {isCompleted
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <Icon className={cn("w-4 h-4", meta.color)} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white/90 font-semibold text-[15px] truncate">{block.title || meta.label}</h3>
              <p className={cn("text-xs", meta.color, "opacity-70")}>{meta.label}</p>
            </div>
            <span className="text-white/20 text-xs font-mono">{currentIndex + 1}/{blocks.length}</span>
          </div>

          {/* Block body */}
          <div className="px-5 py-5">
            <BlockContent
              block={block}
              groupId={groupId}
              courseId={courseId}
              onStudied={() => onStudied(block.id)}
              onTestPass={() => onTestPass(block.id)}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom navigation */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => canGoBack && onNavigate(currentIndex - 1)}
          disabled={!canGoBack}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
            canGoBack
              ? "bg-white/5 border-white/8 text-white/60 hover:bg-white/10 hover:text-white"
              : "bg-white/3 border-white/5 text-white/15 cursor-not-allowed",
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="flex-1" />

        {showMarkComplete && (
          <button
            onClick={() => !isCompleted && !isMarking && onMarkComplete(block.id)}
            disabled={isCompleted || isMarking}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
              isCompleted
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 cursor-default"
                : "bg-white/8 border-white/8 text-white/60 hover:bg-white/12 hover:text-white",
            )}
          >
            {isMarking
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isCompleted
                ? <CheckCircle2 className="w-4 h-4" />
                : <Circle className="w-4 h-4" />}
            {isCompleted ? "Пройдено" : "Отметить пройденным"}
          </button>
        )}

        <button
          onClick={() => canGoNext && onNavigate(currentIndex + 1)}
          disabled={!canGoNext}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
            canGoNext
              ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
              : currentIndex === blocks.length - 1
                ? "bg-white/3 border-white/5 text-white/15 cursor-not-allowed"
                : "bg-white/3 border-white/5 text-white/15 cursor-not-allowed",
          )}
        >
          Вперёд
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CourseViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const groupId = params.id as string;
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingBlock, setMarkingBlock] = useState<string | null>(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [headerUploading, setHeaderUploading] = useState(false);
  const [studiedCardBlockIds, setStudiedCardBlockIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      socialApi.getCourse(groupId, courseId),
      socialApi.getGroup(groupId),
    ]).then(([courseData, groupData]) => {
      setCourse(courseData.course);
      const sorted = (courseData.blocks || []).sort((a: Block, b: Block) => a.orderIndex - b.orderIndex);
      setBlocks(sorted);
      setProgress(courseData.progress);
      setMyRole(groupData.myRole || null);
    }).catch(() => toast.error("Ошибка загрузки курса"))
      .finally(() => setLoading(false));
  }, [groupId, courseId]);

  const completedIds: string[] = progress?.completedBlockIds || [];
  const pct = course?.blockCount ? Math.round((completedIds.length / course.blockCount) * 100) : 0;
  const isTeacher = myRole === "owner" || myRole === "teacher";

  const markComplete = async (blockId: string) => {
    if (completedIds.includes(blockId)) return;
    setMarkingBlock(blockId);
    try {
      const updated = await socialApi.markBlockComplete(groupId, courseId, blockId);
      setProgress(updated);
      toast.success("Отмечено как пройденное!");
      // Auto-advance to next block
      const idx = blocks.findIndex(b => b.id === blockId);
      if (idx >= 0 && idx < blocks.length - 1) {
        setTimeout(() => setCurrentBlockIndex(idx + 1), 400);
      }
    } catch { toast.error("Ошибка"); }
    finally { setMarkingBlock(null); }
  };

  const handleCardBlockStudied = (blockId: string) => {
    setStudiedCardBlockIds(prev => { const s = new Set(prev); s.add(blockId); return s; });
    markComplete(blockId);
    toast.success("Карточки изучены! Следующий блок разблокирован.");
  };

  const handleTestPass = (blockId: string) => {
    // Mark test block complete and advance
    markComplete(blockId);
  };

  const handleHeaderUpload = async (file: File) => {
    setHeaderUploading(true);
    try {
      const result = await socialApi.uploadMedia(file);
      if (result?.url) {
        await socialApi.updateCourse(groupId, courseId, { imageUrl: result.url });
        setCourse(c => c ? { ...c, imageUrl: result.url } : c);
        toast.success("Обложка обновлена");
      }
    } catch { toast.error("Ошибка загрузки изображения"); }
    finally { setHeaderUploading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!course) return <div className="text-center text-white/50 py-20">Курс не найден</div>;

  const pattern = getPatternForId(courseId);

  return (
    <div className="w-full max-w-none">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад
      </button>

      {/* Course header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <PatternHeader
          color={course.color}
          imageUrl={course.imageUrl}
          pattern={pattern}
          height={180}
          onImageUpload={isTeacher ? handleHeaderUpload : undefined}
          uploading={headerUploading}
        >
          <div className="h-full flex flex-col justify-end px-6 pb-5">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <span className="text-5xl mb-2 block drop-shadow-lg">{course.emoji}</span>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl font-bold text-white drop-shadow-md">{course.title}</h1>
                  {isTeacher && (
                    <Link href={`/groups/${groupId}/courses/${courseId}/edit`}>
                      <button className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm">
                        <Edit3 className="w-3.5 h-3.5 text-white/80" />
                      </button>
                    </Link>
                  )}
                </div>
                {course.description && (
                  <p className="text-white/65 text-sm mb-2 line-clamp-2">{course.description}</p>
                )}
                <div className="flex items-center gap-3 text-white/50 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-black/20 backdrop-blur-sm">
                    {LEVEL_LABELS[course.level] || course.level}
                  </span>
                  <span>{course.blockCount} блоков</span>
                  {pct > 0 && (
                    <span className={cn("flex items-center gap-1", pct === 100 ? "text-emerald-400" : "text-indigo-400")}>
                      <Award className="w-3 h-3" />
                      {pct}% пройдено
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Progress bar */}
            {course.blockCount > 0 && (
              <div className="mt-3">
                <div className="h-1.5 bg-white/15 rounded-full overflow-hidden backdrop-blur-sm">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-400" : "bg-white")}
                  />
                </div>
              </div>
            )}
          </div>
        </PatternHeader>
      </motion.div>

      {/* Stepper or empty state */}
      {blocks.length === 0 ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Блоков пока нет</p>
        </div>
      ) : (
        <StepperView
          blocks={blocks}
          currentIndex={currentBlockIndex}
          onNavigate={setCurrentBlockIndex}
          completedIds={completedIds}
          studiedCardBlockIds={studiedCardBlockIds}
          onMarkComplete={markComplete}
          onStudied={handleCardBlockStudied}
          onTestPass={handleTestPass}
          marking={markingBlock}
          groupId={groupId}
          courseId={courseId}
        />
      )}

      {/* Completion celebration */}
      <AnimatePresence>
        {pct === 100 && blocks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl p-6 text-center"
            style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.12), rgba(99,102,241,0.12))", border: "1px solid rgba(52,211,153,0.2)" }}
          >
            <Award className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-bold text-lg mb-1">Курс пройден!</p>
            <p className="text-white/50 text-sm">Вы завершили все блоки этого курса</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
