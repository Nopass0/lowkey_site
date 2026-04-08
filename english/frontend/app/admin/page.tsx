"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Activity, BookOpen, Bot, CreditCard, FileText, KeyRound,
  Library, Save, Send, Shield, TestTube2, TrendingUp, Users,
  Plus, Pencil, Trash2, ExternalLink, Globe, Clock, Target,
  RefreshCw, CheckSquare, GitMerge, X, Check, ChevronDown,
  HelpCircle, AlignLeft, Layers, GripVertical, Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminApi, socialApi } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

type TabId = "overview" | "users" | "plans" | "templates" | "decks" | "courses" | "tests" | "ai" | "hf" | "broadcast";

const HF_PRESETS = {
  tts: [
    { label: "Default small", model: "facebook/mms-tts-eng", note: "Быстрая маленькая английская TTS-модель." },
    { label: "Natural", model: "hexgrad/Kokoro-82M", note: "Более естественная английская речь." },
  ],
  speech: [
    { label: "English small", model: "openai/whisper-small.en", note: "Лучший выбор для произношения на английском." },
    { label: "Multilingual", model: "openai/whisper-small", note: "Подходит для смешанных акцентов." },
  ],
};

const LEVELS: Record<string, string> = {
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

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: "Один ответ",
  multiple_choice: "Несколько ответов",
  match: "Сопоставление",
  fill_blank: "Заполнить пропуск",
  order: "Расставить порядок",
};

// ─── Test Settings Editor ─────────────────────────────────────────────────────
function TestSettingsEditor({ test, groupId, courseId, onSaved }: {
  test: any; groupId: string; courseId: string; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: test.title || "",
    timeLimitMinutes: test.timeLimitSeconds ? String(Math.ceil(test.timeLimitSeconds / 60)) : "",
    passingScore: String(test.passingScore || 70),
    maxAttempts: String(test.maxAttempts || ""),
    pointsPerQuestion: String(test.pointsPerQuestion || 1),
    allowRetry: test.allowRetry !== false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim() || test.title,
        passingScore: Number(form.passingScore) || 70,
        pointsPerQuestion: Number(form.pointsPerQuestion) || 1,
        allowRetry: form.allowRetry,
      };
      if (form.timeLimitMinutes.trim()) {
        payload.timeLimitSeconds = Number(form.timeLimitMinutes) * 60;
      } else {
        payload.timeLimitSeconds = null;
      }
      if (form.maxAttempts.trim()) {
        payload.maxAttempts = Number(form.maxAttempts);
      } else {
        payload.maxAttempts = null;
      }
      await socialApi.updateTest(groupId, courseId, test.id, payload);
      toast.success("Тест обновлён");
      onSaved();
    } catch {
      toast.error("Ошибка сохранения теста");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Название теста</label>
        <Input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="h-8 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={11} /> Ограничение по времени (мин)
          </label>
          <Input
            type="number"
            min="0"
            value={form.timeLimitMinutes}
            onChange={e => setForm(f => ({ ...f, timeLimitMinutes: e.target.value }))}
            placeholder="Без ограничений"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Target size={11} /> Проходной балл (%)
          </label>
          <Input
            type="number"
            min="0"
            max="100"
            value={form.passingScore}
            onChange={e => setForm(f => ({ ...f, passingScore: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw size={11} /> Макс. попыток
          </label>
          <Input
            type="number"
            min="1"
            value={form.maxAttempts}
            onChange={e => setForm(f => ({ ...f, maxAttempts: e.target.value }))}
            placeholder="Не ограничено"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckSquare size={11} /> Баллов за вопрос
          </label>
          <Input
            type="number"
            min="1"
            value={form.pointsPerQuestion}
            onChange={e => setForm(f => ({ ...f, pointsPerQuestion: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          onClick={() => setForm(f => ({ ...f, allowRetry: !f.allowRetry }))}
          className={cn(
            "w-9 h-5 rounded-full transition-colors relative flex-shrink-0",
            form.allowRetry ? "bg-primary" : "bg-muted"
          )}
        >
          <span className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
            form.allowRetry ? "translate-x-4" : "translate-x-0.5"
          )} />
        </div>
        <span className="text-sm">Разрешить исправлять ответы в ходе попытки</span>
      </label>

      {/* Questions summary */}
      {test.questions?.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-accent/20 p-3">
          <div className="text-xs text-muted-foreground mb-2 font-medium">
            {test.questions.length} вопрос(ов)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(
              test.questions.reduce((acc: Record<string, number>, q: any) => {
                const t = q.type || "single_choice";
                acc[t] = (acc[t] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => (
              <span key={type} className="text-[10px] px-2 py-0.5 rounded-full bg-accent border border-border/30 text-muted-foreground">
                {QUESTION_TYPE_LABELS[type] || type}: {count as number}
              </span>
            ))}
          </div>
        </div>
      )}

      <Button size="sm" onClick={handleSave} disabled={saving} className="w-full gap-2">
        <Save size={13} />
        {saving ? "Сохранение..." : "Сохранить настройки"}
      </Button>
    </div>
  );
}

// ─── Course Row ───────────────────────────────────────────────────────────────
function CourseRow({ course, onDelete }: { course: any; onDelete: () => void }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const levelColor = LEVEL_COLORS[course.level] || LEVEL_COLORS.beginner;
  const levelLabel = LEVELS[course.level] || "A1";

  async function handleDelete() {
    if (!confirm(`Удалить курс «${course.title}»?`)) return;
    setDeleting(true);
    try {
      await socialApi.deleteCourse(course.groupId, course.id);
      toast.success("Курс удалён");
      onDelete();
    } catch {
      toast.error("Ошибка при удалении");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-accent/10 p-3 group">
      {course.imageUrl && (
        <img src={course.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
      )}
      {!course.imageUrl && (
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Library size={18} className="text-blue-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{course.title}</span>
          {course.level && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md border", levelColor)}>
              {levelLabel}
            </span>
          )}
          {course.isPublic && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-400/20">
              публичный
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {course.groupName && <span>Группа: {course.groupName} · </span>}
          {course.blocksCount !== undefined && <span>{course.blocksCount} блоков · </span>}
          {course.testsCount !== undefined && <span>{course.testsCount} тестов · </span>}
          {course.createdAt && formatDate(course.createdAt)}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => router.push(`/groups/${course.groupId}/courses/${course.id}/edit`)}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Редактировать"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => router.push(`/groups/${course.groupId}/courses/${course.id}`)}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Просмотр"
        >
          <ExternalLink size={14} />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
          title="Удалить"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Test Row ─────────────────────────────────────────────────────────────────
function TestRow({ test, onSaved, onDelete }: { test: any; onSaved: () => void; onDelete: () => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Удалить тест «${test.title}»?`)) return;
    setDeleting(true);
    try {
      await socialApi.deleteTest(test.groupId, test.courseId, test.id);
      toast.success("Тест удалён");
      onDelete();
    } catch {
      toast.error("Ошибка при удалении");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/30 bg-accent/10 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <TestTube2 size={16} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{test.title || "Без названия"}</span>
            {test.timeLimitSeconds && (
              <span className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-400/20">
                <Clock size={9} />{Math.ceil(test.timeLimitSeconds / 60)} мин
              </span>
            )}
            {test.passingScore && (
              <span className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-400/20">
                <Target size={9} />{test.passingScore}%
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {test.courseTitle && <span>Курс: {test.courseTitle} · </span>}
            {test.questions?.length || 0} вопросов
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => router.push(`/groups/${test.groupId}/courses/${test.courseId}/edit`)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Редактировать вопросы в редакторе курса"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              expanded ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
            title="Настройки теста"
          >
            <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
            title="Удалить"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/20 pt-3">
          <TestSettingsEditor
            test={test}
            groupId={test.groupId}
            courseId={test.courseId}
            onSaved={onSaved}
          />
        </div>
      )}
    </div>
  );
}

// ─── Create Course Modal ──────────────────────────────────────────────────────
function CreateCourseModal({ groups, onCreated, onClose }: {
  groups: any[]; onCreated: () => void; onClose: () => void;
}) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("beginner");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim() || !groupId) return;
    setSaving(true);
    try {
      const course = await socialApi.createCourse(groupId, {
        title: title.trim(),
        level,
        isPublic,
      });
      toast.success("Курс создан");
      onCreated();
      router.push(`/groups/${groupId}/courses/${course.id}/edit`);
    } catch {
      toast.error("Ошибка при создании курса");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Новый курс</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Название курса</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Grammar basics"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Группа</label>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Уровень</label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {Object.entries(LEVELS).map(([val, label]) => (
                <option key={val} value={val}>{label} — {val}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Публичный (виден всем)</span>
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
          <Button onClick={handleCreate} disabled={saving || !title.trim()} className="flex-1 gap-2">
            <Plus size={14} />
            {saving ? "Создание..." : "Создать и открыть редактор"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const EMOJI_LIST = ["📚", "🎯", "🌍", "🗣️", "✏️", "🔤", "📖", "💬", "🎓", "🧠", "🌟", "🏆", "🎮", "🔑", "📝", "🌈", "🚀", "💡", "🎵", "🐣"];

const QUESTION_TYPES = ["single_choice", "multiple_choice", "fill_blank", "text_input", "match", "order"] as const;
const QUESTION_TYPE_ICONS: Record<string, string> = {
  single_choice: "●",
  multiple_choice: "☑",
  fill_blank: "___",
  text_input: "T",
  match: "↔",
  order: "↕",
};

// ─── Create Deck Modal ────────────────────────────────────────────────────────
function CreateDeckModal({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await adminApi.createTemplateDeck({ name: name.trim(), emoji, description: description.trim(), isPublic });
      toast.success("Колода создана");
      onCreated();
    } catch {
      toast.error("Ошибка при создании колоды");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Новая колода</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Название колоды</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Например: Basic Vocabulary" autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Эмодзи</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_LIST.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all border",
                    emoji === e ? "bg-primary/15 border-primary/40 scale-110" : "border-border/30 hover:border-border hover:bg-accent"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Описание</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание колоды" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded" />
            <span className="text-sm">Публичная (видна всем)</span>
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()} className="flex-1 gap-2">
            <Plus size={14} />
            {saving ? "Создание..." : "Создать колоду"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Deck Admin Row ───────────────────────────────────────────────────────────
function DeckAdminRow({ deck, isEditing, onToggleEdit, onPublicToggle, onDelete }: {
  deck: any; isEditing: boolean;
  onToggleEdit: () => void;
  onPublicToggle: () => void;
  onDelete: () => void;
}) {
  const [cards, setCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [deckName, setDeckName] = useState(deck.name || "");
  const [deckDesc, setDeckDesc] = useState(deck.description || "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [newCard, setNewCard] = useState({ front: "", back: "", example: "" });
  const [addingCard, setAddingCard] = useState(false);

  useEffect(() => {
    if (isEditing && cards.length === 0) {
      setLoadingCards(true);
      adminApi.getDeckCards(deck.id)
        .then(data => setCards(data || []))
        .catch(() => toast.error("Не удалось загрузить карточки"))
        .finally(() => setLoadingCards(false));
    }
  }, [isEditing]);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      await adminApi.updateTemplateDeck(deck.id, { name: deckName.trim(), description: deckDesc.trim() });
      toast.success("Колода обновлена");
    } catch { toast.error("Ошибка сохранения"); }
    finally { setSavingMeta(false); }
  }

  async function handleAddCard() {
    if (!newCard.front.trim() || !newCard.back.trim()) return;
    setAddingCard(true);
    try {
      const card = await adminApi.addDeckCard(deck.id, { front: newCard.front.trim(), back: newCard.back.trim(), example: newCard.example.trim() || undefined });
      setCards(cur => [...cur, card]);
      setNewCard({ front: "", back: "", example: "" });
    } catch { toast.error("Ошибка добавления карточки"); }
    finally { setAddingCard(false); }
  }

  async function handleUpdateCard(cardId: string, field: string, value: string) {
    try {
      const updated = await adminApi.updateDeckCard(deck.id, cardId, { [field]: value });
      setCards(cur => cur.map(c => c.id === cardId ? { ...c, ...updated } : c));
    } catch { toast.error("Ошибка обновления карточки"); }
  }

  async function handleDeleteCard(cardId: string) {
    if (!confirm("Удалить карточку?")) return;
    try {
      await adminApi.deleteDeckCard(deck.id, cardId);
      setCards(cur => cur.filter(c => c.id !== cardId));
    } catch { toast.error("Ошибка удаления карточки"); }
  }

  return (
    <div className="rounded-xl border border-border/30 bg-accent/10 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-xl flex-shrink-0">
          {deck.emoji || "📚"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{deck.name}</span>
            <Badge variant={deck.isPublic ? "default" : "secondary"} className="text-[10px]">
              {deck.isPublic ? "Публичная" : "Скрытая"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{deck.cardCount || 0} карточек</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onPublicToggle}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={deck.isPublic ? "Скрыть" : "Опубликовать"}
          >
            <Globe size={14} />
          </button>
          <button
            onClick={onToggleEdit}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isEditing ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
            title="Редактировать"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            title="Удалить"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="px-3 pb-3 border-t border-border/20 pt-3 space-y-4">
          {/* Meta editor */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Название</label>
              <Input
                value={deckName}
                onChange={e => setDeckName(e.target.value)}
                onBlur={saveMeta}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Описание</label>
              <Input
                value={deckDesc}
                onChange={e => setDeckDesc(e.target.value)}
                onBlur={saveMeta}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Cards list */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Карточки ({cards.length})</div>
            {loadingCards ? (
              <div className="space-y-1">
                {[1, 2].map(i => <div key={i} className="h-10 rounded-lg bg-accent/20 animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-1.5">
                {cards.map(card => (
                  <div key={card.id} className="flex items-center gap-2 rounded-lg border border-border/20 bg-background/50 px-2 py-1.5">
                    <Input
                      defaultValue={card.front}
                      onBlur={e => { if (e.target.value !== card.front) handleUpdateCard(card.id, "front", e.target.value); }}
                      placeholder="Слово"
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      defaultValue={card.back}
                      onBlur={e => { if (e.target.value !== card.back) handleUpdateCard(card.id, "back", e.target.value); }}
                      placeholder="Перевод"
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      defaultValue={card.example || ""}
                      onBlur={e => { if (e.target.value !== (card.example || "")) handleUpdateCard(card.id, "example", e.target.value); }}
                      placeholder="Пример"
                      className="h-7 text-xs flex-1"
                    />
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add card row */}
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/30 bg-accent/5 px-2 py-1.5">
              <Input
                value={newCard.front}
                onChange={e => setNewCard(c => ({ ...c, front: e.target.value }))}
                placeholder="Слово"
                className="h-7 text-xs flex-1"
              />
              <Input
                value={newCard.back}
                onChange={e => setNewCard(c => ({ ...c, back: e.target.value }))}
                placeholder="Перевод"
                className="h-7 text-xs flex-1"
              />
              <Input
                value={newCard.example}
                onChange={e => setNewCard(c => ({ ...c, example: e.target.value }))}
                placeholder="Пример (опц.)"
                className="h-7 text-xs flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddCard}
                disabled={addingCard || !newCard.front.trim() || !newCard.back.trim()}
                className="h-7 px-2 flex-shrink-0"
              >
                <Plus size={12} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Standalone Test Modal ─────────────────────────────────────────────
function CreateStandaloneTestModal({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [settings, setSettings] = useState({
    timeLimitMinutes: "",
    passingScore: "70",
    maxAttempts: "",
    pointsPerQuestion: "1",
    allowRetry: true,
  });
  const [questions, setQuestions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  function addQuestion(type: string) {
    const base: any = { id: crypto.randomUUID(), type, text: "", points: 1 };
    if (type === "single_choice" || type === "multiple_choice") {
      base.options = [{ id: crypto.randomUUID(), text: "", isCorrect: false }, { id: crypto.randomUUID(), text: "", isCorrect: false }];
    } else if (type === "match") {
      base.pairs = [{ id: crypto.randomUUID(), left: "", right: "" }];
    } else if (type === "order") {
      base.items = [{ id: crypto.randomUUID(), text: "" }];
    } else if (type === "fill_blank") {
      base.text = "Заполните: ___";
      base.correctAnswer = "";
    } else if (type === "text_input") {
      base.correctAnswer = "";
    }
    setQuestions(q => [...q, base]);
  }

  function updateQuestion(idx: number, patch: any) {
    setQuestions(q => q.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  function deleteQuestion(idx: number) {
    setQuestions(q => q.filter((_, i) => i !== idx));
  }

  function updateOption(qIdx: number, oIdx: number, patch: any) {
    setQuestions(q => q.map((item, i) => {
      if (i !== qIdx) return item;
      const options = [...(item.options || [])];
      options[oIdx] = { ...options[oIdx], ...patch };
      return { ...item, options };
    }));
  }

  function addOption(qIdx: number) {
    setQuestions(q => q.map((item, i) => i === qIdx
      ? { ...item, options: [...(item.options || []), { id: crypto.randomUUID(), text: "", isCorrect: false }] }
      : item
    ));
  }

  function updatePair(qIdx: number, pIdx: number, patch: any) {
    setQuestions(q => q.map((item, i) => {
      if (i !== qIdx) return item;
      const pairs = [...(item.pairs || [])];
      pairs[pIdx] = { ...pairs[pIdx], ...patch };
      return { ...item, pairs };
    }));
  }

  function updateOrderItem(qIdx: number, iIdx: number, text: string) {
    setQuestions(q => q.map((item, i) => {
      if (i !== qIdx) return item;
      const items = [...(item.items || [])];
      items[iIdx] = { ...items[iIdx], text };
      return { ...item, items };
    }));
  }

  async function handleSave() {
    if (!title.trim()) { toast.error("Введите название теста"); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        passingScore: Number(settings.passingScore) || 70,
        pointsPerQuestion: Number(settings.pointsPerQuestion) || 1,
        allowRetry: settings.allowRetry,
        questions,
      };
      if (settings.timeLimitMinutes.trim()) payload.timeLimitSeconds = Number(settings.timeLimitMinutes) * 60;
      if (settings.maxAttempts.trim()) payload.maxAttempts = Number(settings.maxAttempts);
      await adminApi.createAdminTest(payload);
      toast.success("Тест создан");
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Ошибка создания теста");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <TestTube2 size={18} className="text-amber-400" />
            <h3 className="font-semibold text-lg">Создать тест</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Название теста</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Unit 1 Test" autoFocus />
          </div>

          {/* Settings */}
          <div className="rounded-xl border border-border/30 bg-accent/10 p-4 space-y-3">
            <div className="text-xs font-medium text-muted-foreground">Настройки теста</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} /> Лимит (мин)</label>
                <Input
                  type="number" min="0"
                  value={settings.timeLimitMinutes}
                  onChange={e => setSettings(s => ({ ...s, timeLimitMinutes: e.target.value }))}
                  placeholder="Без ограничений"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><Target size={11} /> Проходной балл (%)</label>
                <Input
                  type="number" min="0" max="100"
                  value={settings.passingScore}
                  onChange={e => setSettings(s => ({ ...s, passingScore: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw size={11} /> Макс. попыток</label>
                <Input
                  type="number" min="1"
                  value={settings.maxAttempts}
                  onChange={e => setSettings(s => ({ ...s, maxAttempts: e.target.value }))}
                  placeholder="Не ограничено"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><CheckSquare size={11} /> Баллов за вопрос</label>
                <Input
                  type="number" min="1"
                  value={settings.pointsPerQuestion}
                  onChange={e => setSettings(s => ({ ...s, pointsPerQuestion: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setSettings(s => ({ ...s, allowRetry: !s.allowRetry }))}
                className={cn("w-9 h-5 rounded-full transition-colors relative flex-shrink-0", settings.allowRetry ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", settings.allowRetry ? "translate-x-4" : "translate-x-0.5")} />
              </div>
              <span className="text-sm">Разрешить исправлять ответы</span>
            </label>
          </div>

          {/* Question type buttons */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Добавить вопрос</div>
            <div className="flex flex-wrap gap-1.5">
              {QUESTION_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => addQuestion(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border border-border/40 bg-accent/20 hover:bg-accent hover:border-border transition-all"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{QUESTION_TYPE_ICONS[type]}</span>
                  <span>{QUESTION_TYPE_LABELS[type] || type}</span>
                  <Plus size={11} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          {/* Questions list */}
          {questions.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">{questions.length} вопрос(ов)</div>
              {questions.map((q, qIdx) => (
                <div key={q.id} className="rounded-xl border border-border/30 bg-accent/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent border border-border/30 text-muted-foreground font-medium">
                      {QUESTION_TYPE_LABELS[q.type] || q.type}
                    </span>
                    <Input
                      value={q.text}
                      onChange={e => updateQuestion(qIdx, { text: e.target.value })}
                      placeholder="Текст вопроса"
                      className="h-7 text-sm flex-1"
                    />
                    <button
                      onClick={() => deleteQuestion(qIdx)}
                      className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* single_choice / multiple_choice */}
                  {(q.type === "single_choice" || q.type === "multiple_choice") && (
                    <div className="space-y-1.5 pl-2">
                      {(q.options || []).map((opt: any, oIdx: number) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type={q.type === "single_choice" ? "radio" : "checkbox"}
                            checked={opt.isCorrect}
                            onChange={e => updateOption(qIdx, oIdx, { isCorrect: e.target.checked })}
                            className="flex-shrink-0"
                          />
                          <Input
                            value={opt.text}
                            onChange={e => updateOption(qIdx, oIdx, { text: e.target.value })}
                            placeholder={`Вариант ${oIdx + 1}`}
                            className="h-6 text-xs flex-1"
                          />
                          <button
                            onClick={() => {
                              const opts = (q.options || []).filter((_: any, i: number) => i !== oIdx);
                              updateQuestion(qIdx, { options: opts });
                            }}
                            className="p-0.5 rounded hover:text-red-400 text-muted-foreground transition-colors flex-shrink-0"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addOption(qIdx)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pl-5"
                      >
                        <Plus size={11} /> Добавить вариант
                      </button>
                    </div>
                  )}

                  {/* fill_blank / text_input */}
                  {(q.type === "fill_blank" || q.type === "text_input") && (
                    <div className="pl-2">
                      <Input
                        value={q.correctAnswer || ""}
                        onChange={e => updateQuestion(qIdx, { correctAnswer: e.target.value })}
                        placeholder="Правильный ответ"
                        className="h-7 text-xs"
                      />
                    </div>
                  )}

                  {/* match */}
                  {q.type === "match" && (
                    <div className="space-y-1.5 pl-2">
                      {(q.pairs || []).map((pair: any, pIdx: number) => (
                        <div key={pair.id} className="flex items-center gap-2">
                          <Input
                            value={pair.left}
                            onChange={e => updatePair(qIdx, pIdx, { left: e.target.value })}
                            placeholder="Левая часть"
                            className="h-6 text-xs flex-1"
                          />
                          <GitMerge size={12} className="text-muted-foreground flex-shrink-0" />
                          <Input
                            value={pair.right}
                            onChange={e => updatePair(qIdx, pIdx, { right: e.target.value })}
                            placeholder="Правая часть"
                            className="h-6 text-xs flex-1"
                          />
                          <button
                            onClick={() => {
                              const pairs = (q.pairs || []).filter((_: any, i: number) => i !== pIdx);
                              updateQuestion(qIdx, { pairs });
                            }}
                            className="p-0.5 rounded hover:text-red-400 text-muted-foreground transition-colors flex-shrink-0"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => updateQuestion(qIdx, { pairs: [...(q.pairs || []), { id: crypto.randomUUID(), left: "", right: "" }] })}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Plus size={11} /> Добавить пару
                      </button>
                    </div>
                  )}

                  {/* order */}
                  {q.type === "order" && (
                    <div className="space-y-1.5 pl-2">
                      {(q.items || []).map((item: any, iIdx: number) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <GripVertical size={12} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-[10px] text-muted-foreground w-4">{iIdx + 1}.</span>
                          <Input
                            value={item.text}
                            onChange={e => updateOrderItem(qIdx, iIdx, e.target.value)}
                            placeholder={`Элемент ${iIdx + 1}`}
                            className="h-6 text-xs flex-1"
                          />
                          <button
                            onClick={() => {
                              const items = (q.items || []).filter((_: any, i: number) => i !== iIdx);
                              updateQuestion(qIdx, { items });
                            }}
                            className="p-0.5 rounded hover:text-red-400 text-muted-foreground transition-colors flex-shrink-0"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => updateQuestion(qIdx, { items: [...(q.items || []), { id: crypto.randomUUID(), text: "" }] })}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Plus size={11} /> Добавить элемент
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-border/20 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()} className="flex-1 gap-2">
            <Save size={14} />
            {saving ? "Сохранение..." : "Создать тест"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [templateDecks, setTemplateDecks] = useState<any[]>([]);
  const [contentOverview, setContentOverview] = useState<any>(null);
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [hfSettings, setHfSettings] = useState<any>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [search, setSearch] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [savingHf, setSavingHf] = useState(false);
  const [aiForm, setAiForm] = useState({ provider: "openrouter", model: "", baseUrl: "", siteName: "", siteUrl: "", temperature: "0.7", maxTokens: "2048", apiKey: "" });
  const [hfForm, setHfForm] = useState({ ttsModel: "", speechModel: "", apiToken: "" });

  // Public courses
  const [publicCourses, setPublicCourses] = useState<any[]>([]);
  const [publicCoursesLoading, setPublicCoursesLoading] = useState(false);
  const [coursesSearch, setCoursesSearch] = useState("");
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [allGroups, setAllGroups] = useState<any[]>([]);

  // Public tests
  const [publicTests, setPublicTests] = useState<any[]>([]);
  const [publicTestsLoading, setPublicTestsLoading] = useState(false);
  const [testsSearch, setTestsSearch] = useState("");
  const [showCreateTest, setShowCreateTest] = useState(false);

  // Decks management
  const [decks, setDecks] = useState<any[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [editingDeck, setEditingDeck] = useState<any>(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    loadData();
  }, [router, user]);

  useEffect(() => {
    if (!aiSettings) return;
    setAiForm({
      provider: aiSettings.provider || "openrouter",
      model: aiSettings.model || "",
      baseUrl: aiSettings.baseUrl || "",
      siteName: aiSettings.siteName || "",
      siteUrl: aiSettings.siteUrl || "",
      temperature: String(aiSettings.temperature ?? 0.7),
      maxTokens: String(aiSettings.maxTokens ?? 2048),
      apiKey: "",
    });
  }, [aiSettings]);

  useEffect(() => {
    if (!hfSettings) return;
    setHfForm({ ttsModel: hfSettings.ttsModel || "", speechModel: hfSettings.speechModel || "", apiToken: "" });
  }, [hfSettings]);

  // Load public courses when tab changes to courses
  useEffect(() => {
    if (tab === "courses") loadPublicCourses();
    if (tab === "tests") loadPublicTests();
    if (tab === "decks") loadAdminDecks();
  }, [tab]);

  async function loadData() {
    try {
      const [s, u, p, td, co, ai, hf] = await Promise.all([
        adminApi.getStats(),
        adminApi.getUsers({ limit: 50 }),
        adminApi.getPlans(),
        adminApi.getTemplateDecks({ publicOnly: false, limit: 100 }),
        adminApi.getContentOverview(),
        adminApi.getAiSettings(),
        adminApi.getHfSettings(),
      ]);
      setStats(s); setUsers(u); setPlans(p); setTemplateDecks(td);
      setContentOverview(co); setAiSettings(ai); setHfSettings(hf);
    } catch {
      setStats(null); setUsers([]); setPlans([]); setTemplateDecks([]);
      setContentOverview(null); setAiSettings(null); setHfSettings(null);
    }
  }

  const loadPublicCourses = useCallback(async () => {
    setPublicCoursesLoading(true);
    try {
      const [data, groups] = await Promise.all([
        socialApi.getPublicCourses({ limit: 100 }),
        socialApi.getGroups(),
      ]);
      setPublicCourses(data.courses || []);
      setAllGroups(groups || []);
    } catch {
      toast.error("Не удалось загрузить курсы");
    } finally {
      setPublicCoursesLoading(false);
    }
  }, []);

  const loadPublicTests = useCallback(async () => {
    setPublicTestsLoading(true);
    try {
      const data = await socialApi.getPublicTests({ limit: 200 });
      setPublicTests(data.tests || []);
    } catch {
      toast.error("Не удалось загрузить тесты");
    } finally {
      setPublicTestsLoading(false);
    }
  }, []);

  const loadAdminDecks = useCallback(async () => {
    setLoadingDecks(true);
    try {
      const data = await adminApi.getTemplateDecks({ publicOnly: false, limit: 200 });
      setDecks(data || []);
    } catch {
      toast.error("Не удалось загрузить колоды");
    } finally {
      setLoadingDecks(false);
    }
  }, []);

  async function handleGivePremium(userId: string, days: number) {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    await adminApi.updateUser(userId, { isPremium: true, premiumUntil: until });
    toast.success(`Выдан PRO на ${days} дней`);
    loadData();
  }

  async function handleToggleTemplateDeck(deck: any) {
    try {
      const updated = await adminApi.updateTemplateDeck(deck.id, { isPublic: !deck.isPublic });
      setTemplateDecks(cur => cur.map(item => item.id === updated.id ? updated : item));
      toast.success(updated.isPublic ? "Колода опубликована" : "Колода скрыта");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Ошибка обновления колоды");
    }
  }

  async function handleSaveAiSettings() {
    setSavingAi(true);
    try {
      const payload: any = {
        provider: aiForm.provider,
        model: aiForm.model.trim(),
        baseUrl: aiForm.baseUrl.trim(),
        siteName: aiForm.siteName.trim(),
        siteUrl: aiForm.siteUrl.trim(),
        temperature: parseFloat(aiForm.temperature) || 0.7,
        maxTokens: parseInt(aiForm.maxTokens, 10) || 2048,
      };
      if (aiForm.apiKey.trim()) payload.apiKey = aiForm.apiKey.trim();
      const saved = await adminApi.updateAiSettings(payload);
      setAiSettings(saved);
      setAiForm(cur => ({ ...cur, apiKey: "" }));
      toast.success("Настройки AI сохранены");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Ошибка сохранения");
    } finally {
      setSavingAi(false);
    }
  }

  async function handleSaveHfSettings() {
    setSavingHf(true);
    try {
      const payload: any = { ttsModel: hfForm.ttsModel.trim(), speechModel: hfForm.speechModel.trim() };
      if (hfForm.apiToken.trim()) payload.apiToken = hfForm.apiToken.trim();
      const saved = await adminApi.updateHfSettings(payload);
      setHfSettings(saved);
      setHfForm(cur => ({ ...cur, apiToken: "" }));
      toast.success("Настройки HF сохранены");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Ошибка сохранения");
    } finally {
      setSavingHf(false);
    }
  }

  async function handleBroadcast() {
    if (!broadcastMsg.trim()) return;
    setSending(true);
    try {
      const { sent } = await adminApi.broadcast({ message: broadcastMsg, premiumOnly });
      toast.success(`Отправлено ${sent} пользователям`);
      setBroadcastMsg("");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Ошибка рассылки");
    } finally {
      setSending(false);
    }
  }

  const filteredUsers = useMemo(() =>
    users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())),
    [search, users]
  );

  const filteredCourses = useMemo(() =>
    publicCourses.filter(c => !coursesSearch || c.title?.toLowerCase().includes(coursesSearch.toLowerCase()) || c.groupName?.toLowerCase().includes(coursesSearch.toLowerCase())),
    [coursesSearch, publicCourses]
  );

  const filteredTests = useMemo(() =>
    publicTests.filter(t => !testsSearch || t.title?.toLowerCase().includes(testsSearch.toLowerCase()) || t.courseTitle?.toLowerCase().includes(testsSearch.toLowerCase())),
    [testsSearch, publicTests]
  );

  if (!user || user.role !== "admin") return null;

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "overview", label: "Обзор" },
    { id: "users", label: "Пользователи", count: users.length },
    { id: "plans", label: "Тарифы" },
    { id: "templates", label: "Шаблоны", count: templateDecks.length },
    { id: "decks", label: "Колоды", count: decks.length || undefined },
    { id: "courses", label: "Курсы", count: publicCourses.length || undefined },
    { id: "tests", label: "Тесты", count: publicTests.length || undefined },
    { id: "ai", label: "AI" },
    { id: "hf", label: "HF / TTS" },
    { id: "broadcast", label: "Рассылка" },
  ];

  const statsCards = stats ? [
    { label: "Пользователей", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
    { label: "Премиум", value: stats.premiumUsers, icon: Shield, color: "text-amber-400" },
    { label: "Карточек", value: stats.totalCards, icon: BookOpen, color: "text-violet-400" },
    { label: "Активных сегодня", value: stats.activeToday, icon: Activity, color: "text-green-400" },
    { label: "Платежей", value: stats.totalPayments, icon: CreditCard, color: "text-red-400" },
    { label: "Выручка", value: `${(stats.totalRevenue || 0).toLocaleString("ru")} ₽`, icon: TrendingUp, color: "text-emerald-400" },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto space-y-5 page-enter">
      {showCreateCourse && (
        <CreateCourseModal
          groups={allGroups}
          onCreated={loadPublicCourses}
          onClose={() => setShowCreateCourse(false)}
        />
      )}
      {showCreateDeck && (
        <CreateDeckModal
          onCreated={() => { loadAdminDecks(); setShowCreateDeck(false); }}
          onClose={() => setShowCreateDeck(false)}
        />
      )}
      {showCreateTest && (
        <CreateStandaloneTestModal
          onCreated={() => { loadPublicTests(); setShowCreateTest(false); }}
          onClose={() => setShowCreateTest(false)}
        />
      )}

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Shield size={20} className="text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Панель администратора</h1>
          <p className="text-xs text-muted-foreground">Управление курсами, тестами, пользователями и настройками платформы</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-accent/50 p-1 rounded-xl flex-wrap">
        {tabs.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              tab === item.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full",
                tab === item.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {statsCards.map(item => (
              <div key={item.label} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <item.icon size={18} className={item.color} />
                </div>
                <div>
                  <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2"><Bot size={17} className="text-blue-400" /><h3 className="font-semibold">AI</h3></div>
              <div className="text-sm space-y-2">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">API ключ</span><Badge variant={aiSettings?.hasApiKey ? "default" : "secondary"}>{aiSettings?.hasApiKey ? (aiSettings?.maskedApiKey || "Настроен") : "Не указан"}</Badge></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Модель</span><span className="text-right break-all text-xs">{aiSettings?.model || "Не задана"}</span></div>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2"><KeyRound size={17} className="text-orange-400" /><h3 className="font-semibold">HuggingFace</h3></div>
              <div className="text-sm space-y-2">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Токен</span><Badge variant={hfSettings?.hasApiToken ? "default" : "secondary"}>{hfSettings?.hasApiToken ? (hfSettings?.maskedApiToken || "Настроен") : "Не указан"}</Badge></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">TTS</span><span className="text-right break-all text-xs">{hfSettings?.ttsModel || "Не задана"}</span></div>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Групп", value: contentOverview?.counts?.groups || 0, icon: Users, color: "text-blue-400" },
              { label: "Курсов", value: contentOverview?.counts?.courses || 0, icon: Library, color: "text-violet-400" },
              { label: "Тестов", value: contentOverview?.counts?.tests || 0, icon: TestTube2, color: "text-amber-400" },
              { label: "Грамматика", value: contentOverview?.counts?.grammarTopics || 0, icon: FileText, color: "text-emerald-400" },
            ].map(item => (
              <div key={item.label} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <item.icon size={18} className={item.color} />
                </div>
                <div>
                  <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <div className="space-y-2">
            {filteredUsers.map(u => (
              <div key={u.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {u.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{u.name}</span>
                    {u.isPremium && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/15 text-amber-500 rounded-full font-semibold border border-amber-500/20">PRO</span>}
                    {u.role === "admin" && <span className="text-[9px] px-1.5 py-0.5 bg-violet-500/15 text-violet-500 rounded-full font-semibold border border-violet-500/20">Админ</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>{u.xp || 0} XP</span>
                    <span>{u.studyStreak || 0} дней подряд</span>
                    <span>{formatDate(u.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                  {!u.isPremium
                    ? <Button variant="outline" size="sm" onClick={() => handleGivePremium(u.id, 30)} className="text-[11px] h-7 px-2.5">+ 30 дней PRO</Button>
                    : <Button variant="outline" size="sm" onClick={() => handleGivePremium(u.id, 365)} className="text-[11px] h-7 px-2.5">+ 1 год PRO</Button>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLANS */}
      {tab === "plans" && (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="glass-card rounded-xl p-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{plan.name}</span>
                  <Badge variant={plan.isActive ? "default" : "secondary"}>{plan.isActive ? "Активен" : "Отключён"}</Badge>
                </div>
                <div className="text-2xl font-bold gradient-text">{plan.price.toLocaleString("ru")} ₽</div>
                <div className="text-sm text-muted-foreground">{plan.intervalDays} дней</div>
                <div className="flex gap-2 flex-wrap mt-2">
                  {plan.features?.map((f: string) => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={async () => {
                await adminApi.updatePlan(plan.id, { isActive: !plan.isActive });
                loadData();
                toast.success("Тариф обновлён");
              }}>
                {plan.isActive ? "Отключить" : "Включить"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* TEMPLATES */}
      {tab === "templates" && (
        <div className="space-y-3">
          {templateDecks.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground">Шаблонные колоды не найдены.</div>
          )}
          {templateDecks.map(deck => (
            <div key={deck.id} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-accent flex items-center justify-center text-2xl flex-shrink-0">
                {deck.imageUrl ? <img src={deck.imageUrl} alt="" className="w-full h-full object-cover" /> : deck.emoji || "📚"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{deck.name}</span>
                  <Badge variant={deck.isPublic ? "default" : "secondary"}>{deck.isPublic ? "Публичная" : "Скрытая"}</Badge>
                  {deck.category && <Badge variant="outline">{deck.category}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{deck.description || "Без описания"}</div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                  <span>{deck.cardCount || 0} карточек</span>
                  <span>Автор: {deck.ownerName || "Неизвестен"}</span>
                  {deck.updatedAt && <span>{formatDate(deck.updatedAt)}</span>}
                </div>
              </div>
              <Button variant={deck.isPublic ? "outline" : "gradient"} size="sm" onClick={() => handleToggleTemplateDeck(deck)}>
                {deck.isPublic ? "Скрыть" : "Опубликовать"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* PUBLIC COURSES */}
      {tab === "courses" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск курсов..."
                value={coursesSearch}
                onChange={e => setCoursesSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <Button
              onClick={loadPublicCourses}
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0"
            >
              <RefreshCw size={13} />
              Обновить
            </Button>
            <Button
              onClick={() => { if (allGroups.length === 0) { toast.error("Сначала загрузите группы"); return; } setShowCreateCourse(true); }}
              size="sm"
              className="gap-1.5 flex-shrink-0"
            >
              <Plus size={13} />
              Новый курс
            </Button>
          </div>

          {publicCoursesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-accent/20 animate-pulse" />
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <Globe size={28} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">Публичные курсы не найдены</p>
              <p className="text-sm text-muted-foreground">Создайте первый курс или проверьте настройки видимости групп</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCourses.map(course => (
                <CourseRow
                  key={course.id}
                  course={course}
                  onDelete={loadPublicCourses}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* PUBLIC TESTS */}
      {tab === "tests" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск тестов..."
                value={testsSearch}
                onChange={e => setTestsSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <Button
              onClick={loadPublicTests}
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0"
            >
              <RefreshCw size={13} />
              Обновить
            </Button>
            <Button
              onClick={() => setShowCreateTest(true)}
              size="sm"
              className="gap-1.5 flex-shrink-0"
            >
              <Plus size={13} />
              Создать тест
            </Button>
          </div>

          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-400 flex items-start gap-2">
            <HelpCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Вопросы теста редактируются через редактор курса (кнопка «Редактировать»).
              Здесь можно настроить параметры теста: время, баллы, количество попыток.
            </span>
          </div>

          {publicTestsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 rounded-xl bg-accent/20 animate-pulse" />
              ))}
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <TestTube2 size={28} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">Тесты не найдены</p>
              <p className="text-sm text-muted-foreground">Тесты создаются в редакторе курса через блок «Тест»</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTests.map(test => (
                <TestRow
                  key={test.id}
                  test={test}
                  onSaved={loadPublicTests}
                  onDelete={loadPublicTests}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DECKS */}
      {tab === "decks" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold flex-1">Управление колодами</h2>
            <Button onClick={loadAdminDecks} variant="outline" size="sm" className="gap-1.5 flex-shrink-0">
              <RefreshCw size={13} />
              Обновить
            </Button>
            <Button onClick={() => setShowCreateDeck(true)} size="sm" className="gap-1.5 flex-shrink-0">
              <Plus size={13} />
              Создать колоду
            </Button>
          </div>

          {loadingDecks ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-accent/20 animate-pulse" />)}
            </div>
          ) : decks.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <BookOpen size={28} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">Колоды не найдены</p>
              <p className="text-sm text-muted-foreground">Создайте первую колоду</p>
            </div>
          ) : (
            <div className="space-y-2">
              {decks.map(deck => (
                <DeckAdminRow
                  key={deck.id}
                  deck={deck}
                  isEditing={editingDeck?.id === deck.id}
                  onToggleEdit={() => setEditingDeck((prev: any) => prev?.id === deck.id ? null : deck)}
                  onPublicToggle={async () => {
                    try {
                      const updated = await adminApi.updateTemplateDeck(deck.id, { isPublic: !deck.isPublic });
                      setDecks(cur => cur.map(d => d.id === updated.id ? updated : d));
                      toast.success(updated.isPublic ? "Колода опубликована" : "Колода скрыта");
                    } catch { toast.error("Ошибка обновления"); }
                  }}
                  onDelete={async () => {
                    if (!confirm(`Удалить колоду «${deck.name}»?`)) return;
                    try {
                      await adminApi.deleteTemplateDeck(deck.id);
                      setDecks(cur => cur.filter(d => d.id !== deck.id));
                      if (editingDeck?.id === deck.id) setEditingDeck(null);
                      toast.success("Колода удалена");
                    } catch { toast.error("Ошибка удаления"); }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI SETTINGS */}
      {tab === "ai" && (
        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2"><Bot size={18} className="text-blue-400" /><h3 className="font-semibold">Настройки AI</h3></div>

            {/* Provider selector */}
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Провайдер</label>
              <div className="flex gap-2">
                {[
                  { value: "openrouter", label: "OpenRouter" },
                  { value: "ollama", label: "Ollama" },
                  { value: "lmstudio", label: "LM Studio" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAiForm(cur => ({ ...cur, provider: opt.value }))}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all",
                      aiForm.provider === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {(aiForm.provider === "ollama" || aiForm.provider === "lmstudio") && (
                <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 px-3 py-2 text-xs text-blue-400 flex items-center gap-2">
                  <Bot size={12} />
                  Локальный сервер — API ключ не требуется
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Модель</label>
                <Input
                  value={aiForm.model}
                  onChange={e => setAiForm(cur => ({ ...cur, model: e.target.value }))}
                  placeholder={
                    aiForm.provider === "ollama" ? "llama3.2" :
                    aiForm.provider === "lmstudio" ? "mistral" :
                    "openai/gpt-4o-mini"
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Base URL</label>
                <Input
                  value={aiForm.baseUrl}
                  onChange={e => setAiForm(cur => ({ ...cur, baseUrl: e.target.value }))}
                  placeholder={
                    aiForm.provider === "ollama" ? "http://localhost:11434/v1" :
                    aiForm.provider === "lmstudio" ? "http://localhost:1234/v1" :
                    "https://openrouter.ai/api/v1"
                  }
                />
              </div>
              {aiForm.provider === "openrouter" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Название сайта</label>
                    <Input
                      value={aiForm.siteName}
                      onChange={e => setAiForm(cur => ({ ...cur, siteName: e.target.value }))}
                      placeholder="LowKey English"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">URL сайта</label>
                    <Input
                      value={aiForm.siteUrl}
                      onChange={e => setAiForm(cur => ({ ...cur, siteUrl: e.target.value }))}
                      placeholder="https://english.lowkey.su"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Temperature</label>
                <Input
                  value={aiForm.temperature}
                  onChange={e => setAiForm(cur => ({ ...cur, temperature: e.target.value }))}
                  placeholder="0.7"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Max tokens</label>
                <Input
                  value={aiForm.maxTokens}
                  onChange={e => setAiForm(cur => ({ ...cur, maxTokens: e.target.value }))}
                  placeholder="2048"
                />
              </div>
            </div>

            {aiForm.provider === "openrouter" && (
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">API ключ OpenRouter</label>
                <Input
                  type="password"
                  value={aiForm.apiKey}
                  onChange={e => setAiForm(cur => ({ ...cur, apiKey: e.target.value }))}
                  placeholder={aiSettings?.hasApiKey ? "Оставьте пустым чтобы не менять" : "sk-or-v1-..."}
                />
              </div>
            )}

            <Button variant="gradient" onClick={handleSaveAiSettings} disabled={savingAi} className="gap-2">
              <Save size={16} />{savingAi ? "Сохранение..." : "Сохранить настройки AI"}
            </Button>
          </div>
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2"><KeyRound size={18} className="text-amber-400" /><h3 className="font-semibold">Текущее состояние</h3></div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Провайдер</span><Badge variant="outline">{aiSettings?.provider || "openrouter"}</Badge></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">API ключ</span><Badge variant={aiSettings?.hasApiKey ? "default" : "secondary"}>{aiSettings?.hasApiKey ? (aiSettings?.maskedApiKey || "Настроен") : "Не указан"}</Badge></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Модель</span><span className="text-right break-all text-xs">{aiSettings?.model || "Не задана"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Обновлено</span><span className="text-xs">{aiSettings?.updatedAt ? formatDate(aiSettings.updatedAt) : "Не сохранено"}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* HF SETTINGS */}
      {tab === "hf" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2"><Bot size={18} className="text-orange-400" /><h3 className="font-semibold">HuggingFace</h3></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">TTS модель</label>
                  <Input value={hfForm.ttsModel} onChange={e => setHfForm(cur => ({ ...cur, ttsModel: e.target.value }))} placeholder="facebook/mms-tts-eng" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Speech модель</label>
                  <Input value={hfForm.speechModel} onChange={e => setHfForm(cur => ({ ...cur, speechModel: e.target.value }))} placeholder="openai/whisper-small.en" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">HF токен</label>
                <Input type="password" value={hfForm.apiToken} onChange={e => setHfForm(cur => ({ ...cur, apiToken: e.target.value }))} placeholder={hfSettings?.hasApiToken ? "Оставьте пустым чтобы не менять" : "hf_..."} />
              </div>
              <Button variant="gradient" onClick={handleSaveHfSettings} disabled={savingHf} className="gap-2">
                <Save size={16} />{savingHf ? "Сохранение..." : "Сохранить HF настройки"}
              </Button>
            </div>
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2"><KeyRound size={18} className="text-amber-400" /><h3 className="font-semibold">Текущее состояние</h3></div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Токен</span><Badge variant={hfSettings?.hasApiToken ? "default" : "secondary"}>{hfSettings?.hasApiToken ? (hfSettings?.maskedApiToken || "Настроен") : "Не указан"}</Badge></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">TTS</span><span className="text-right break-all text-xs">{hfSettings?.ttsModel || "Не задана"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Speech</span><span className="text-right break-all text-xs">{hfSettings?.speechModel || "Не задана"}</span></div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs text-muted-foreground">
                Аудио кешируется в VoidDB <code>english-sounds</code>, медиа в <code>english-media</code>.
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2"><BookOpen size={17} className="text-orange-400" /><h3 className="font-semibold">TTS пресеты</h3></div>
              {HF_PRESETS.tts.map(preset => (
                <div key={preset.model} className="rounded-xl border border-white/10 bg-black/10 p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm">{preset.label}</div>
                    <div className="text-xs text-muted-foreground mt-1 break-all">{preset.model}</div>
                    <div className="text-xs text-muted-foreground mt-2">{preset.note}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setHfForm(cur => ({ ...cur, ttsModel: preset.model }))}>Выбрать</Button>
                </div>
              ))}
            </div>
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2"><TestTube2 size={17} className="text-amber-400" /><h3 className="font-semibold">Speech пресеты</h3></div>
              {HF_PRESETS.speech.map(preset => (
                <div key={preset.model} className="rounded-xl border border-white/10 bg-black/10 p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm">{preset.label}</div>
                    <div className="text-xs text-muted-foreground mt-1 break-all">{preset.model}</div>
                    <div className="text-xs text-muted-foreground mt-2">{preset.note}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setHfForm(cur => ({ ...cur, speechModel: preset.model }))}>Выбрать</Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BROADCAST */}
      {tab === "broadcast" && (
        <div className="glass-card rounded-2xl p-6 space-y-4 max-w-lg">
          <h3 className="font-semibold flex items-center gap-2"><Send size={18} />Telegram рассылка</h3>
          <textarea
            value={broadcastMsg}
            onChange={e => setBroadcastMsg(e.target.value)}
            placeholder="Текст сообщения. Поддерживается Markdown."
            rows={5}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" id="premiumOnly" checked={premiumOnly} onChange={e => setPremiumOnly(e.target.checked)} />
            <span className="text-sm">Только премиум-пользователи</span>
          </label>
          <Button variant="gradient" onClick={handleBroadcast} disabled={sending || !broadcastMsg.trim()} className="w-full gap-2">
            <Send size={16} />{sending ? "Отправка..." : "Отправить рассылку"}
          </Button>
        </div>
      )}
    </div>
  );
}
