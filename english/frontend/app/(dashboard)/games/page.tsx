"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer, Zap, Volume2, BookmarkPlus, RotateCcw,
  Trophy, ChevronRight, Check, Lightbulb, Star,
  Gamepad2, ArrowRight, Flame, Shuffle, AlignLeft,
  MousePointerClick, Layers, SplitSquareHorizontal, X,
  ArrowLeft, Clock, Target, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiApi, gamesApi, cardsApi } from "@/api/client";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { speakEnglishText } from "@/lib/tts";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameState = "menu" | "playing" | "result";
type GameType = "association" | "scramble" | "fillblank" | "speed" | "match" | "sentence";
type Difficulty = "easy" | "medium" | "hard";

interface Card {
  id: string;
  front: string;
  back: string;
  pronunciation?: string;
  examples?: string[];
  tags?: string[];
}

interface GameWord {
  targetWord: string;
  clues: string[];
  category: string;
  definition: string;
  translation: string;
  pronunciation: string;
  examples: string[];
}

interface GameResult {
  score: number;
  correct: number;
  total: number;
  xp: number;
  wordsLearned: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTIES: { id: Difficulty; label: string; desc: string; color: string; border: string; text: string; icon: string }[] = [
  { id: "easy",   label: "Лёгкий",  desc: "A1–A2 • больше времени",   color: "from-emerald-500/20 to-green-500/10",  border: "border-emerald-500/30",  text: "text-emerald-500",  icon: "🌱" },
  { id: "medium", label: "Средний", desc: "B1–B2 • стандартное время", color: "from-blue-500/20 to-indigo-500/10",    border: "border-blue-500/30",     text: "text-blue-500",     icon: "⚡" },
  { id: "hard",   label: "Сложный", desc: "C1–C2 • минимум подсказок", color: "from-red-500/20 to-orange-500/10",     border: "border-red-500/30",      text: "text-red-500",      icon: "🔥" },
];

const GAME_DEFS: {
  id: GameType; title: string; desc: string; icon: React.ReactNode;
  gradient: string; iconBg: string; tag: string;
}[] = [
  {
    id: "association",
    title: "Ассоциации",
    desc: "AI даёт подсказки — угадай английское слово",
    icon: <Lightbulb size={22} />,
    gradient: "from-violet-600 to-purple-700",
    iconBg: "bg-violet-500/20",
    tag: "AI",
  },
  {
    id: "scramble",
    title: "Анаграмма",
    desc: "Восстанови перепутанные буквы слова",
    icon: <Shuffle size={22} />,
    gradient: "from-orange-500 to-amber-600",
    iconBg: "bg-orange-500/20",
    tag: "Карточки",
  },
  {
    id: "fillblank",
    title: "Заполни пропуск",
    desc: "Выбери правильное слово для предложения",
    icon: <AlignLeft size={22} />,
    gradient: "from-teal-500 to-cyan-600",
    iconBg: "bg-teal-500/20",
    tag: "Грамматика",
  },
  {
    id: "speed",
    title: "Скоростной раунд",
    desc: "60 секунд: знаешь слово? Жми быстрее!",
    icon: <Zap size={22} />,
    gradient: "from-red-500 to-rose-600",
    iconBg: "bg-red-500/20",
    tag: "Скорость",
  },
  {
    id: "match",
    title: "Найди пару",
    desc: "Соедини слова с переводами — как Duolingo",
    icon: <MousePointerClick size={22} />,
    gradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-blue-500/20",
    tag: "Пары",
  },
  {
    id: "sentence",
    title: "Составь предложение",
    desc: "Расставь слова в правильном порядке",
    icon: <SplitSquareHorizontal size={22} />,
    gradient: "from-pink-500 to-fuchsia-600",
    iconBg: "bg-pink-500/20",
    tag: "Предложения",
  },
];

const TOTAL_ROUNDS = 5;

function scramble(word: string): string {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // ensure it's actually different
  if (arr.join("") === word && word.length > 1) return scramble(word);
  return arr.join("");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function GameHeader({
  score, round, total, timeLeft, maxTime, onBack,
}: {
  score: number; round?: number; total?: number;
  timeLeft?: number; maxTime?: number; onBack: () => void;
}) {
  const timerPct = maxTime && timeLeft !== undefined ? (timeLeft / maxTime) * 100 : 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack}
            className="p-1.5 rounded-xl bg-accent hover:bg-accent/80 text-muted-foreground transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-sm font-semibold">
            <Flame size={13} className="text-orange-500" />
            {score}
          </div>
          {round !== undefined && total !== undefined && (
            <span className="text-xs text-muted-foreground">{round + 1}/{total}</span>
          )}
        </div>
        {timeLeft !== undefined && (
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold transition-colors",
            timeLeft <= 10 ? "bg-red-500/15 text-red-500" : "bg-accent"
          )}>
            <Timer size={13} className={timeLeft <= 10 ? "animate-pulse" : ""} />
            {timeLeft}с
          </div>
        )}
      </div>
      {maxTime && timeLeft !== undefined && (
        <div className="h-1 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full transition-colors",
              timeLeft <= 10 ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-violet-500")}
            style={{ width: `${timerPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      )}
      {round !== undefined && total !== undefined && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={cn(
              "h-1.5 rounded-full transition-all",
              i < round ? "bg-emerald-500 w-6" : i === round ? "bg-primary w-8" : "bg-border w-4"
            )} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultScreen({
  result, gameName, onMenu, onPlayAgain, loading,
}: {
  result: GameResult; gameName: string;
  onMenu: () => void; onPlayAgain: () => void; loading: boolean;
}) {
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
  const msg = pct >= 80 ? "Отличный результат!" : pct >= 50 ? "Хорошая попытка!" : "Продолжайте практиковаться!";
  return (
    <div className="max-w-md mx-auto page-enter">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5">
        <div className="pt-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Trophy size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold">{gameName} — завершено!</h2>
          <p className="text-muted-foreground text-sm mt-1">{msg}</p>
        </div>
        <div className="glass-card rounded-2xl p-5 space-y-3">
          {[
            { label: "Очки", value: result.score, cls: "gradient-text text-2xl font-bold" },
            { label: "XP заработано", value: `+${result.xp} XP`, cls: "text-yellow-500 font-semibold" },
            { label: "Правильных", value: `${result.correct}/${result.total}`, cls: "text-emerald-500 font-semibold" },
            { label: "Слов изучено", value: result.wordsLearned.length, cls: "text-blue-500 font-semibold" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className={row.cls}>{row.value}</span>
            </div>
          ))}
          <div className="mt-2">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
            </div>
            <div className="text-[10px] text-muted-foreground text-right mt-1">{pct}% точность</div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={onMenu}>
            <RotateCcw size={15} />Меню
          </Button>
          <Button className="flex-1 btn-gradient gap-2" onClick={onPlayAgain} disabled={loading}>
            <ArrowRight size={15} />Ещё раз
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Сложность</p>
      {DIFFICULTIES.map((d) => (
        <motion.button key={d.id} whileTap={{ scale: 0.98 }}
          onClick={() => onChange(d.id)}
          className={cn(
            "w-full flex items-center gap-3 p-3.5 rounded-2xl border bg-gradient-to-r transition-all text-left",
            value === d.id
              ? `${d.color} ${d.border} ring-2 ring-offset-1 ring-offset-background ring-current ${d.text}`
              : "border-border/50 hover:border-border bg-card/50"
          )}>
          <span className="text-xl">{d.icon}</span>
          <div className="flex-1">
            <div className={cn("font-semibold text-sm", value === d.id ? d.text : "")}>{d.label}</div>
            <div className="text-xs text-muted-foreground">{d.desc}</div>
          </div>
          <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            value === d.id ? `border-current ${d.text}` : "border-border")}>
            {value === d.id && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
          </div>
        </motion.button>
      ))}
    </div>
  );
}

// ─── Association Game ─────────────────────────────────────────────────────────

function AssociationGame({ difficulty, onResult }: { difficulty: Difficulty; onResult: (r: GameResult) => void }) {
  const [currentWord, setCurrentWord] = useState<GameWord | null>(null);
  const [revealedClues, setRevealedClues] = useState(1);
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [savedWords, setSavedWords] = useState<string[]>([]);

  const loadNextWord = useCallback(async (used: string[]) => {
    setLoading(true);
    setCurrentWord(null);
    setRevealedClues(1); setGuess(""); setRevealed(false); setTimeLeft(30);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const word: GameWord = await aiApi.associationGame({ words: used, difficulty });
        const norm = word?.targetWord?.trim().toLowerCase();
        if (norm && !used.some(w => w.trim().toLowerCase() === norm)) {
          setCurrentWord(word);
          break;
        }
      }
    } catch { toast.error("Ошибка загрузки слова"); }
    finally { setLoading(false); }
  }, [difficulty]);

  useEffect(() => { loadNextWord([]); }, [loadNextWord]);

  useEffect(() => {
    if (!currentWord || revealed) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); setRevealed(true); setRevealedClues(currentWord.clues.length); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [currentWord, revealed]);

  const finishRound = (wasCorrect: boolean, pts: number, nextCorrect: number, newUsed: string[]) => {
    const newRound = round + 1;
    setRound(newRound);
    if (newRound >= TOTAL_ROUNDS) {
      onResult({ score: score + pts, correct: nextCorrect, total: TOTAL_ROUNDS, xp: score + pts, wordsLearned: newUsed });
    } else {
      setTimeout(() => loadNextWord(newUsed), 400);
    }
  };

  const handleGuess = () => {
    if (!currentWord || !guess.trim()) return;
    const isCorrect = guess.trim().toLowerCase() === currentWord.targetWord.toLowerCase();
    if (isCorrect) {
      const pts = Math.max(10, 50 - (revealedClues - 1) * 10) + Math.floor(timeLeft * 0.5);
      const nc = correct + 1;
      setScore(s => s + pts);
      setCorrect(nc);
      toast.success(`+${pts} очков!`);
      const newUsed = [...usedWords, currentWord.targetWord];
      setUsedWords(newUsed);
      setRevealed(true);
      setRevealedClues(currentWord.clues.length);
      setTimeout(() => finishRound(true, pts, nc, newUsed), 1200);
    } else {
      toast.error("Неверно — попробуй ещё");
    }
  };

  const handleReveal = () => {
    if (!currentWord) return;
    setRevealed(true);
    setRevealedClues(currentWord.clues.length);
  };

  const skipRound = () => {
    if (!currentWord) return;
    const newUsed = [...usedWords, currentWord.targetWord];
    setUsedWords(newUsed);
    finishRound(false, 0, correct, newUsed);
  };

  const handleSaveWord = async () => {
    if (!currentWord || savedWords.includes(currentWord.targetWord)) return;
    try {
      await gamesApi.saveWord({
        front: currentWord.targetWord, back: currentWord.translation,
        pronunciation: currentWord.pronunciation, examples: currentWord.examples,
        tags: [currentWord.category, "game"],
      });
      setSavedWords(s => [...s, currentWord.targetWord]);
      toast.success(`"${currentWord.targetWord}" добавлено в карточки`);
    } catch { toast.error("Ошибка сохранения"); }
  };

  const diff = DIFFICULTIES.find(d => d.id === difficulty);

  return (
    <div className="space-y-4">
      <GameHeader
        score={score} round={round} total={TOTAL_ROUNDS}
        timeLeft={timeLeft} maxTime={30}
        onBack={() => onResult({ score, correct, total: TOTAL_ROUNDS, xp: score, wordsLearned: usedWords })}
      />
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-border border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">AI придумывает слово...</p>
        </div>
      ) : currentWord && (
        <AnimatePresence mode="wait">
          <motion.div key={currentWord.targetWord} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-lg border", diff?.color, diff?.border, diff?.text)}>
                {currentWord.category}
              </span>
              <span className="text-xs text-muted-foreground">Подсказка {revealedClues}/{currentWord.clues.length}</span>
            </div>
            <div className="space-y-2">
              {currentWord.clues.slice(0, revealedClues).map((clue, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn("flex items-start gap-3 p-3.5 rounded-xl text-sm",
                    i === revealedClues - 1 ? "bg-primary/10 border border-primary/20" : "bg-accent/60")}>
                  <span className="text-xs font-bold text-muted-foreground w-4 flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="leading-relaxed">{clue}</span>
                </motion.div>
              ))}
            </div>
            {revealed ? (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-green-500/5 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-2xl font-bold">{currentWord.targetWord}</div>
                    <div className="text-sm font-mono text-muted-foreground">{currentWord.pronunciation}</div>
                    <div className="text-sm font-semibold mt-1">{currentWord.translation}</div>
                  </div>
                  <button onClick={() => speakEnglishText(currentWord.targetWord)}
                    className="p-2 rounded-xl bg-accent hover:bg-accent/80 transition-colors">
                    <Volume2 size={16} />
                  </button>
                </div>
                {currentWord.examples[0] && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-emerald-500/30 pl-3 mb-3">
                    "{currentWord.examples[0]}"
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSaveWord}
                    disabled={savedWords.includes(currentWord.targetWord)}>
                    <BookmarkPlus size={13} />
                    {savedWords.includes(currentWord.targetWord) ? "Сохранено" : "В карточки"}
                  </Button>
                  <Button size="sm" className="btn-gradient gap-1.5 flex-1" onClick={skipRound}>
                    {round + 1 >= TOTAL_ROUNDS ? "Завершить" : "Следующее"}
                    <ChevronRight size={13} />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={guess} onChange={e => setGuess(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleGuess()}
                    placeholder="Введи слово по-английски..."
                    className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus />
                  <Button className="btn-gradient h-11 px-4" onClick={handleGuess} disabled={!guess.trim()}>
                    <Check size={16} />
                  </Button>
                </div>
                <div className="flex gap-2">
                  {revealedClues < currentWord.clues.length && (
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1"
                      onClick={() => setRevealedClues(p => Math.min(p + 1, currentWord.clues.length))}>
                      <Lightbulb size={13} className="text-yellow-500" />
                      Подсказка ({currentWord.clues.length - revealedClues} ост.)
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleReveal}>
                    Показать ответ
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Word Scramble ────────────────────────────────────────────────────────────

function ScrambleGame({ difficulty, onResult }: { difficulty: Difficulty; onResult: (r: GameResult) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [scrambled, setScrambled] = useState("");
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(difficulty === "easy" ? 45 : difficulty === "medium" ? 30 : 20);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const maxTime = difficulty === "easy" ? 45 : difficulty === "medium" ? 30 : 20;

  useEffect(() => {
    cardsApi.getCards().then((data: Card[]) => {
      setCards(data);
      setLoading(false);
      pickCard(data, []);
    }).catch(() => { toast.error("Ошибка загрузки карточек"); setLoading(false); });
  }, []);

  const pickCard = (allCards: Card[], used: string[]) => {
    const available = allCards.filter(c => !used.includes(c.id) && c.front.trim().length >= 3);
    if (!available.length) {
      onResult({ score, correct, total: TOTAL_ROUNDS, xp: score, wordsLearned: [] });
      return;
    }
    const card = available[Math.floor(Math.random() * available.length)];
    setCurrentCard(card);
    setScrambled(scramble(card.front.toLowerCase()));
    setGuess(""); setRevealed(false); setFeedback(null);
    setTimeLeft(maxTime);
  };

  useEffect(() => {
    if (loading || !currentCard || revealed) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); handleReveal(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loading, currentCard, revealed]);

  const handleGuess = () => {
    if (!currentCard || !guess.trim()) return;
    const isCorrect = guess.trim().toLowerCase() === currentCard.front.toLowerCase();
    if (isCorrect) {
      const pts = Math.max(5, Math.floor(timeLeft * 2));
      setScore(s => s + pts);
      setCorrect(c => c + 1);
      setFeedback("correct");
      toast.success(`+${pts} очков!`);
      setTimeout(() => nextRound(true), 800);
    } else {
      setFeedback("wrong");
      setTimeout(() => setFeedback(null), 600);
    }
  };

  const handleReveal = () => { setRevealed(true); };

  const nextRound = (wasCorrect: boolean) => {
    if (!currentCard) return;
    const newUsed = [...usedIds, currentCard.id];
    setUsedIds(newUsed);
    const newRound = round + 1;
    setRound(newRound);
    if (newRound >= TOTAL_ROUNDS) {
      onResult({
        score: score + (wasCorrect ? Math.max(5, Math.floor(timeLeft * 2)) : 0),
        correct: correct + (wasCorrect ? 1 : 0),
        total: TOTAL_ROUNDS, xp: score, wordsLearned: [currentCard.front],
      });
    } else {
      setTimeout(() => pickCard(cards, newUsed), 300);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-border border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Загрузка карточек...</p>
    </div>
  );

  if (!cards.length) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-muted-foreground">У вас ещё нет карточек.</p>
      <Button variant="outline" onClick={() => onResult({ score: 0, correct: 0, total: 0, xp: 0, wordsLearned: [] })}>
        Назад
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <GameHeader score={score} round={round} total={TOTAL_ROUNDS} timeLeft={timeLeft} maxTime={maxTime}
        onBack={() => onResult({ score, correct, total: TOTAL_ROUNDS, xp: score, wordsLearned: [] })} />
      {currentCard && (
        <AnimatePresence mode="wait">
          <motion.div key={currentCard.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }} className="space-y-4">
            <div className="glass-card rounded-2xl p-5 text-center space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Перевод (подсказка)</p>
              <p className="text-lg font-semibold">{currentCard.back}</p>
            </div>
            <div className="glass-card rounded-2xl p-5 text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Перемешанные буквы</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {scrambled.split("").map((ch, i) => (
                  <div key={i} className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center font-bold text-base uppercase">
                    {ch}
                  </div>
                ))}
              </div>
            </div>
            {revealed ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
                <p className="text-xs text-muted-foreground">Правильный ответ</p>
                <p className="text-2xl font-bold">{currentCard.front}</p>
                <Button className="btn-gradient w-full gap-2" onClick={() => nextRound(false)}>
                  {round + 1 >= TOTAL_ROUNDS ? "Завершить" : "Следующее"} <ChevronRight size={15} />
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-3">
                <motion.div animate={feedback === "wrong" ? { x: [-6, 6, -4, 4, 0] } : {}}
                  transition={{ duration: 0.3 }}>
                  <div className="flex gap-2">
                    <input value={guess} onChange={e => setGuess(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleGuess()}
                      placeholder="Введи слово..."
                      className={cn(
                        "flex-1 h-11 rounded-xl border bg-background px-4 text-sm focus:outline-none focus:ring-1 transition-colors uppercase",
                        feedback === "correct" ? "border-emerald-500 ring-1 ring-emerald-500" :
                          feedback === "wrong" ? "border-red-500 ring-1 ring-red-500" : "border-input focus:ring-ring"
                      )}
                      autoFocus />
                    <Button className="btn-gradient h-11 px-4" onClick={handleGuess} disabled={!guess.trim()}>
                      <Check size={16} />
                    </Button>
                  </div>
                </motion.div>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleReveal}>
                  Показать ответ
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Fill the Blank ───────────────────────────────────────────────────────────

function FillBlankGame({ difficulty, onResult }: { difficulty: Difficulty; onResult: (r: GameResult) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [question, setQuestion] = useState<{ sentence: string; answer: string; options: string[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(difficulty === "easy" ? 999 : difficulty === "medium" ? 20 : 10);
  const [loading, setLoading] = useState(true);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const maxTime = difficulty === "easy" ? 999 : difficulty === "medium" ? 20 : 10;
  const showTimer = difficulty !== "easy";

  useEffect(() => {
    cardsApi.getCards().then((data: Card[]) => {
      setCards(data);
      setLoading(false);
      buildQuestion(data, []);
    }).catch(() => { toast.error("Ошибка загрузки карточек"); setLoading(false); });
  }, []);

  const buildQuestion = (allCards: Card[], used: string[]) => {
    const withExamples = allCards.filter(c => c.examples?.length && !used.includes(c.front));
    const pool = withExamples.length >= 4 ? withExamples : allCards.filter(c => !used.includes(c.front));
    if (!pool.length) {
      onResult({ score, correct, total: TOTAL_ROUNDS, xp: score, wordsLearned: used });
      return;
    }
    const card = pool[Math.floor(Math.random() * pool.length)];
    // use first example or fabricate a simple sentence
    let sentence = card.examples?.[0] || `I want to ${card.front} something today.`;
    const word = card.front.toLowerCase();
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    if (!regex.test(sentence)) {
      sentence = `${card.front} is an important English word.`;
    }
    const blanked = sentence.replace(new RegExp(`\\b${word}\\b`, "gi"), "____");

    // pick 3 wrong options
    const others = allCards.filter(c => c.front.toLowerCase() !== word);
    const decoys = shuffle(others).slice(0, 3).map(c => c.front);
    const options = shuffle([card.front, ...decoys]);

    setQuestion({ sentence: blanked, answer: card.front, options });
    setSelected(null);
    setTimeLeft(maxTime);
  };

  useEffect(() => {
    if (loading || !question || selected || !showTimer) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); handleSelect("__timeout__"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loading, question, selected, showTimer]);

  const handleSelect = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    const isCorrect = opt.toLowerCase() === question?.answer.toLowerCase();
    if (isCorrect) {
      const pts = showTimer ? Math.max(5, timeLeft * 3) : 20;
      setScore(s => s + pts);
      setCorrect(c => c + 1);
      toast.success(`+${pts} очков!`);
    } else if (opt !== "__timeout__") {
      toast.error("Неверно!");
    }
    const newUsed = [...usedWords, question?.answer || ""];
    setUsedWords(newUsed);
    setTimeout(() => {
      const newRound = round + 1;
      setRound(newRound);
      if (newRound >= TOTAL_ROUNDS) {
        onResult({ score: score + (isCorrect ? (showTimer ? Math.max(5, timeLeft * 3) : 20) : 0), correct: correct + (isCorrect ? 1 : 0), total: TOTAL_ROUNDS, xp: score, wordsLearned: newUsed });
      } else {
        buildQuestion(cards, newUsed);
      }
    }, 1000);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-border border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Загрузка...</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <GameHeader score={score} round={round} total={TOTAL_ROUNDS}
        timeLeft={showTimer ? timeLeft : undefined} maxTime={showTimer ? maxTime : undefined}
        onBack={() => onResult({ score, correct, total: TOTAL_ROUNDS, xp: score, wordsLearned: usedWords })} />
      {question && (
        <AnimatePresence mode="wait">
          <motion.div key={question.sentence} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }} className="space-y-5">
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Заполни пропуск</p>
              <p className="text-base leading-relaxed font-medium">{question.sentence}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {question.options.map((opt) => {
                const isAnswer = opt.toLowerCase() === question.answer.toLowerCase();
                const isSelected = selected === opt;
                let cls = "border-border/50 hover:border-border bg-card/50 hover:bg-accent/50";
                if (selected) {
                  if (isAnswer) cls = "border-emerald-500 bg-emerald-500/15 text-emerald-600";
                  else if (isSelected) cls = "border-red-500 bg-red-500/15 text-red-600";
                }
                return (
                  <motion.button key={opt} whileTap={{ scale: 0.97 }}
                    onClick={() => handleSelect(opt)}
                    disabled={!!selected}
                    className={cn("p-3.5 rounded-xl border text-sm font-medium text-left transition-all", cls)}>
                    {opt}
                    {selected && isAnswer && <Check size={14} className="inline ml-1 text-emerald-500" />}
                    {selected && isSelected && !isAnswer && <X size={14} className="inline ml-1 text-red-500" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Speed Round ──────────────────────────────────────────────────────────────

function SpeedGame({ difficulty, onResult }: { difficulty: Difficulty; onResult: (r: GameResult) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [queue, setQueue] = useState<Card[]>([]);
  const [current, setCurrent] = useState<Card | null>(null);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [totalTime] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [wordsLearned, setWordsLearned] = useState<string[]>([]);

  useEffect(() => {
    cardsApi.getCards().then((data: Card[]) => {
      setCards(data);
      const q = shuffle(data);
      setQueue(q);
      setCurrent(q[0] || null);
      setLoading(false);
    }).catch(() => { toast.error("Ошибка загрузки карточек"); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!started || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          onResult({ score, correct, total: answeredCount, xp: score, wordsLearned });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, timeLeft]);

  const next = () => {
    setQueue(q => {
      const remaining = q.slice(1);
      setCurrent(remaining[0] || null);
      return remaining;
    });
    setFlipped(false);
  };

  const handleKnow = () => {
    if (!current) return;
    const bonus = difficulty === "easy" ? 5 : difficulty === "medium" ? 10 : 15;
    setScore(s => s + bonus);
    setCorrect(c => c + 1);
    setAnsweredCount(c => c + 1);
    setWordsLearned(w => [...w, current.front]);
    next();
  };

  const handleDontKnow = () => {
    if (!current) return;
    setAnsweredCount(c => c + 1);
    next();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-border border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Загрузка карточек...</p>
    </div>
  );

  if (!started) return (
    <div className="space-y-4">
      <GameHeader score={0} onBack={() => onResult({ score: 0, correct: 0, total: 0, xp: 0, wordsLearned: [] })} />
      <div className="glass-card rounded-2xl p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto">
          <Zap size={28} className="text-white" />
        </div>
        <h3 className="text-xl font-bold">Скоростной раунд</h3>
        <p className="text-sm text-muted-foreground">60 секунд. Смотришь на слово — жмёшь «Знаю» или «Не знаю». Как можно быстрее!</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="font-bold text-emerald-500">+{difficulty === "easy" ? 5 : difficulty === "medium" ? 10 : 15}</p>
            <p className="text-muted-foreground text-xs">за «Знаю»</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="font-bold text-muted-foreground">{cards.length}</p>
            <p className="text-muted-foreground text-xs">карточек</p>
          </div>
        </div>
        <Button className="w-full btn-gradient h-12 gap-2 text-base" onClick={() => setStarted(true)}>
          <Zap size={18} />Старт!
        </Button>
      </div>
    </div>
  );

  if (!current) {
    onResult({ score, correct, total: answeredCount, xp: score, wordsLearned });
    return null;
  }

  return (
    <div className="space-y-4">
      <GameHeader score={score} timeLeft={timeLeft} maxTime={totalTime}
        onBack={() => onResult({ score, correct, total: answeredCount, xp: score, wordsLearned })} />
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{answeredCount} отвечено</span>
        <span>{correct} правильно</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={current.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.15 }}>
          <div className="glass-card rounded-2xl p-8 text-center space-y-4 cursor-pointer min-h-[180px] flex flex-col items-center justify-center"
            onClick={() => setFlipped(f => !f)}>
            <AnimatePresence mode="wait">
              {!flipped ? (
                <motion.div key="front" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-2">
                  <p className="text-xs text-muted-foreground">Английское слово</p>
                  <p className="text-2xl font-bold">{current.front}</p>
                  {current.pronunciation && <p className="text-sm font-mono text-muted-foreground">{current.pronunciation}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Нажми чтобы увидеть перевод</p>
                </motion.div>
              ) : (
                <motion.div key="back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-2">
                  <p className="text-xs text-muted-foreground">Перевод</p>
                  <p className="text-2xl font-bold">{current.back}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" className="h-14 gap-2 border-red-500/30 hover:bg-red-500/10 hover:text-red-500 text-base"
          onClick={handleDontKnow}>
          <X size={18} />Не знаю
        </Button>
        <Button size="lg" className="h-14 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-base"
          onClick={handleKnow}>
          <Check size={18} />Знаю!
        </Button>
      </div>
    </div>
  );
}

// ─── Word Match ───────────────────────────────────────────────────────────────

const MATCH_PAIRS = 6;

function MatchGame({ difficulty, onResult }: { difficulty: Difficulty; onResult: (r: GameResult) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [pairs, setPairs] = useState<Card[]>([]);
  const [leftSelected, setLeftSelected] = useState<string | null>(null);
  const [rightSelected, setRightSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongFlash, setWrongFlash] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(difficulty === "easy" ? 90 : difficulty === "medium" ? 60 : 40);
  const [loading, setLoading] = useState(true);
  const [roundCount, setRoundCount] = useState(0);
  const maxTime = difficulty === "easy" ? 90 : difficulty === "medium" ? 60 : 40;
  const totalSets = TOTAL_ROUNDS;

  const [leftWords, setLeftWords] = useState<string[]>([]);
  const [rightWords, setRightWords] = useState<string[]>([]);

  useEffect(() => {
    cardsApi.getCards().then((data: Card[]) => {
      setCards(data);
      setLoading(false);
      loadSet(data, 0);
    }).catch(() => { toast.error("Ошибка загрузки"); setLoading(false); });
  }, []);

  const loadSet = (allCards: Card[], setIdx: number) => {
    const available = shuffle(allCards).slice(setIdx * MATCH_PAIRS, setIdx * MATCH_PAIRS + MATCH_PAIRS);
    if (!available.length) {
      onResult({ score, correct, total: totalSets * MATCH_PAIRS, xp: score, wordsLearned: [] });
      return;
    }
    setPairs(available);
    setLeftWords(shuffle(available.map(c => c.front)));
    setRightWords(shuffle(available.map(c => c.back)));
    setLeftSelected(null); setRightSelected(null); setMatched([]);
    setTimeLeft(maxTime);
  };

  useEffect(() => {
    if (loading || matched.length === pairs.length * 2) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); finishSet(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loading, pairs, matched]);

  const finishSet = () => {
    const newRound = roundCount + 1;
    setRoundCount(newRound);
    if (newRound >= totalSets) {
      onResult({ score, correct, total: totalSets * MATCH_PAIRS, xp: score, wordsLearned: [] });
    } else {
      setTimeout(() => loadSet(cards, newRound), 500);
    }
  };

  const tryMatch = (left: string, right: string) => {
    const card = pairs.find(c => c.front === left);
    if (card && card.back === right) {
      // correct
      const pts = difficulty === "easy" ? 10 : difficulty === "medium" ? 15 : 25;
      setScore(s => s + pts);
      setCorrect(c => c + 1);
      setMatched(m => [...m, left, right]);
      setLeftSelected(null); setRightSelected(null);
      toast.success(`+${pts}!`);
      if (matched.length + 2 >= pairs.length * 2) setTimeout(finishSet, 600);
    } else {
      setWrongFlash([left, right]);
      setTimeout(() => { setWrongFlash([]); setLeftSelected(null); setRightSelected(null); }, 600);
    }
  };

  const handleLeft = (word: string) => {
    if (matched.includes(word)) return;
    setLeftSelected(word);
    if (rightSelected) tryMatch(word, rightSelected);
  };

  const handleRight = (word: string) => {
    if (matched.includes(word)) return;
    setRightSelected(word);
    if (leftSelected) tryMatch(leftSelected, word);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-border border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Загрузка...</p>
    </div>
  );

  const progress = pairs.length > 0 ? matched.length / (pairs.length * 2) : 0;

  return (
    <div className="space-y-4">
      <GameHeader score={score} round={roundCount} total={totalSets} timeLeft={timeLeft} maxTime={maxTime}
        onBack={() => onResult({ score, correct, total: totalSets * MATCH_PAIRS, xp: score, wordsLearned: [] })} />
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
          style={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {leftWords.map(word => {
            const isMatched = matched.includes(word);
            const isSelected = leftSelected === word;
            const isWrong = wrongFlash.includes(word);
            return (
              <motion.button key={word}
                animate={isWrong ? { x: [-4, 4, -3, 3, 0] } : {}}
                transition={{ duration: 0.3 }}
                onClick={() => handleLeft(word)}
                disabled={isMatched}
                className={cn(
                  "w-full p-3 rounded-xl border text-sm font-medium text-left transition-all",
                  isMatched ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 opacity-60" :
                    isWrong ? "border-red-500 bg-red-500/15 text-red-500" :
                      isSelected ? "border-blue-500 bg-blue-500/15 text-blue-600 ring-1 ring-blue-500" :
                        "border-border/50 hover:border-border bg-card/50 hover:bg-accent/50"
                )}>
                {word}
                {isMatched && <Check size={12} className="inline ml-1" />}
              </motion.button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rightWords.map(word => {
            const isMatched = matched.includes(word);
            const isSelected = rightSelected === word;
            const isWrong = wrongFlash.includes(word);
            return (
              <motion.button key={word}
                animate={isWrong ? { x: [-4, 4, -3, 3, 0] } : {}}
                transition={{ duration: 0.3 }}
                onClick={() => handleRight(word)}
                disabled={isMatched}
                className={cn(
                  "w-full p-3 rounded-xl border text-sm font-medium text-left transition-all",
                  isMatched ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 opacity-60" :
                    isWrong ? "border-red-500 bg-red-500/15 text-red-500" :
                      isSelected ? "border-indigo-500 bg-indigo-500/15 text-indigo-600 ring-1 ring-indigo-500" :
                        "border-border/50 hover:border-border bg-card/50 hover:bg-accent/50"
                )}>
                {word}
                {isMatched && <Check size={12} className="inline ml-1" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Sentence Builder ─────────────────────────────────────────────────────────

function SentenceGame({ difficulty, onResult }: { difficulty: Difficulty; onResult: (r: GameResult) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [sentence, setSentence] = useState<string[]>([]);
  const [wordBank, setWordBank] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(difficulty === "easy" ? 999 : difficulty === "medium" ? 40 : 25);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [usedExamples, setUsedExamples] = useState<string[]>([]);
  const maxTime = difficulty === "easy" ? 999 : difficulty === "medium" ? 40 : 25;
  const showTimer = difficulty !== "easy";

  useEffect(() => {
    cardsApi.getCards().then((data: Card[]) => {
      setCards(data);
      setLoading(false);
      loadSentence(data, []);
    }).catch(() => { toast.error("Ошибка загрузки"); setLoading(false); });
  }, []);

  const loadSentence = (allCards: Card[], used: string[]) => {
    const withEx = allCards.filter(c => c.examples?.length && !used.includes(c.examples[0] || ""));
    const pool = withEx.length ? withEx : allCards;
    const card = pool[Math.floor(Math.random() * pool.length)];
    const ex = card?.examples?.[0] || `${card?.front || "Hello"} is a great word to learn.`;
    const words = ex.split(/\s+/).filter(Boolean);
    setSentence(words);
    setWordBank(shuffle(words));
    setAnswer([]);
    setChecked(false);
    setIsCorrect(false);
    setTimeLeft(maxTime);
    setUsedExamples(u => [...u, ex]);
  };

  useEffect(() => {
    if (loading || checked || !showTimer) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); handleCheck(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loading, sentence, checked, showTimer]);

  const handleCheck = (timeout = false) => {
    const correct_ = !timeout && answer.join(" ").toLowerCase() === sentence.join(" ").toLowerCase();
    setIsCorrect(correct_);
    setChecked(true);
    if (correct_) {
      const pts = showTimer ? Math.max(10, timeLeft * 2) : 30;
      setScore(s => s + pts);
      setCorrect(c => c + 1);
      toast.success(`+${pts} очков!`);
    }
  };

  const nextRound = () => {
    const newRound = round + 1;
    setRound(newRound);
    if (newRound >= TOTAL_ROUNDS) {
      onResult({ score, correct, total: TOTAL_ROUNDS, xp: score, wordsLearned: [] });
    } else {
      loadSentence(cards, usedExamples);
    }
  };

  const tapWord = (word: string, idx: number, fromBank: boolean) => {
    if (checked) return;
    if (fromBank) {
      setWordBank(wb => { const n = [...wb]; n.splice(idx, 1); return n; });
      setAnswer(a => [...a, word]);
    } else {
      setAnswer(a => { const n = [...a]; n.splice(idx, 1); return n; });
      setWordBank(wb => [...wb, word]);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-border border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Загрузка...</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <GameHeader score={score} round={round} total={TOTAL_ROUNDS}
        timeLeft={showTimer ? timeLeft : undefined} maxTime={showTimer ? maxTime : undefined}
        onBack={() => onResult({ score, correct, total: TOTAL_ROUNDS, xp: score, wordsLearned: [] })} />
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Составь предложение</p>
        {/* Answer area */}
        <div className={cn(
          "min-h-[56px] border-2 border-dashed rounded-xl p-3 flex flex-wrap gap-2 transition-colors",
          checked
            ? isCorrect ? "border-emerald-500 bg-emerald-500/10" : "border-red-500 bg-red-500/10"
            : "border-border/50"
        )}>
          {answer.length === 0 && !checked && (
            <span className="text-muted-foreground text-sm">Нажми слова ниже...</span>
          )}
          {answer.map((word, i) => (
            <motion.button key={`${word}-${i}`}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={() => tapWord(word, i, false)}
              disabled={checked}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition-colors">
              {word}
            </motion.button>
          ))}
        </div>
        {checked && (
          <p className={cn("text-sm font-medium", isCorrect ? "text-emerald-500" : "text-red-500")}>
            {isCorrect ? "Правильно!" : `Правильный порядок: "${sentence.join(" ")}"`}
          </p>
        )}
      </div>
      {/* Word bank */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Слова</p>
        <div className="flex flex-wrap gap-2">
          {wordBank.map((word, i) => (
            <motion.button key={`${word}-${i}`}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={() => tapWord(word, i, true)}
              disabled={checked}
              className="px-3 py-1.5 rounded-lg border border-border bg-accent hover:bg-accent/80 text-sm font-medium transition-colors">
              {word}
            </motion.button>
          ))}
          {wordBank.length === 0 && !checked && (
            <span className="text-muted-foreground text-sm">Все слова использованы</span>
          )}
        </div>
      </div>
      {!checked ? (
        <Button className="w-full btn-gradient h-11 gap-2" onClick={() => handleCheck(false)}
          disabled={answer.length === 0}>
          <Check size={16} />Проверить
        </Button>
      ) : (
        <Button className="w-full btn-gradient h-11 gap-2" onClick={nextRound}>
          {round + 1 >= TOTAL_ROUNDS ? "Завершить" : "Следующее"} <ChevronRight size={15} />
        </Button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GamesPage() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [result, setResult] = useState<GameResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);

  const handleResult = async (r: GameResult) => {
    setResult(r);
    setGameState("result");
    try {
      if (sessionId) {
        await gamesApi.updateSession(sessionId, {
          score: r.score, totalRounds: r.total, correctAnswers: r.correct,
          durationSeconds: 0, xpEarned: r.xp, wordsLearned: r.wordsLearned,
        });
      }
    } catch {}
  };

  const startGame = async (type: GameType) => {
    setLaunchLoading(true);
    try {
      const session = await gamesApi.createSession({ gameType: type });
      setSessionId(session.id);
    } catch {}
    setActiveGame(type);
    setGameState("playing");
    setResult(null);
    setLaunchLoading(false);
  };

  const goMenu = () => {
    setGameState("menu");
    setActiveGame(null);
    setSelectedGame(null);
    setResult(null);
  };

  // RESULT SCREEN
  if (gameState === "result" && result && activeGame) {
    const gameDef = GAME_DEFS.find(g => g.id === activeGame);
    return (
      <div className="max-w-xl mx-auto page-enter">
        <ResultScreen
          result={result}
          gameName={gameDef?.title || "Игра"}
          onMenu={goMenu}
          onPlayAgain={() => startGame(activeGame)}
          loading={launchLoading}
        />
      </div>
    );
  }

  // PLAYING SCREEN
  if (gameState === "playing" && activeGame) {
    return (
      <div className="max-w-xl mx-auto page-enter">
        {activeGame === "association" && (
          <AssociationGame difficulty={difficulty} onResult={handleResult} />
        )}
        {activeGame === "scramble" && (
          <ScrambleGame difficulty={difficulty} onResult={handleResult} />
        )}
        {activeGame === "fillblank" && (
          <FillBlankGame difficulty={difficulty} onResult={handleResult} />
        )}
        {activeGame === "speed" && (
          <SpeedGame difficulty={difficulty} onResult={handleResult} />
        )}
        {activeGame === "match" && (
          <MatchGame difficulty={difficulty} onResult={handleResult} />
        )}
        {activeGame === "sentence" && (
          <SentenceGame difficulty={difficulty} onResult={handleResult} />
        )}
      </div>
    );
  }

  // GAME DETAIL / PRE-LAUNCH
  if (selectedGame) {
    const def = GAME_DEFS.find(g => g.id === selectedGame)!;
    return (
      <div className="max-w-lg mx-auto space-y-5 page-enter">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedGame(null)}
            className="p-1.5 rounded-xl bg-accent hover:bg-accent/80 text-muted-foreground transition-colors">
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-xl font-bold">{def.title}</h2>
        </div>
        <div className={cn("rounded-2xl p-6 bg-gradient-to-br text-white flex items-center gap-4", def.gradient)}>
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", def.iconBg)}>
            {def.icon}
          </div>
          <div>
            <p className="font-bold text-lg">{def.title}</p>
            <p className="text-white/80 text-sm mt-0.5">{def.desc}</p>
          </div>
        </div>
        <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Star size={16} className="text-yellow-500" />, label: `${TOTAL_ROUNDS} раундов` },
            { icon: <Target size={16} className="text-blue-500" />, label: "XP за победу" },
            { icon: <TrendingUp size={16} className="text-violet-500" />, label: "Прогресс" },
          ].map((item, i) => (
            <div key={i} className="glass-card rounded-xl p-3 flex flex-col items-center gap-1.5 text-center">
              {item.icon}
              <span className="text-[11px] text-muted-foreground leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
        <Button className="w-full btn-gradient h-12 text-base gap-2 font-semibold"
          onClick={() => startGame(selectedGame)} disabled={launchLoading}>
          {launchLoading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Загрузка...</>
            : <><Gamepad2 size={18} />Начать игру</>
          }
        </Button>
      </div>
    );
  }

  // MAIN MENU
  return (
    <div className="max-w-xl mx-auto space-y-5 page-enter">
      <div className="text-center pt-2 pb-1">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Gamepad2 size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold">Игры</h1>
        <p className="text-sm text-muted-foreground mt-1">Учи английский играючи</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {GAME_DEFS.map((game, i) => (
          <motion.button
            key={game.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedGame(game.id)}
            className="w-full text-left group"
          >
            <div className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all border border-border/50 hover:border-border">
              <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 text-white", game.gradient)}>
                {game.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{game.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground font-medium">{game.tag}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{game.desc}</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
