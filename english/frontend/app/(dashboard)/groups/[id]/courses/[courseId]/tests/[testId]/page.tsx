"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Loader2,
  ChevronRight, ChevronLeft, Send, Trophy, AlertCircle,
  RotateCcw, ArrowRight, Zap, Target, Award, Check, MoveVertical,
} from "lucide-react";
import { socialApi } from "@/api/client";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

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

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─── Question components ──────────────────────────────────────────────────────

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

function TextInput({ question, answer, onChange, submitted }: {
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

  const handleLeft = (left: string) => {
    if (submitted) return;
    setSelected(left);
  };

  const handleRight = (right: string) => {
    if (submitted || !selected) return;
    onChange({ ...answer, [selected]: right });
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Понятия</p>
          {lefts.map((left, i) => {
            const isMatched = !!answer[left];
            const isSelected = selected === left;
            const isCorrect = submitted && answer[left] === correctMap[left];
            const isWrong = submitted && isMatched && answer[left] !== correctMap[left];
            return (
              <button
                key={i}
                onClick={() => handleLeft(left)}
                disabled={submitted}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm border transition-all",
                  !submitted && isSelected && "bg-indigo-500/20 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10",
                  !submitted && !isSelected && isMatched && "bg-white/8 border-white/15 text-white/80",
                  !submitted && !isSelected && !isMatched && "border-white/8 text-white/60 hover:bg-white/5",
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
                {isMatched && (
                  <p className="text-xs text-white/40 mt-1 pl-0">{answer[left]}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Значения</p>
          {shuffled.map((right, i) => {
            const isUsed = Object.values(answer).includes(right);
            const isHighlighted = !submitted && selected !== null;
            return (
              <button
                key={i}
                onClick={() => handleRight(right)}
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

  // Initialize with shuffled items if answer not yet set
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
          <motion.div
            key={item}
            layout
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
            {submitted && (
              <span className="text-[10px] text-white/30">#{correctIdx + 1}</span>
            )}
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
  if (question.type === "fill_blank" || question.type === "text_input") return <TextInput question={question} answer={answer || ""} onChange={onChange} submitted={submitted} />;
  if (question.type === "match") return <MatchPairs question={question} answer={answer || {}} onChange={onChange} submitted={submitted} />;
  if (question.type === "order") return <OrderItems question={question} answer={answer || []} onChange={onChange} submitted={submitted} />;
  return <TextInput question={question} answer={typeof answer === "string" ? answer : ""} onChange={onChange} submitted={submitted} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const courseId = params.courseId as string;
  const testId = params.testId as string;

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
    socialApi.getTest(groupId, courseId, testId)
      .then(data => {
        setTest(data);
        if (data.timeLimitSeconds) setTimeLeft(data.timeLimitSeconds);
        setMode(data.questions?.length <= 5 ? "all" : "one");
      })
      .catch(() => toast.error("Ошибка загрузки теста"))
      .finally(() => setLoading(false));
  }, [groupId, courseId, testId]);

  useEffect(() => {
    if (timeLeft === null || attempt) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => Math.max(0, (t ?? 0) - 1)), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, attempt]);

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
      } else {
        toast(`Результат: ${att.score}%`, { icon: "📊" });
      }
    } catch { toast.error("Ошибка отправки"); }
    finally { setSubmitting(false); }
  }, [test, submitting, answers, groupId, courseId, testId, startTime]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-60">
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
  );

  if (!test) return <div className="text-center text-white/50 py-20">Тест не найден</div>;

  const questions = test.questions || [];
  const answered = Object.keys(answers).length;

  // ─── Results view ─────────────────────────────────────────────────────────

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
      <div className="w-full max-w-none">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          К курсу
        </button>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 rounded-3xl p-8 text-center" style={{ background: attempt.passed ? "linear-gradient(135deg, rgba(52,211,153,0.12),rgba(99,102,241,0.12))" : "linear-gradient(135deg, rgba(248,113,113,0.12),rgba(99,102,241,0.08))", border: `1px solid ${attempt.passed ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}` }}>
          <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5", attempt.passed ? "bg-emerald-500/20" : "bg-red-500/20")}>
            {attempt.passed
              ? <Trophy className="w-10 h-10 text-emerald-400" />
              : <AlertCircle className="w-10 h-10 text-red-400" />}
          </div>
          <div className="text-6xl font-black mb-1" style={{ color: grade.color }}>{attempt.score}%</div>
          <div className="text-2xl font-bold text-white mb-2">{attempt.passed ? "Тест пройден!" : "Попробуйте снова"}</div>
          <p className="text-white/50 text-sm mb-1">Оценка: <span className="font-bold" style={{ color: grade.color }}>{grade.label}</span></p>
          <p className="text-white/40 text-sm mb-2">{correct} из {questions.length} правильно</p>
          <div className="flex items-center justify-center gap-1.5 text-white/35 text-sm">
            <Clock className="w-4 h-4" />
            {formatTime(attempt.timeTakenSeconds)}
          </div>

          <div className="flex gap-3 justify-center mt-6">
            {!attempt.passed && (
              <button
                onClick={() => { setAttempt(null); setAnswers({}); setCurrentQ(0); if (test.timeLimitSeconds) setTimeLeft(test.timeLimitSeconds); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 text-white/70 text-sm hover:bg-white/12 transition-colors border border-white/10"
              >
                <RotateCcw className="w-4 h-4" />
                Ещё раз
              </button>
            )}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              К курсу
            </button>
          </div>
        </motion.div>

        {/* Answer breakdown */}
        <h3 className="text-white/50 text-sm font-semibold mb-3">Разбор ответов</h3>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const ga = gradedAnswers.find((a: any) => a.questionId === q.id);
            return (
              <div key={q.id} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-start gap-3">
                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", ga?.correct ? "bg-emerald-500/15" : "bg-red-500/15")}>
                    {ga?.correct
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-white/80 text-sm font-medium mb-1">{i+1}. {q.question}</p>
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

  // ─── Test taking view ─────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-none">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад
      </button>

      {/* Test header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 mb-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white">{test.title}</h1>
            {test.description && <p className="text-white/45 text-sm mt-0.5">{test.description}</p>}
          </div>
          {timeLeft !== null && (
            <div className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono font-bold flex-shrink-0", timeLeft < 30 ? "bg-red-500/15 text-red-400 border border-red-500/25" : timeLeft < 60 ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "bg-white/8 text-white border border-white/10")}>
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

        {/* Progress bar */}
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: mode === "all" ? `${(answered / questions.length) * 100}%` : `${((currentQ + 1) / questions.length) * 100}%` }}
            className="h-full bg-indigo-500 rounded-full transition-all"
          />
        </div>

        {/* View mode toggle */}
        {questions.length > 1 && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setMode("one")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", mode === "one" ? "bg-indigo-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/8")}
            >По одному</button>
            <button
              onClick={() => setMode("all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", mode === "all" ? "bg-indigo-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/8")}
            >Все сразу</button>
          </div>
        )}
      </motion.div>

      {/* Questions */}
      {mode === "all" ? (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
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
          <motion.div key={currentQ} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
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
      <div className="flex items-center gap-3 mt-6">
        {mode === "one" && (
          <button
            onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
            disabled={currentQ === 0}
            className="p-2.5 rounded-xl bg-white/5 text-white/50 disabled:opacity-25 hover:bg-white/10 transition-colors border border-white/8"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {mode === "one" && currentQ < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}
            className="flex-1 py-3 rounded-xl bg-white/8 hover:bg-white/12 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-white/8"
          >
            Следующий
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || answered === 0}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Отправить ответы
          </button>
        )}
      </div>

      <p className="text-center text-white/25 text-xs mt-3">
        Отвечено: {answered} из {questions.length}
      </p>
    </div>
  );
}
