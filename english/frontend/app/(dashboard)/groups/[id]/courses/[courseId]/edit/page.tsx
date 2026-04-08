"use client";

import {
  useEffect, useState, useCallback, useRef, KeyboardEvent,
  ChangeEvent, MouseEvent as ReactMouseEvent
} from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Save, Loader2, Plus, GripVertical, Trash2,
  BookOpen, CreditCard, ClipboardList,
  Image as ImageIcon, Code, Quote, Minus,
  ChevronDown, ChevronUp, Eye, EyeOff,
  Bold, Italic, Link2, Upload, X, Check, Sparkles,
  Hash, AlignLeft, Film, Paperclip,
  Clock, Target, RefreshCw, MoveVertical,
  Settings2, Library, Layers,
  Pencil, Copy,
} from "lucide-react";
import { useContextMenu, ContextMenuPortal } from "@/components/ui/context-menu-custom";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { socialApi, cardsApi } from "@/api/client";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Block = {
  id: string;
  type: string;
  title: string | null;
  content: any;
  orderIndex: number;
};

type Course = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  level: string;
  isPublished: boolean;
  description: string | null;
  estimatedMinutes: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_TYPES = [
  { type: "text",    label: "Текст",       icon: AlignLeft,    desc: "Обычный текст или Markdown" },
  { type: "heading", label: "Заголовок",   icon: Hash,         desc: "H1 / H2 / H3" },
  { type: "image",   label: "Изображение", icon: ImageIcon,    desc: "Загрузить или вставить по ссылке" },
  { type: "video",   label: "Видео",       icon: Film,         desc: "YouTube, Vimeo или файл" },
  { type: "code",    label: "Код",         icon: Code,         desc: "Блок кода с подсветкой" },
  { type: "quote",   label: "Цитата",      icon: Quote,        desc: "Выделенная цитата" },
  { type: "divider", label: "Разделитель", icon: Minus,        desc: "Горизонтальная линия" },
  { type: "grammar", label: "Грамматика",  icon: BookOpen,     desc: "Правило с примерами" },
  { type: "cards",   label: "Карточки",    icon: CreditCard,   desc: "Колода словарных карточек" },
  { type: "test",    label: "Тест",        icon: ClipboardList,desc: "Вопросы с проверкой знаний" },
  { type: "file",    label: "Файл",        icon: Paperclip,    desc: "Прикреплённый документ" },
];

const LEVELS = [
  { value: "beginner",          label: "A1 — Начинающий" },
  { value: "elementary",        label: "A2 — Элементарный" },
  { value: "intermediate",      label: "B1 — Средний" },
  { value: "upper-intermediate",label: "B2 — Выше среднего" },
  { value: "advanced",          label: "C1 — Продвинутый" },
  { value: "proficient",        label: "C2 — Свободный" },
];

const QUESTION_TYPES = [
  { value: "single_choice",   label: "Один вариант",        icon: "○" },
  { value: "multiple_choice", label: "Несколько вариантов", icon: "☑" },
  { value: "fill_blank",      label: "Заполнить пропуск",   icon: "▭" },
  { value: "text_input",      label: "Свободный ответ",     icon: "✏" },
  { value: "match",           label: "Сопоставить пары",    icon: "⇌" },
  { value: "order",           label: "Расставить порядок",  icon: "⇅" },
];

const EMOJIS = ["📚","✏️","🎓","🌍","💬","🔤","📖","🧠","💡","🎯","🏆","⭐","🚀","🌟","🎪","🎨","🎭","🎵","🎮","🌈"];

function defaultContent(type: string): any {
  const map: Record<string, any> = {
    text: { markdown: "" },
    heading: { text: "", level: 1 },
    image: { url: "", caption: "", alt: "" },
    video: { url: "", title: "" },
    code: { code: "", language: "javascript" },
    quote: { text: "", author: "" },
    divider: {},
    grammar: { explanation: "", rules: [], examples: [] },
    cards: { deckId: null, cards: [], requireBeforeNext: false },
    test: { questions: [], settings: { passingScore: 70, pointsPerQuestion: 1, allowRetry: true } },
    file: { url: "", name: "", size: 0 },
  };
  return map[type] || {};
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getYouTubeEmbed(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&\s]+)/,
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtube\.com\/embed\/([^?&\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
  }
  return null;
}

function getVimeoEmbed(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

// ─── Slash command menu ───────────────────────────────────────────────────────

function SlashMenu({
  query,
  onSelect,
  onClose,
}: {
  query: string;
  onSelect: (type: string) => void;
  onClose: () => void;
}) {
  const filtered = BLOCK_TYPES.filter(
    bt => bt.label.toLowerCase().includes(query.toLowerCase()) ||
          bt.type.toLowerCase().includes(query.toLowerCase())
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => { setIdx(0); }, [query]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter")     { e.preventDefault(); if (filtered[idx]) onSelect(filtered[idx].type); }
      if (e.key === "Escape")    { onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, idx, onSelect, onClose]);

  if (!filtered.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="absolute z-50 top-full mt-1 left-0 w-72 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      style={{ background: "rgba(16,16,28,0.97)", backdropFilter: "blur(20px)" }}
    >
      <div className="px-3 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5">
        Вставить блок
      </div>
      <div className="p-1.5 max-h-64 overflow-y-auto">
        {filtered.map((bt, i) => {
          const Icon = bt.icon;
          return (
            <button
              key={bt.type}
              onClick={() => onSelect(bt.type)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors",
                i === idx ? "bg-white/10" : "hover:bg-white/5"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-white/60" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/90">{bt.label}</div>
                <div className="text-[11px] text-white/30">{bt.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Block-specific editors ───────────────────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
      className={cn(
        "w-full bg-transparent resize-none focus:outline-none overflow-hidden",
        className
      )}
    />
  );
}

function TextBlockEditor({
  content,
  onChange,
  groupId,
  courseId,
  blockId,
}: {
  content: any;
  onChange: (c: any) => void;
  groupId: string;
  courseId: string;
  blockId: string;
}) {
  const text = content?.markdown || "";
  const [editing, setEditing] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [slashIdx, setSlashIdx] = useState<number | null>(null);
  const [slashQuery, setSlashQuery] = useState("");

  const insertAtCursor = (before: string, after = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const sel = text.slice(s, e);
    const newText = text.slice(0, s) + before + sel + after + text.slice(e);
    onChange({ ...content, markdown: newText });
    setTimeout(() => {
      el.selectionStart = s + before.length;
      el.selectionEnd = s + before.length + sel.length;
      el.focus();
    }, 0);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await socialApi.uploadMedia(file);
      if (result?.url) {
        const alt = file.name.replace(/\.[^.]+$/, "");
        if (result.isVideo || file.type.startsWith("video/")) {
          onChange({ ...content, markdown: text + `\n<video src="${result.url}" controls style="max-width:100%;border-radius:12px"></video>\n` });
        } else {
          onChange({ ...content, markdown: text + `\n![${alt}](${result.url})\n` });
        }
        toast.success("Медиафайл вставлен");
      }
    } catch { toast.error("Ошибка загрузки"); }
    finally { setUploading(false); if (e.target) e.target.value = ""; }
  };

  const handleChange = (v: string) => {
    const lastSlash = v.lastIndexOf("/");
    if (lastSlash !== -1) {
      const after = v.slice(lastSlash + 1);
      if (!after.includes(" ") && !after.includes("\n")) {
        setSlashIdx(lastSlash);
        setSlashQuery(after);
        onChange({ ...content, markdown: v });
        return;
      }
    }
    setSlashIdx(null);
    setSlashQuery("");
    onChange({ ...content, markdown: v });
  };

  // Preview mode — Obsidian-like: click to edit, blur to preview
  if (!editing) {
    return (
      <div
        className="relative cursor-text min-h-[80px] rounded-xl p-3 hover:bg-white/3 transition-colors border border-transparent hover:border-white/8 group"
        onClick={() => { setEditing(true); setTimeout(() => textareaRef.current?.focus(), 50); }}
        title="Нажмите для редактирования"
      >
        {text.trim() ? (
          <div className="prose prose-invert prose-sm max-w-none text-white/85 text-sm leading-relaxed
            [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2
            [&_h3]:text-base [&_h3]:font-medium [&_h3]:mb-1
            [&_p]:mb-2 [&_p]:last:mb-0
            [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2
            [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2
            [&_li]:mb-0.5
            [&_strong]:text-white [&_strong]:font-semibold
            [&_em]:text-white/70 [&_em]:italic
            [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
            [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_blockquote]:text-white/50 [&_blockquote]:italic
            [&_a]:text-primary [&_a]:underline
            [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-2
            [&_hr]:border-white/10">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-white/20 text-sm italic">Нажмите для ввода текста...</p>
        )}
        <button
          onClick={e => { e.stopPropagation(); setEditing(true); setTimeout(() => textareaRef.current?.focus(), 50); }}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/12 text-white/30 hover:text-white/70 transition-all opacity-0 group-hover:opacity-100"
          title="Редактировать"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        <button onClick={() => insertAtCursor("**", "**")} title="Жирный"
          className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors">
          <Bold size={13} />
        </button>
        <button onClick={() => insertAtCursor("*", "*")} title="Курсив"
          className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors">
          <Italic size={13} />
        </button>
        <button onClick={() => insertAtCursor("`", "`")} title="Код"
          className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors">
          <Code size={13} />
        </button>
        <button onClick={() => insertAtCursor("[текст](", ")")} title="Ссылка"
          className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors">
          <Link2 size={13} />
        </button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <button onClick={() => insertAtCursor("## ", "")} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors text-xs font-bold">H2</button>
        <button onClick={() => insertAtCursor("### ", "")} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors text-xs font-bold">H3</button>
        <button onClick={() => insertAtCursor("- ", "")} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors text-base leading-none">•</button>
        <button onClick={() => insertAtCursor("> ", "")} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors"><Quote size={13} /></button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors disabled:opacity-40">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          <span className="text-[11px]">Медиа</span>
        </button>
        <div className="ml-auto">
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/70 transition-colors text-[11px]"
            title="Предпросмотр (как в Obsidian)"
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Textarea with slash menu */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => handleChange(e.target.value)}
          onBlur={() => {
                setTimeout(() => {
                  if (!containerRef.current?.contains(document.activeElement)) {
                    if (text.trim()) setEditing(false);
                  }
                }, 150);
              }}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === "b") { e.preventDefault(); insertAtCursor("**", "**"); }
            if (e.ctrlKey && e.key === "i") { e.preventDefault(); insertAtCursor("*", "*"); }
            if (e.key === "Escape") { setEditing(false); }
          }}
          placeholder="Начните писать... Используйте / для вставки блока"
          rows={6}
          autoFocus
          className="w-full bg-transparent resize-none focus:outline-none text-sm text-white/90 placeholder:text-white/20 leading-relaxed font-mono"
          style={{ minHeight: 120 }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
          }}
        />
        <AnimatePresence>
          {slashIdx !== null && (
            <SlashMenu
              query={slashQuery}
              onSelect={() => { setSlashIdx(null); setSlashQuery(""); }}
              onClose={() => { setSlashIdx(null); setSlashQuery(""); }}
            />
          )}
        </AnimatePresence>
      </div>
      <div className="mt-1.5 text-[11px] text-white/15">
        Esc или клик за пределами → предпросмотр · / → вставить блок
      </div>
    </div>
  );
}

function HeadingBlockEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const level = content?.level || 1;
  const sizes = { 1: "text-3xl font-bold", 2: "text-2xl font-semibold", 3: "text-xl font-medium" };

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3].map(l => (
          <button key={l} onClick={() => onChange({ ...content, level: l })}
            className={cn("w-8 h-7 rounded-lg text-sm font-bold transition-colors",
              level === l ? "bg-primary text-white" : "bg-white/5 text-white/40 hover:text-white/70")}>
            H{l}
          </button>
        ))}
      </div>
      <AutoTextarea
        value={content?.text || ""}
        onChange={v => onChange({ ...content, text: v })}
        placeholder="Текст заголовка..."
        className={cn("text-white/90", sizes[level as 1|2|3])}
      />
    </div>
  );
}

function ImageBlockEditor({
  content,
  onChange,
  groupId,
  courseId,
  blockId,
}: {
  content: any;
  onChange: (c: any) => void;
  groupId: string;
  courseId: string;
  blockId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await socialApi.uploadMedia(file);
      if (result?.url) onChange({ ...content, url: result.url });
    } catch { toast.error("Ошибка загрузки"); }
    finally { setUploading(false); if (e.target) e.target.value = ""; }
  };

  return (
    <div className="space-y-3">
      {content?.url ? (
        <div className="relative group/img">
          <img src={content.url} alt={content.alt || ""} className="w-full rounded-xl max-h-80 object-cover" />
          <button
            onClick={() => onChange({ ...content, url: "" })}
            className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-white/20 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) {
              const ev = { target: { files: [file] } } as any;
              handleUpload(ev);
            }
          }}
        >
          {uploading ? (
            <Loader2 size={24} className="mx-auto animate-spin text-white/30" />
          ) : (
            <>
              <ImageIcon size={24} className="mx-auto text-white/20 mb-2" />
              <p className="text-sm text-white/40">Перетащите или нажмите для загрузки</p>
            </>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <div className="flex gap-2">
        <input
          type="text"
          value={content?.url || ""}
          onChange={e => onChange({ ...content, url: e.target.value })}
          placeholder="Или вставьте ссылку на изображение..."
          className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
        />
      </div>
      <input
        type="text"
        value={content?.caption || ""}
        onChange={e => onChange({ ...content, caption: e.target.value })}
        placeholder="Подпись к изображению (необязательно)..."
        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
      />
    </div>
  );
}

function VideoBlockEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const url = content?.url || "";
  const embedUrl = getYouTubeEmbed(url) || getVimeoEmbed(url) || null;
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await socialApi.uploadMedia(file);
      if (result?.url) onChange({ ...content, url: result.url });
      toast.success("Видео загружено");
    } catch { toast.error("Ошибка загрузки видео"); }
    finally { setUploading(false); if (e.target) e.target.value = ""; }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={e => onChange({ ...content, url: e.target.value })}
          placeholder="YouTube, Vimeo или прямая ссылка на видео..."
          className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
        />
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 flex-shrink-0"
          title="Загрузить видеофайл"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          <span className="text-xs">Загрузить</span>
        </button>
      </div>
      {embedUrl && (
        <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
          <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="video" />
        </div>
      )}
      {url && !embedUrl && (
        <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
          <video src={url} controls className="w-full h-full" />
        </div>
      )}
      <input
        type="text"
        value={content?.title || ""}
        onChange={e => onChange({ ...content, title: e.target.value })}
        placeholder="Название видео (необязательно)..."
        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
      />
    </div>
  );
}

function CodeBlockEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const langs = ["javascript","typescript","python","java","go","rust","html","css","sql","bash","json","markdown","plaintext"];
  return (
    <div className="space-y-2">
      <select
        value={content?.language || "javascript"}
        onChange={e => onChange({ ...content, language: e.target.value })}
        className="h-8 px-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 focus:outline-none"
      >
        {langs.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <textarea
        value={content?.code || ""}
        onChange={e => onChange({ ...content, code: e.target.value })}
        placeholder="// Введите код..."
        rows={8}
        className="w-full bg-black/30 rounded-xl p-4 text-sm text-green-300 font-mono resize-none focus:outline-none border border-white/5 leading-relaxed"
        spellCheck={false}
      />
    </div>
  );
}

function QuoteBlockEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className="border-l-4 border-primary/60 pl-4 space-y-2">
      <AutoTextarea
        value={content?.text || ""}
        onChange={v => onChange({ ...content, text: v })}
        placeholder="Текст цитаты..."
        className="text-lg text-white/80 italic"
      />
      <input
        type="text"
        value={content?.author || ""}
        onChange={e => onChange({ ...content, author: e.target.value })}
        placeholder="— Автор (необязательно)"
        className="w-full bg-transparent text-sm text-white/40 placeholder:text-white/20 focus:outline-none"
      />
    </div>
  );
}

function GrammarBlockEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const rules: any[] = content?.rules || [];
  const examples: any[] = content?.examples || [];

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wider">Объяснение</label>
        <textarea
          value={content?.explanation || ""}
          onChange={e => onChange({ ...content, explanation: e.target.value })}
          rows={3}
          placeholder="Опишите грамматическое правило..."
          className="w-full bg-white/3 rounded-xl p-3 text-sm text-white/80 placeholder:text-white/20 resize-none focus:outline-none border border-white/5 focus:border-white/15 transition-colors"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-white/40 uppercase tracking-wider">Правила</label>
          <button onClick={() => onChange({ ...content, rules: [...rules, { rule: "", example: "" }] })}
            className="text-xs text-primary hover:text-primary/80 transition-colors">+ Добавить</button>
        </div>
        {rules.map((r: any, i: number) => (
          <div key={i} className="flex gap-2 mb-2">
            <div className="flex-1 space-y-1">
              <input value={r.rule || ""} onChange={e => {
                const u = [...rules]; u[i] = { ...u[i], rule: e.target.value };
                onChange({ ...content, rules: u });
              }} placeholder="Правило..." className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15" />
              <input value={r.example || ""} onChange={e => {
                const u = [...rules]; u[i] = { ...u[i], example: e.target.value };
                onChange({ ...content, rules: u });
              }} placeholder="Пример использования..." className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-white/60 placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15" />
            </div>
            <button onClick={() => onChange({ ...content, rules: rules.filter((_: any, j: number) => j !== i) })}
              className="text-white/20 hover:text-red-400 transition-colors mt-2"><X size={14} /></button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-white/40 uppercase tracking-wider">Примеры (EN → RU)</label>
          <button onClick={() => onChange({ ...content, examples: [...examples, { en: "", ru: "" }] })}
            className="text-xs text-primary hover:text-primary/80 transition-colors">+ Добавить</button>
        </div>
        {examples.map((ex: any, i: number) => (
          <div key={i} className="flex gap-2 mb-2 items-center">
            <input value={ex.en || ""} onChange={e => {
              const u = [...examples]; u[i] = { ...u[i], en: e.target.value };
              onChange({ ...content, examples: u });
            }} placeholder="English sentence..." className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15" />
            <input value={ex.ru || ""} onChange={e => {
              const u = [...examples]; u[i] = { ...u[i], ru: e.target.value };
              onChange({ ...content, examples: u });
            }} placeholder="Перевод..." className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-white/60 placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15" />
            <button onClick={() => onChange({ ...content, examples: examples.filter((_: any, j: number) => j !== i) })}
              className="text-white/20 hover:text-red-400 transition-colors"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardsBlockEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const [decks, setDecks] = useState<any[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [deckCards, setDeckCards] = useState<any[]>([]);
  const linkedDeckId: string | null = content?.deckId || null;
  const requireBeforeNext: boolean = content?.requireBeforeNext ?? false;

  useEffect(() => {
    setLoadingDecks(true);
    cardsApi.getDecks()
      .then(d => setDecks(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingDecks(false));
  }, []);

  useEffect(() => {
    if (!linkedDeckId) { setDeckCards([]); return; }
    cardsApi.getCards({ deckId: linkedDeckId })
      .then(d => setDeckCards(Array.isArray(d) ? d : []))
      .catch(() => setDeckCards([]));
  }, [linkedDeckId]);

  const selectedDeck = decks.find(d => d.id === linkedDeckId);

  return (
    <div className="space-y-3">
      {/* Deck linking section */}
      <div className="rounded-xl border border-white/8 bg-white/2 p-3 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Library size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Привязать колоду словаря</span>
        </div>
        <select
          value={linkedDeckId || ""}
          onChange={e => onChange({ ...content, deckId: e.target.value || null, cards: [] })}
          className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/25"
          disabled={loadingDecks}
        >
          <option value="">— Без привязки к колоде —</option>
          {decks.map((d: any) => (
            <option key={d.id} value={d.id}>{d.emoji || "📚"} {d.name} ({d.cardCount || 0} карт)</option>
          ))}
        </select>
        {selectedDeck && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-xl">{selectedDeck.emoji || "📚"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{selectedDeck.name}</div>
              <div className="text-xs text-blue-400">{deckCards.length} карточек</div>
            </div>
          </div>
        )}
        {selectedDeck && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => onChange({ ...content, requireBeforeNext: !requireBeforeNext })}
              className={cn(
                "w-8 h-4 rounded-full transition-colors relative flex-shrink-0 cursor-pointer",
                requireBeforeNext ? "bg-amber-500" : "bg-white/15"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
                requireBeforeNext ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
            <span className="text-xs text-white/60">
              Заблокировать следующий блок до изучения всех карточек
            </span>
          </label>
        )}
      </div>

      {/* Manual cards (when no deck linked) */}
      {!linkedDeckId && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40 uppercase tracking-wider">Карточки вручную</span>
            <button onClick={() => onChange({ ...content, cards: [...(content?.cards || []), { front: "", back: "", example: "" }] })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors">
              <Plus size={11} />Добавить
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(content?.cards || []).map((card: any, i: number) => (
              <div key={i} className="flex gap-2 p-3 rounded-xl bg-white/3 border border-white/5 group/card">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input value={card.front || ""} onChange={e => {
                    const u = [...(content?.cards || [])]; u[i] = { ...u[i], front: e.target.value };
                    onChange({ ...content, cards: u });
                  }} placeholder="Слово..." className="bg-white/5 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15" />
                  <input value={card.back || ""} onChange={e => {
                    const u = [...(content?.cards || [])]; u[i] = { ...u[i], back: e.target.value };
                    onChange({ ...content, cards: u });
                  }} placeholder="Перевод..." className="bg-white/5 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15" />
                  <input value={card.example || ""} onChange={e => {
                    const u = [...(content?.cards || [])]; u[i] = { ...u[i], example: e.target.value };
                    onChange({ ...content, cards: u });
                  }} placeholder="Пример (необязательно)..." className="col-span-2 bg-white/3 rounded-lg px-2.5 py-1.5 text-xs text-white/60 placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15" />
                </div>
                <button onClick={() => onChange({ ...content, cards: (content?.cards || []).filter((_: any, j: number) => j !== i) })}
                  className="opacity-0 group-hover/card:opacity-100 text-white/20 hover:text-red-400 transition-all self-center">
                  <X size={14} />
                </button>
              </div>
            ))}
            {(!content?.cards || content.cards.length === 0) && (
              <div className="text-center py-5 text-white/20 text-sm">
                Добавьте карточки или привяжите колоду сверху
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TestBlockEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const questions: any[] = content?.questions || [];
  const settings = content?.settings || { passingScore: 70, pointsPerQuestion: 1, allowRetry: true };
  const [openQ, setOpenQ] = useState<number | null>(0);
  const [showSettings, setShowSettings] = useState(false);

  const updateSettings = (patch: any) => {
    onChange({ ...content, settings: { ...settings, ...patch } });
  };

  const addQuestion = (type: string) => {
    const base: any = {
      id: Math.random().toString(36).slice(2),
      type,
      question: "",
      options: (type === "single_choice" || type === "multiple_choice") ? ["", "", "", ""] : [],
      correctAnswer: type === "multiple_choice" ? [] : "",
      pairs: type === "match" ? [{ left: "", right: "" }] : undefined,
      items: type === "order" ? ["", "", ""] : undefined,
    };
    onChange({ ...content, questions: [...questions, base] });
    setOpenQ(questions.length);
  };

  const updateQ = (i: number, data: any) => {
    const u = [...questions]; u[i] = { ...u[i], ...data };
    onChange({ ...content, questions: u });
  };

  return (
    <div className="space-y-3">
      {/* Settings panel */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <button
          onClick={() => setShowSettings(v => !v)}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/3 hover:bg-white/5 transition-colors text-left"
        >
          <Settings2 size={13} className="text-white/40" />
          <span className="text-xs text-white/50 font-medium flex-1">Настройки теста</span>
          <div className="flex items-center gap-2 text-[10px] text-white/25">
            {settings.timeLimitMinutes && <span className="flex items-center gap-1"><Clock size={10} />{settings.timeLimitMinutes} мин</span>}
            <span className="flex items-center gap-1"><Target size={10} />{settings.passingScore || 70}%</span>
          </div>
          {showSettings ? <ChevronUp size={13} className="text-white/25" /> : <ChevronDown size={13} className="text-white/25" />}
        </button>
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="p-3 border-t border-white/5 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider flex items-center gap-1">
                    <Clock size={9} />Время (мин)
                  </label>
                  <input type="number" min="0"
                    value={settings.timeLimitMinutes || ""}
                    onChange={e => updateSettings({ timeLimitMinutes: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Без ограничений"
                    className="w-full h-8 px-2.5 rounded-lg bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider flex items-center gap-1">
                    <Target size={9} />Проходной балл %
                  </label>
                  <input type="number" min="0" max="100"
                    value={settings.passingScore ?? 70}
                    onChange={e => updateSettings({ passingScore: Number(e.target.value) })}
                    className="w-full h-8 px-2.5 rounded-lg bg-white/5 border border-white/8 text-sm text-white focus:outline-none focus:border-white/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider flex items-center gap-1">
                    <RefreshCw size={9} />Макс. попыток
                  </label>
                  <input type="number" min="1"
                    value={settings.maxAttempts || ""}
                    onChange={e => updateSettings({ maxAttempts: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Не ограничено"
                    className="w-full h-8 px-2.5 rounded-lg bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider">Баллов за вопрос</label>
                  <input type="number" min="1"
                    value={settings.pointsPerQuestion ?? 1}
                    onChange={e => updateSettings({ pointsPerQuestion: Number(e.target.value) })}
                    className="w-full h-8 px-2.5 rounded-lg bg-white/5 border border-white/8 text-sm text-white focus:outline-none focus:border-white/20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => updateSettings({ allowRetry: !settings.allowRetry })}
                      className={cn("w-8 h-4 rounded-full transition-colors relative cursor-pointer",
                        settings.allowRetry !== false ? "bg-primary" : "bg-white/15")}
                    >
                      <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
                        settings.allowRetry !== false ? "translate-x-4" : "translate-x-0.5")} />
                    </div>
                    <span className="text-xs text-white/50">Разрешить исправлять ответы в попытке</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add question buttons */}
      <div className="flex flex-wrap gap-1.5">
        {QUESTION_TYPES.map(qt => (
          <button key={qt.value} onClick={() => addQuestion(qt.value)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/8 text-xs text-white/55 hover:text-white hover:bg-white/10 transition-colors">
            <span className="font-mono text-[11px]">{qt.icon}</span>
            <span>{qt.label}</span>
          </button>
        ))}
      </div>

      {/* Questions */}
      <div className="space-y-2">
        {questions.map((q: any, i: number) => {
          const qType = QUESTION_TYPES.find(t => t.value === q.type);
          return (
            <div key={q.id || i} className="rounded-xl border border-white/8 overflow-hidden">
              <button
                onClick={() => setOpenQ(openQ === i ? null : i)}
                className="w-full flex items-center gap-3 px-3 py-3 bg-white/3 hover:bg-white/5 transition-colors text-left"
              >
                <span className="font-mono text-[13px] text-white/30 w-5 text-center flex-shrink-0">{qType?.icon || "?"}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/8 text-white/40 font-medium shrink-0 hidden sm:block">
                  {qType?.label || q.type}
                </span>
                <span className="text-sm text-white/70 flex-1 truncate">
                  {q.question || "Новый вопрос"}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); onChange({ ...content, questions: questions.filter((_: any, j: number) => j !== i) }); }}
                    className="p-1 rounded text-white/20 hover:text-red-400 transition-colors hover:bg-red-500/10">
                    <X size={12} />
                  </button>
                  {openQ === i ? <ChevronUp size={13} className="text-white/25" /> : <ChevronDown size={13} className="text-white/25" />}
                </div>
              </button>

              <AnimatePresence>
                {openQ === i && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="p-4 space-y-3 border-t border-white/5">
                      <textarea
                        value={q.question || ""}
                        onChange={e => updateQ(i, { question: e.target.value })}
                        placeholder="Текст вопроса..."
                        rows={2}
                        className="w-full bg-white/3 rounded-xl p-3 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none border border-white/5 focus:border-white/15"
                      />

                      {/* Single / Multiple choice */}
                      {(q.type === "single_choice" || q.type === "multiple_choice") && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-white/35 uppercase tracking-wider">
                              {q.type === "multiple_choice" ? "Несколько правильных" : "Один правильный"}
                            </label>
                            <button onClick={() => updateQ(i, { options: [...(q.options || []), ""] })}
                              className="text-xs text-primary/70 hover:text-primary">+ вариант</button>
                          </div>
                          {(q.options || []).map((opt: string, oi: number) => {
                            const isCorrect = q.type === "multiple_choice"
                              ? (q.correctAnswer || []).includes(opt)
                              : q.correctAnswer === opt;
                            return (
                              <div key={oi} className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    if (q.type === "multiple_choice") {
                                      const ca = Array.isArray(q.correctAnswer) ? [...q.correctAnswer] : [];
                                      updateQ(i, { correctAnswer: isCorrect ? ca.filter((x: string) => x !== opt) : [...ca, opt] });
                                    } else {
                                      updateQ(i, { correctAnswer: opt });
                                    }
                                  }}
                                  className={cn(
                                    "flex-shrink-0 border-2 flex items-center justify-center transition-colors",
                                    q.type === "multiple_choice" ? "w-5 h-5 rounded" : "w-5 h-5 rounded-full",
                                    isCorrect ? "bg-emerald-500 border-emerald-500" : "border-white/20 hover:border-white/40"
                                  )}
                                >
                                  {isCorrect && <Check size={10} className="text-white" />}
                                </button>
                                <input value={opt}
                                  onChange={e => {
                                    const opts = [...(q.options || [])]; opts[oi] = e.target.value;
                                    const ca = q.type === "multiple_choice"
                                      ? (q.correctAnswer || []).map((x: string) => x === opt ? e.target.value : x)
                                      : q.correctAnswer === opt ? e.target.value : q.correctAnswer;
                                    updateQ(i, { options: opts, correctAnswer: ca });
                                  }}
                                  placeholder={`Вариант ${oi + 1}`}
                                  className="flex-1 bg-white/5 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15"
                                />
                                {(q.options || []).length > 2 && (
                                  <button onClick={() => {
                                    const opts = (q.options || []).filter((_: string, oj: number) => oj !== oi);
                                    const ca = q.type === "multiple_choice"
                                      ? (q.correctAnswer || []).filter((x: string) => x !== opt)
                                      : q.correctAnswer === opt ? "" : q.correctAnswer;
                                    updateQ(i, { options: opts, correctAnswer: ca });
                                  }} className="text-white/20 hover:text-red-400 transition-colors"><X size={12} /></button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Fill blank / text input */}
                      {(q.type === "fill_blank" || q.type === "text_input") && (
                        <div>
                          <label className="text-xs text-white/35 uppercase tracking-wider mb-1.5 block">Правильный ответ</label>
                          <input value={q.correctAnswer || ""}
                            onChange={e => updateQ(i, { correctAnswer: e.target.value })}
                            placeholder="Введите правильный ответ..."
                            className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15"
                          />
                        </div>
                      )}

                      {/* Match */}
                      {q.type === "match" && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-white/35 uppercase tracking-wider">Пары (левое → правое)</label>
                            <button onClick={() => updateQ(i, { pairs: [...(q.pairs || []), { left: "", right: "" }] })}
                              className="text-xs text-primary/70 hover:text-primary">+ пара</button>
                          </div>
                          {(q.pairs || []).map((pair: any, pi: number) => (
                            <div key={pi} className="flex items-center gap-2 mb-2">
                              <input value={pair.left || ""} onChange={e => {
                                const pairs = [...(q.pairs || [])]; pairs[pi] = { ...pairs[pi], left: e.target.value };
                                updateQ(i, { pairs });
                              }} placeholder="Левое..." className="flex-1 bg-white/5 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5" />
                              <span className="text-white/20 text-sm">→</span>
                              <input value={pair.right || ""} onChange={e => {
                                const pairs = [...(q.pairs || [])]; pairs[pi] = { ...pairs[pi], right: e.target.value };
                                updateQ(i, { pairs });
                              }} placeholder="Правое..." className="flex-1 bg-white/5 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5" />
                              <button onClick={() => updateQ(i, { pairs: (q.pairs || []).filter((_: any, pj: number) => pj !== pi) })}
                                className="text-white/20 hover:text-red-400 transition-colors"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Order question */}
                      {q.type === "order" && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-white/35 uppercase tracking-wider flex items-center gap-1">
                              <MoveVertical size={10} />Элементы в правильном порядке
                            </label>
                            <button onClick={() => updateQ(i, { items: [...(q.items || []), ""] })}
                              className="text-xs text-primary/70 hover:text-primary">+ элемент</button>
                          </div>
                          <div className="text-[10px] text-white/25 mb-2">
                            Расположите в том порядке, который будет считаться правильным
                          </div>
                          {(q.items || []).map((item: string, ii: number) => (
                            <div key={ii} className="flex items-center gap-2 mb-2">
                              <span className="w-5 h-5 rounded bg-white/8 text-white/30 text-[11px] flex items-center justify-center flex-shrink-0 font-mono">
                                {ii + 1}
                              </span>
                              <input value={item}
                                onChange={e => {
                                  const items = [...(q.items || [])]; items[ii] = e.target.value;
                                  updateQ(i, { items });
                                }}
                                placeholder={`Элемент ${ii + 1}...`}
                                className="flex-1 bg-white/5 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-white/15"
                              />
                              <div className="flex flex-col gap-0.5">
                                <button onClick={() => {
                                  if (ii === 0) return;
                                  const items = [...(q.items || [])];
                                  [items[ii - 1], items[ii]] = [items[ii], items[ii - 1]];
                                  updateQ(i, { items });
                                }} disabled={ii === 0} className="text-white/15 hover:text-white/60 disabled:opacity-20">▲</button>
                                <button onClick={() => {
                                  if (ii >= (q.items || []).length - 1) return;
                                  const items = [...(q.items || [])];
                                  [items[ii], items[ii + 1]] = [items[ii + 1], items[ii]];
                                  updateQ(i, { items });
                                }} disabled={ii >= (q.items || []).length - 1} className="text-white/15 hover:text-white/60 disabled:opacity-20">▼</button>
                              </div>
                              {(q.items || []).length > 2 && (
                                <button onClick={() => updateQ(i, { items: (q.items || []).filter((_: string, ij: number) => ij !== ii) })}
                                  className="text-white/20 hover:text-red-400 transition-colors"><X size={12} /></button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <input value={q.explanation || ""}
                        onChange={e => updateQ(i, { explanation: e.target.value })}
                        placeholder="Пояснение к ответу (показывается после проверки)..."
                        className="w-full bg-white/3 rounded-lg px-3 py-2 text-xs text-white/50 placeholder:text-white/20 focus:outline-none border border-white/5"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {questions.length === 0 && (
          <div className="text-center py-8 text-white/20 text-sm border border-dashed border-white/8 rounded-xl">
            Нажмите тип вопроса выше чтобы добавить
          </div>
        )}
      </div>

      <div className="text-[10px] text-white/20 text-center pt-1">
        {questions.length} вопрос{questions.length === 1 ? "" : questions.length < 5 ? "а" : "ов"} · настройки теста хранятся вместе с блоком
      </div>
    </div>
  );
}

function FileBlockEditor({
  content,
  onChange,
  groupId,
  courseId,
  blockId,
}: {
  content: any;
  onChange: (c: any) => void;
  groupId: string;
  courseId: string;
  blockId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await socialApi.uploadMedia(file);
      if (result?.url) onChange({ ...content, url: result.url, name: file.name, size: file.size });
    } catch { toast.error("Ошибка загрузки файла"); }
    finally { setUploading(false); if (e.target) e.target.value = ""; }
  };

  if (content?.url) {
    const sizeKb = Math.round((content.size || 0) / 1024);
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Paperclip size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{content.name || "Файл"}</div>
          {sizeKb > 0 && <div className="text-xs text-white/40">{sizeKb} КБ</div>}
        </div>
        <a href={content.url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-primary hover:underline">Открыть</a>
        <button onClick={() => onChange({ ...content, url: "", name: "", size: 0 })}
          className="text-white/20 hover:text-red-400 transition-colors"><X size={14} /></button>
      </div>
    );
  }

  return (
    <div>
      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      <div
        className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-white/20 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleUpload({ target: { files: [file] } } as any);
        }}
      >
        {uploading
          ? <Loader2 size={20} className="mx-auto animate-spin text-white/30" />
          : <>
              <Paperclip size={20} className="mx-auto text-white/20 mb-1.5" />
              <p className="text-sm text-white/40">Перетащите файл или нажмите для загрузки</p>
            </>
        }
      </div>
      <div className="mt-2">
        <input type="text" value={content?.url || ""} onChange={e => onChange({ ...content, url: e.target.value })}
          placeholder="Или введите URL файла..."
          className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30" />
      </div>
    </div>
  );
}

// ─── Block content renderer ───────────────────────────────────────────────────

function BlockContent({
  block,
  onChange,
  groupId,
  courseId,
}: {
  block: Block;
  onChange: (content: any) => void;
  groupId: string;
  courseId: string;
}) {
  const props = { content: block.content, onChange, groupId, courseId, blockId: block.id };

  switch (block.type) {
    case "text":    return <TextBlockEditor {...props} />;
    case "heading": return <HeadingBlockEditor content={block.content} onChange={onChange} />;
    case "image":   return <ImageBlockEditor {...props} />;
    case "video":   return <VideoBlockEditor content={block.content} onChange={onChange} />;
    case "code":    return <CodeBlockEditor content={block.content} onChange={onChange} />;
    case "quote":   return <QuoteBlockEditor content={block.content} onChange={onChange} />;
    case "divider": return <div className="border-t border-white/10 my-4" />;
    case "grammar": return <GrammarBlockEditor content={block.content} onChange={onChange} />;
    case "cards":   return <CardsBlockEditor content={block.content} onChange={onChange} />;
    case "test":    return <TestBlockEditor content={block.content} onChange={onChange} />;
    case "file":    return <FileBlockEditor {...props} />;
    default:        return <div className="text-white/30 text-sm">Неизвестный тип блока</div>;
  }
}

// ─── Sortable block wrapper ───────────────────────────────────────────────────

function SortableBlock({
  block,
  onDelete,
  onInsertAfter,
  onChange,
  onTitleChange,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  groupId,
  courseId,
  isFirst,
  isLast,
}: {
  block: Block;
  onDelete: () => void;
  onInsertAfter: (type: string) => void;
  onChange: (content: any) => void;
  onTitleChange: (title: string) => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  groupId: string;
  courseId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [showInsert, setShowInsert] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { menu: ctxMenu, open: openCtxMenu, close: closeCtxMenu } = useContextMenu();

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  const meta = BLOCK_TYPES.find(b => b.type === block.type);
  const Icon = meta?.icon ?? AlignLeft;

  const handleContextMenu = (e: ReactMouseEvent) => {
    openCtxMenu(e, [
      { label: "Дублировать блок", icon: Copy, action: onDuplicate },
      { label: "Переместить вверх", icon: ChevronUp, action: onMoveUp },
      { label: "Переместить вниз", icon: ChevronDown, action: onMoveDown },
      { label: "Удалить блок", icon: Trash2, action: onDelete, danger: true, divider: true },
    ]);
  };

  return (
    <>
    <ContextMenuPortal menu={ctxMenu} onClose={closeCtxMenu} />
    <div ref={setNodeRef} style={style} className="group/block relative" onContextMenu={handleContextMenu}>
      <div className={cn(
        "flex gap-3 rounded-2xl transition-all",
        isDragging ? "opacity-30" : ""
      )}>
        {/* Left: drag handle + block icon */}
        <div className="flex flex-col items-center gap-1 pt-3 flex-shrink-0 w-8">
          <button
            {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing text-white/10 hover:text-white/40 transition-colors opacity-0 group-hover/block:opacity-100"
          >
            <GripVertical size={16} />
          </button>
          <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity">
            <Icon size={11} className="text-white/40" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-3 border-b border-white/5 group-hover/block:border-white/8 transition-colors">
          {/* Title (optional, editable) */}
          {block.type !== "divider" && (
            <input
              value={block.title || ""}
              onChange={e => onTitleChange(e.target.value)}
              placeholder={meta?.label ? `${meta.label}...` : "Без названия"}
              className="w-full bg-transparent text-xs font-semibold text-white/40 placeholder:text-white/15 focus:outline-none mb-2 uppercase tracking-wider focus:text-white/60 transition-colors"
            />
          )}

          <BlockContent block={block} onChange={onChange} groupId={groupId} courseId={courseId} />
        </div>

        {/* Right: delete */}
        <div className="flex flex-col items-center pt-3 w-8 flex-shrink-0 opacity-0 group-hover/block:opacity-100 transition-opacity">
          <button
            onClick={onDelete}
            className="p-1 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Insert block below */}
      <div
        className="relative h-6 flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity"
        onMouseEnter={() => setShowInsert(true)}
        onMouseLeave={() => { if (!showMenu) setShowInsert(false); }}
      >
        {showInsert && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 text-xs transition-colors border border-white/8"
            >
              <Plus size={11} />
              <span>Добавить блок</span>
            </button>
            <AnimatePresence>
              {showMenu && (
                <SlashMenu
                  query=""
                  onSelect={type => { onInsertAfter(type); setShowMenu(false); setShowInsert(false); }}
                  onClose={() => { setShowMenu(false); setShowInsert(false); }}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// ─── AI Generate Modal ────────────────────────────────────────────────────────

function AIGenerateModal({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (topic: string, count: number) => Promise<void>;
}) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    await onGenerate(topic, count);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "rgba(16,16,28,0.97)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            AI генерация блоков
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Тема</label>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Например: Present Perfect в английском..."
            className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Количество блоков: {count}</label>
          <input type="range" min={1} max={8} value={count} onChange={e => setCount(+e.target.value)}
            className="w-full accent-indigo-500" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Отмена
          </button>
          <button
            onClick={handle}
            disabled={!topic.trim() || loading}
            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Сгенерировать
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CourseEditPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const courseData = await socialApi.getCourse(groupId, courseId);
        const c = courseData.course || courseData;
        const b = courseData.blocks || [];
        setCourse(c);
        setBlocks(b.sort((a: Block, b: Block) => a.orderIndex - b.orderIndex));
      } catch {
        toast.error("Ошибка загрузки курса");
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, courseId]);

  // Save block changes (debounced)
  const saveBlock = useCallback(async (block: Block) => {
    try {
      await socialApi.updateBlock(groupId, courseId, block.id, {
        title: block.title,
        content: block.content,
      });
    } catch { /* silently fail, user can retry */ }
  }, [groupId, courseId]);

  const handleBlockChange = useCallback((blockId: string, content: any) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
    setPendingChanges(prev => ({ ...prev, [blockId]: true }));
  }, []);

  const handleTitleChange = useCallback((blockId: string, title: string) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, title } : b));
    setPendingChanges(prev => ({ ...prev, [blockId]: true }));
  }, []);

  // Save all pending block changes
  const saveAll = async () => {
    setSaving(true);
    try {
      const pendingIds = Object.keys(pendingChanges);
      // For test blocks: auto-create/update EnglishCourseTests record, store testId in content
      const updatedBlocks = await Promise.all(blocks.map(async b => {
        if (b.type === "test" && pendingIds.includes(b.id)) {
          const q = b.content?.questions || [];
          const testTitle = b.title || "Тест";
          try {
            const s = b.content?.settings || {};
            const testPayload = {
              title: testTitle,
              description: b.content?.description || "",
              questions: q,
              passingScore: s.passingScore ?? 70,
              pointsPerQuestion: s.pointsPerQuestion ?? 1,
              allowRetry: s.allowRetry !== false,
              timeLimitSeconds: s.timeLimitMinutes ? s.timeLimitMinutes * 60 : null,
              maxAttempts: s.maxAttempts || null,
            };
            if (b.content?.testId) {
              // Update existing test
              await socialApi.updateTest(groupId, courseId, b.content.testId, testPayload);
              return b;
            } else {
              // Create new test
              const newTest = await socialApi.createTest(groupId, courseId, {
                ...testPayload,
                blockId: b.id,
              });
              const updatedContent = { ...b.content, testId: newTest.id };
              return { ...b, content: updatedContent };
            }
          } catch { return b; }
        }
        return b;
      }));
      setBlocks(updatedBlocks);

      await Promise.all(
        updatedBlocks
          .filter(b => pendingIds.includes(b.id))
          .map(b => socialApi.updateBlock(groupId, courseId, b.id, {
            title: b.title,
            content: b.content,
          }))
      );
      if (course) {
        await socialApi.updateCourse(groupId, courseId, {
          title: course.title,
          description: course.description,
          emoji: course.emoji,
          color: course.color,
          level: course.level,
          isPublished: course.isPublished,
          estimatedMinutes: course.estimatedMinutes,
        });
      }
      await socialApi.reorderBlocks(groupId, courseId, updatedBlocks.map((b, i) => ({ id: b.id, orderIndex: i })));
      setPendingChanges({});
      toast.success("Сохранено");
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = useCallback(async (type: string, afterIndex = -1) => {
    try {
      const content = defaultContent(type);
      const newBlock = await socialApi.addBlock(groupId, courseId, {
        type,
        title: null,
        content,
        orderIndex: afterIndex >= 0 ? afterIndex + 1 : blocks.length,
      });
      if (afterIndex >= 0) {
        setBlocks(prev => [
          ...prev.slice(0, afterIndex + 1),
          newBlock,
          ...prev.slice(afterIndex + 1),
        ]);
      } else {
        setBlocks(prev => [...prev, newBlock]);
      }
    } catch {
      toast.error("Не удалось добавить блок");
    }
  }, [groupId, courseId, blocks.length]);

  const deleteBlock = useCallback(async (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    try {
      await socialApi.deleteBlock(groupId, courseId, blockId);
    } catch {
      toast.error("Ошибка удаления");
    }
  }, [groupId, courseId]);

  const handleDuplicate = useCallback(async (blockId: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === blockId);
      if (idx === -1) return prev;
      const original = prev[idx];
      const copy: Block = {
        ...original,
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        orderIndex: original.orderIndex + 1,
        content: JSON.parse(JSON.stringify(original.content)),
      };
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      // schedule API creation after state settles
      setTimeout(async () => {
        try {
          const newBlock = await socialApi.addBlock(groupId, courseId, {
            type: copy.type,
            title: copy.title,
            content: copy.content,
            orderIndex: idx + 1,
          });
          setBlocks(current => current.map(b => b.id === copy.id ? { ...newBlock } : b));
          setPendingChanges(p => ({ ...p, _order: true }));
        } catch { toast.error("Ошибка дублирования"); }
      }, 0);
      return next;
    });
  }, [groupId, courseId]);

  const handleMoveUp = useCallback((blockId: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === blockId);
      if (idx <= 0) return prev;
      return arrayMove(prev, idx, idx - 1);
    });
    setPendingChanges(p => ({ ...p, _order: true }));
  }, []);

  const handleMoveDown = useCallback((blockId: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === blockId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      return arrayMove(prev, idx, idx + 1);
    });
    setPendingChanges(p => ({ ...p, _order: true }));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks(prev => {
        const oldIdx = prev.findIndex(b => b.id === active.id);
        const newIdx = prev.findIndex(b => b.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
      setPendingChanges(prev => ({ ...prev, _order: true }));
    }
  }, []);

  const handleAIGenerate = async (topic: string, count: number) => {
    try {
      const result = await socialApi.aiGenerateBlocks(groupId, courseId, { topic, blockCount: count });
      if (result.blocks) {
        setBlocks(prev => [...prev, ...result.blocks]);
        toast.success(`Сгенерировано ${result.blocks.length} блоков`);
      }
    } catch {
      toast.error("Ошибка AI генерации");
    }
  };

  const togglePublished = async () => {
    if (!course) return;
    const newVal = !course.isPublished;
    setCourse({ ...course, isPublished: newVal });
    try {
      await socialApi.updateCourse(groupId, courseId, { isPublished: newVal });
      toast.success(newVal ? "Курс опубликован" : "Курс скрыт");
    } catch {
      setCourse({ ...course, isPublished: !newVal });
      toast.error("Ошибка");
    }
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 h-14 border-b"
        style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/groups/${groupId}/courses/${courseId}`)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            Назад
          </button>
          <div className="h-4 w-px bg-border" />
          {course && (
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setShowEmojiPicker(v => !v)} className="hover:scale-110 transition-transform">
                {course.emoji}
              </button>
              <input
                value={course.title}
                onChange={e => setCourse({ ...course, title: e.target.value })}
                onBlur={() => setPendingChanges(prev => ({ ...prev, _course: true }))}
                className="bg-transparent font-semibold text-sm focus:outline-none max-w-[200px] text-foreground"
              />
            </div>
          )}
          {hasPendingChanges && (
            <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              Несохранённые изменения
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Published toggle */}
          <button
            onClick={togglePublished}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border",
              course?.isPublished
                ? "bg-green-500/10 border-green-500/20 text-green-400"
                : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
            )}
          >
            {course?.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
            {course?.isPublished ? "Опубликован" : "Скрыт"}
          </button>

          <button
            onClick={() => setShowSettings(v => !v)}
            className={cn(
              "p-2 rounded-xl transition-colors border",
              showSettings
                ? "bg-white/10 border-white/15 text-white"
                : "bg-white/5 border-white/8 text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings2 size={14} />
          </button>

          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 border border-violet-500/20 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors"
          >
            <Sparkles size={13} />
            AI
          </button>

          <button
            onClick={saveAll}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Сохранить
          </button>
        </div>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && course && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-14 z-20 px-4 md:px-6 py-4 border-b"
            style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
          >
            <div className="max-w-2xl grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                <input
                  value={course.description || ""}
                  onChange={e => { setCourse({ ...course, description: e.target.value }); setPendingChanges(p => ({ ...p, _course: true })); }}
                  placeholder="Краткое описание курса..."
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Уровень</label>
                <select
                  value={course.level}
                  onChange={e => { setCourse({ ...course, level: e.target.value }); setPendingChanges(p => ({ ...p, _course: true })); }}
                  className="w-full h-9 px-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                >
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Время (мин)</label>
                <input
                  type="number"
                  value={course.estimatedMinutes}
                  onChange={e => { setCourse({ ...course, estimatedMinutes: +e.target.value }); setPendingChanges(p => ({ ...p, _course: true })); }}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-16 left-4 z-50 p-3 rounded-2xl border shadow-2xl"
            style={{ background: "rgba(16,16,28,0.97)", borderColor: "rgba(255,255,255,0.1)" }}
          >
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { if (course) { setCourse({ ...course, emoji }); setPendingChanges(p => ({ ...p, _course: true })); } setShowEmojiPicker(false); }}
                  className="w-8 h-8 text-lg flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main editor area */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        {/* Course title hero */}
        {course && (
          <div className="mb-8">
            <div className="text-5xl mb-4">{course.emoji}</div>
            <input
              value={course.title}
              onChange={e => { setCourse({ ...course, title: e.target.value }); setPendingChanges(p => ({ ...p, _course: true })); }}
              placeholder="Название курса..."
              className="w-full bg-transparent text-3xl md:text-4xl font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
            />
            {course.description && (
              <p className="mt-2 text-muted-foreground text-base">{course.description}</p>
            )}
          </div>
        )}

        {/* Blocks */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {blocks.map((block, idx) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  onDelete={() => deleteBlock(block.id)}
                  onInsertAfter={type => addBlock(type, idx)}
                  onChange={content => handleBlockChange(block.id, content)}
                  onTitleChange={title => handleTitleChange(block.id, title)}
                  onDuplicate={() => handleDuplicate(block.id)}
                  onMoveUp={() => handleMoveUp(block.id)}
                  onMoveDown={() => handleMoveDown(block.id)}
                  groupId={groupId}
                  courseId={courseId}
                  isFirst={idx === 0}
                  isLast={idx === blocks.length - 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add first block / add block at end */}
        <div className="mt-8">
          <AddBlockButton onAdd={type => addBlock(type)} />
        </div>

        {blocks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Plus size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium mb-1">Начните добавлять контент</p>
            <p className="text-sm opacity-60">Нажмите кнопку выше или перетащите файл</p>
          </div>
        )}
      </div>

      {/* AI Modal */}
      <AnimatePresence>
        {showAI && (
          <AIGenerateModal onClose={() => setShowAI(false)} onGenerate={handleAIGenerate} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Add block button ─────────────────────────────────────────────────────────

function AddBlockButton({ onAdd }: { onAdd: (type: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setShowMenu(v => !v)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors text-sm"
      >
        <Plus size={15} />
        Добавить блок
      </button>
      <AnimatePresence>
        {showMenu && (
          <SlashMenu
            query=""
            onSelect={type => { onAdd(type); setShowMenu(false); }}
            onClose={() => setShowMenu(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
