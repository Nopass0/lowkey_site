"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Wand2,
  Grid,
  List,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Volume2,
  Loader2,
  Copy,
  Upload,
  Image as ImageIcon,
  MoreHorizontal,
  ChevronLeft,
  Layers,
  ArrowRight,
  BookOpen,
  Zap,
  RotateCcw,
  Play,
  Brain,
  Trophy,
  Shuffle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCardsStore } from "@/store/cards";
import { aiApi, cardsApi } from "@/api/client";
import { getCardStatusLabel, getNextReviewText, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Card, Deck } from "@/store/cards";
import { speakEnglishText } from "@/lib/tts";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "new" | "learning" | "review" | "mastered";
type SortMode = "newest" | "oldest" | "alphabetical" | "next-review";

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuItem {
  label: string;
  icon: React.ElementType;
  action: () => void;
  danger?: boolean;
  submenu?: ContextMenuItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  learning: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  review: "bg-violet-500/15 text-violet-400 border border-violet-500/20",
  mastered: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
};

const EMOJI_LIST = [
  "📚","🎯","🧠","💡","🌍","🗣️","✍️","📖","🔥","⭐",
  "🎓","🌱","🏆","💬","🎧","📝","🔤","🌐","🎨","🚀",
];
const COLOR_LIST = [
  "#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316",
  "#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6",
];

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? "#000" : "#fff";
}

function positionNearElement(
  el: HTMLElement,
  menuW = 200,
  menuH = 250
): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = rect.right + 4;
  let y = rect.top;
  if (x + menuW > vw) x = rect.left - menuW - 4;
  if (y + menuH > vh) y = Math.max(8, vh - menuH - 8);
  x = Math.max(8, x);
  return { x, y };
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [submenuIndex, setSubmenuIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!state.visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [state.visible, onClose]);

  if (!state.visible) return null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.93, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.93, y: -4 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[9999] min-w-[180px] rounded-xl shadow-2xl shadow-black/50 py-1"
      style={{ top: state.y, left: state.x, background: "rgba(13,13,22,0.96)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((item, i) => {
        const Icon = item.icon;
        const hasSub = item.submenu && item.submenu.length > 0;
        return (
          <div key={i} className="relative">
            <div
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer select-none transition-colors",
                item.danger
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-neutral-200 hover:bg-white/[0.06]",
                hasSub && "pr-6"
              )}
              onMouseEnter={() => setSubmenuIndex(hasSub ? i : null)}
              onMouseLeave={() => !hasSub && setSubmenuIndex(null)}
              onClick={() => {
                if (!hasSub) {
                  item.action();
                  onClose();
                }
              }}
            >
              <Icon size={13} className="shrink-0 opacity-70" />
              <span className="flex-1">{item.label}</span>
              {hasSub && <ChevronRight size={12} className="absolute right-2 opacity-50" />}
            </div>
            {hasSub && submenuIndex === i && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute left-full top-0 ml-1 min-w-[160px] rounded-xl border border-white/10 shadow-2xl shadow-black/50 py-1 z-[10000]"
              >
                {item.submenu!.map((sub, j) => {
                  const SubIcon = sub.icon;
                  return (
                    <div
                      key={j}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-200 hover:bg-white/[0.06] cursor-pointer select-none transition-colors"
                      onClick={() => {
                        sub.action();
                        onClose();
                      }}
                    >
                      <SubIcon size={13} className="shrink-0 opacity-70" />
                      <span>{sub.label}</span>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>
        );
      })}
    </motion.div>
  );
}

// ─── New Deck Modal ───────────────────────────────────────────────────────────

function NewDeckModal({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void;
  onSave: (data: { name: string; emoji: string; color: string; description: string }) => Promise<void>;
  initial?: { name: string; emoji: string; color: string; description: string };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "📚");
  const [color, setColor] = useState(initial?.color ?? COLOR_LIST[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl" style={{ background: "rgba(13,13,22,0.97)" }}
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">
            {initial ? "Edit deck" : "New deck"}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-5"
          style={{ background: color + "22", borderLeft: `3px solid ${color}` }}
        >
          <span className="text-3xl">{emoji}</span>
          <div>
            <div className="font-semibold text-white">{name || "Deck name"}</div>
            {description && <div className="text-xs text-neutral-400 mt-0.5">{description}</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My vocabulary deck"
              className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-2 block">Emoji</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_LIST.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all",
                    emoji === e ? "bg-white/20 scale-110" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-2 block">Color</label>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_LIST.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    color === c && "ring-2 ring-white ring-offset-2 ring-offset-neutral-900 scale-110"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-neutral-400 hover:text-white">
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!name.trim()) { toast.error("Name is required"); return; }
              setSaving(true);
              try { await onSave({ name: name.trim(), emoji, color, description }); onClose(); }
              catch { /* toast in parent */ }
              finally { setSaving(false); }
            }}
            disabled={saving || !name.trim()}
            className="flex-1"
            style={{ background: color, color: getContrastColor(color) }}
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            {initial ? "Save changes" : "Create deck"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Card Editor Modal ────────────────────────────────────────────────────────

function CardEditorModal({
  card,
  decks,
  defaultDeckId,
  onClose,
  onSave,
}: {
  card?: Card;
  decks: Deck[];
  defaultDeckId?: string;
  onClose: () => void;
  onSave: (data: any) => Promise<Card | void>;
}) {
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [pronunciation, setPronunciation] = useState(card?.pronunciation ?? "");
  const [example, setExample] = useState(card?.examples?.[0] ?? "");
  const [deckId, setDeckId] = useState(card?.deckId ?? defaultDeckId ?? "");
  const [imageUrl, setImageUrl] = useState(card?.imageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState<"front" | "back" | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const handleAiGenerate = async () => {
    if (!front.trim()) { toast.error("Enter the front word first"); return; }
    setAiLoading(true);
    try {
      const res = await aiApi.generateCard({ word: front });
      if (res.back) setBack(res.back);
      if (res.pronunciation) setPronunciation(res.pronunciation);
      if (res.examples?.[0]) setExample(res.examples[0]);
      toast.success("Card generated");
    } catch { toast.error("AI generation failed"); }
    finally { setAiLoading(false); }
  };

  const handleAiImage = async () => {
    if (!front.trim()) { toast.error("Enter the front word first"); return; }
    setImgLoading(true);
    try {
      const res = await aiApi.generateImage({ prompt: front, kind: "vocabulary" });
      if (res.url) setImageUrl(res.url);
      toast.success("Image generated");
    } catch { toast.error("Image generation failed"); }
    finally { setImgLoading(false); }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !card) return;
    try {
      const res = await cardsApi.uploadImage(card.id, file);
      if (res.imageUrl) setImageUrl(res.imageUrl);
      toast.success("Image uploaded");
    } catch { toast.error("Upload failed"); }
  };

  const handleTts = async (text: string, side: "front" | "back") => {
    if (!text) return;
    setTtsLoading(side);
    try { await speakEnglishText(text); }
    catch { toast.error("TTS failed"); }
    finally { setTtsLoading(null); }
  };

  const handleSave = async () => {
    if (!front.trim()) { toast.error("Front is required"); return; }
    setSaving(true);
    try {
      await onSave({
        front: front.trim(),
        back: back.trim(),
        pronunciation: pronunciation.trim(),
        examples: example.trim() ? [example.trim()] : [],
        deckId: deckId || undefined,
        imageUrl: imageUrl || undefined,
      });
      onClose();
    } catch { /* toast in parent */ }
    finally { setSaving(false); }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: "rgba(13,13,22,0.97)" }}
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-lg font-semibold text-white">{card ? "Edit card" : "New card"}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Image */}
          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden h-36 bg-white/5">
              <img src={imageUrl} alt="card" className="w-full h-full object-cover" />
              <button
                onClick={() => setImageUrl("")}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Front */}
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">English (front)</label>
            <div className="flex gap-2">
              <Input
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="apple"
                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 flex-1"
                autoFocus
              />
              <button
                onClick={() => handleTts(front, "front")}
                className="px-3 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
              >
                {ttsLoading === "front" ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
              </button>
            </div>
          </div>

          {/* Back */}
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Russian (back)</label>
            <div className="flex gap-2">
              <Input
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="яблоко"
                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 flex-1"
              />
              <button
                onClick={() => handleTts(back, "back")}
                className="px-3 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
              >
                {ttsLoading === "back" ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
              </button>
            </div>
          </div>

          {/* Pronunciation */}
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Pronunciation</label>
            <Input
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
              placeholder="/ˈæpəl/"
              className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
            />
          </div>

          {/* Example */}
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Example sentence</label>
            <Input
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="I eat an apple every morning."
              className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
            />
          </div>

          {/* Deck */}
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Deck</label>
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white/20"
            >
              <option value="">No deck</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap pt-1">
            <button
              onClick={handleAiGenerate}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/20 text-violet-400 text-xs hover:bg-violet-500/25 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              AI fill card
            </button>
            <button
              onClick={handleAiImage}
              disabled={imgLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/20 text-fuchsia-400 text-xs hover:bg-fuchsia-500/25 transition-colors disabled:opacity-50"
            >
              {imgLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              AI image
            </button>
            <button
              onClick={() => imgInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-400 text-xs hover:bg-white/10 transition-colors"
            >
              <Upload size={12} />
              Upload image
            </button>
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-white/8">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-neutral-400 hover:text-white">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !front.trim()} className="flex-1">
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            {card ? "Save changes" : "Create card"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Bulk AI Modal ────────────────────────────────────────────────────────────

function BulkAIModal({
  decks,
  onClose,
  onGenerated,
}: {
  decks: Deck[];
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error("Enter a topic"); return; }
    setLoading(true);
    try {
      await aiApi.generateCardsBulk({ topic: topic.trim(), count, deckId: deckId || undefined });
      toast.success(`Generated ${count} cards!`);
      onGenerated();
      onClose();
    } catch { toast.error("Generation failed"); }
    finally { setLoading(false); }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl" style={{ background: "rgba(13,13,22,0.97)" }}
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Bulk AI generation</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Generate multiple cards from a topic or text</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Topic or text</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. kitchen vocabulary, technology words, body parts..."
              rows={3}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Number of cards</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5 block">Add to deck</label>
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                <option value="">No deck</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-neutral-400 hover:text-white">Cancel</Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-500"
          >
            {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Sparkles size={14} className="mr-2" />}
            Generate {count} cards
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Droppable Deck Item ──────────────────────────────────────────────────────

function DroppableDeck({
  deck,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onMenu,
  cards,
}: {
  deck: Deck;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onMenu: (e: React.MouseEvent, el: HTMLElement) => void;
  cards: Card[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `deck-${deck.id}` });

  return (
    <div ref={setNodeRef}>
      <div
        className={cn(
          "group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all select-none",
          isSelected
            ? "bg-white/10"
            : isOver
            ? "bg-white/[0.07] ring-1 ring-white/20"
            : "hover:bg-white/[0.05]"
        )}
        style={{ borderLeft: `3px solid ${isSelected ? deck.color : "transparent"}` }}
        onClick={onSelect}
      >
        <span className="text-lg shrink-0">{deck.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{deck.name}</div>
          <div className="text-[11px] text-neutral-500">{deck.cardCount} cards</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-white p-0.5"
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMenu(e, e.currentTarget as HTMLElement); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-white p-0.5"
        >
          <MoreHorizontal size={13} />
        </button>
      </div>

      {/* Inline expanded cards preview */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden ml-4 border-l border-white/8 pl-3 mt-1 mb-1"
          >
            {cards.slice(0, 5).map((c) => (
              <div key={c.id} className="py-1 text-xs text-neutral-400 truncate">
                {c.front} <span className="text-neutral-600">— {c.back}</span>
              </div>
            ))}
            {cards.length === 0 && (
              <div className="py-1 text-xs text-neutral-600 italic">No cards yet</div>
            )}
            {cards.length > 5 && (
              <div className="py-1 text-xs text-neutral-600">+{cards.length - 5} more</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Draggable Card (Grid) ────────────────────────────────────────────────────

function DraggableCard({
  card,
  isSelected,
  onSelect,
  onMenu,
  onEdit,
}: {
  card: Card;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onMenu: (e: React.MouseEvent, el: HTMLElement) => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { type: "card", card },
  });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative rounded-xl border cursor-pointer select-none transition-all",
        isSelected
          ? "border-blue-500/40 bg-blue-500/10"
          : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15"
      )}
      onContextMenu={(e) => { e.preventDefault(); onMenu(e, e.currentTarget as HTMLElement); }}
      onDoubleClick={onEdit}
      {...attributes}
      {...listeners}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "absolute top-2 left-2 z-10 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => { e.stopPropagation(); onSelect(e); }}
      >
        <div className={cn(
          "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
          isSelected ? "bg-blue-500 border-blue-500" : "border-white/30 bg-black/30"
        )}>
          {isSelected && <Check size={11} className="text-white" />}
        </div>
      </div>

      {/* Three-dot menu */}
      <button
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md bg-black/40 flex items-center justify-center text-neutral-300 hover:bg-black/60"
        onClick={(e) => { e.stopPropagation(); onMenu(e, e.currentTarget as HTMLElement); }}
      >
        <MoreHorizontal size={12} />
      </button>

      {/* Image */}
      {card.imageUrl && (
        <div className="w-full h-28 rounded-t-xl overflow-hidden">
          <img src={card.imageUrl} alt={card.front} className="w-full h-full object-cover" />
        </div>
      )}

      <div className={cn("p-3", card.imageUrl && "pt-2")}>
        <div className="text-sm font-semibold text-white mb-0.5 truncate">{card.front}</div>
        <div className="text-xs text-neutral-400 truncate mb-2">{card.back}</div>
        {card.pronunciation && (
          <div className="text-[11px] text-neutral-500 mb-2 font-mono">{card.pronunciation}</div>
        )}
        <div className="flex items-center justify-between">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium", STATUS_COLORS[card.status])}>
            {getCardStatusLabel(card.status)}
          </span>
          <span className="text-[10px] text-neutral-600">{getNextReviewText(card.nextReview)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Draggable Card (List row) ────────────────────────────────────────────────

function DraggableCardRow({
  card,
  isSelected,
  onSelect,
  onMenu,
  onEdit,
}: {
  card: Card;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onMenu: (e: React.MouseEvent, el: HTMLElement) => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { type: "card", card },
  });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, x: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer select-none transition-all",
        isSelected
          ? "border-blue-500/30 bg-blue-500/10"
          : "border-transparent hover:bg-white/[0.04] hover:border-white/8"
      )}
      onContextMenu={(e) => { e.preventDefault(); onMenu(e, e.currentTarget as HTMLElement); }}
      onDoubleClick={onEdit}
      {...attributes}
      {...listeners}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "shrink-0 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => { e.stopPropagation(); onSelect(e); }}
      >
        <div className={cn(
          "w-4 h-4 rounded border flex items-center justify-center",
          isSelected ? "bg-blue-500 border-blue-500" : "border-white/30"
        )}>
          {isSelected && <Check size={10} className="text-white" />}
        </div>
      </div>

      {card.imageUrl && (
        <img src={card.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
      )}

      <div className="flex-1 min-w-0 flex items-center gap-4">
        <div className="min-w-0 w-40">
          <div className="text-sm font-medium text-white truncate">{card.front}</div>
          {card.pronunciation && <div className="text-[11px] text-neutral-500 font-mono">{card.pronunciation}</div>}
        </div>
        <div className="text-sm text-neutral-400 truncate flex-1">{card.back}</div>
        {card.examples?.[0] && (
          <div className="text-xs text-neutral-600 truncate flex-1 hidden xl:block italic">
            "{card.examples[0]}"
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium", STATUS_COLORS[card.status])}>
          {getCardStatusLabel(card.status)}
        </span>
        <span className="text-[11px] text-neutral-600 w-20 text-right">{getNextReviewText(card.nextReview)}</span>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-white"
          onClick={(e) => { e.stopPropagation(); onMenu(e, e.currentTarget as HTMLElement); }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Study Setup Modal ────────────────────────────────────────────────────────

function StudySetupModal({
  decks,
  allCards,
  onStart,
  onClose,
}: {
  decks: Deck[];
  allCards: Card[];
  onStart: (cards: Card[], deckName: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"deck" | "all" | "random">("all");
  const [deckId, setDeckId] = useState(decks[0]?.id || "");
  const [randomCount, setRandomCount] = useState(20);

  const handleStart = () => {
    let study: Card[] = [];
    let name = "Все карточки";
    if (mode === "deck") {
      study = allCards.filter(c => c.deckId === deckId);
      name = decks.find(d => d.id === deckId)?.name || "Колода";
    } else if (mode === "all") {
      study = [...allCards];
    } else {
      const shuffled = [...allCards].sort(() => Math.random() - 0.5);
      study = shuffled.slice(0, Math.min(randomCount, allCards.length));
      name = `Случайные ${study.length} карточек`;
    }
    if (study.length === 0) { return; }
    onStart(study, name);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{ background: "rgba(13,13,22,0.97)" }}
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Brain size={18} className="text-violet-400" /> Режим изучения
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">Выберите, что будете учить</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {[
            { id: "all" as const, label: "Все карточки", icon: "📚", count: allCards.length },
            { id: "deck" as const, label: "Конкретная колода", icon: "🗂", count: null },
            { id: "random" as const, label: "Случайные N карточек", icon: "🎲", count: null },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                mode === opt.id
                  ? "bg-violet-500/15 border-violet-500/40 text-white"
                  : "bg-white/3 border-white/8 text-white/60 hover:bg-white/6"
              )}
            >
              <span className="text-lg">{opt.icon}</span>
              <span className="flex-1 text-sm font-medium">{opt.label}</span>
              {opt.count !== null && (
                <span className="text-xs text-white/30">{opt.count}</span>
              )}
              {mode === opt.id && <Check size={14} className="text-violet-400" />}
            </button>
          ))}
        </div>

        {mode === "deck" && decks.length > 0 && (
          <div className="mb-4">
            <select
              value={deckId}
              onChange={e => setDeckId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none"
            >
              {decks.map(d => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.name} ({allCards.filter(c => c.deckId === d.id).length} карт)
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === "random" && (
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-1.5 block">Количество карточек: {randomCount}</label>
            <input
              type="range"
              min={5}
              max={Math.max(50, allCards.length)}
              step={5}
              value={randomCount}
              onChange={e => setRandomCount(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
              <span>5</span><span>{Math.max(50, allCards.length)}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleStart}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Play size={15} />
          Начать изучение
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Study Session ────────────────────────────────────────────────────────────

function StudySession({
  cards,
  deckName,
  onClose,
}: {
  cards: Card[];
  deckName: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [surpriseQ, setSurpriseQ] = useState<{ card: Card; options: string[]; answered: string | null } | null>(null);
  const [done, setDone] = useState(false);

  const shuffled = useState(() => [...cards].sort(() => Math.random() - 0.5))[0];
  const current = shuffled[idx];
  const progress = (idx / shuffled.length) * 100;

  const SURPRISE_EVERY = 5;

  const next = (wasKnown: boolean) => {
    const newKnown = wasKnown ? [...known, current.id] : known;
    const newUnknown = !wasKnown ? [...unknown, current.id] : unknown;
    if (wasKnown) setKnown(newKnown); else setUnknown(newUnknown);

    // Surprise test check
    const seenCount = idx + 1;
    if (seenCount % SURPRISE_EVERY === 0 && seenCount < shuffled.length) {
      const seenCards = shuffled.slice(0, seenCount);
      const q = seenCards[Math.floor(Math.random() * seenCards.length)];
      const wrongPool = shuffled.filter(c => c.id !== q.id).map(c => c.back).filter(Boolean);
      const wrong = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [...wrong, q.back].sort(() => Math.random() - 0.5);
      setSurpriseQ({ card: q, options, answered: null });
      setFlipped(false);
      return;
    }

    if (idx + 1 >= shuffled.length) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
    }
  };

  const dismissSurprise = () => {
    setSurpriseQ(null);
    if (idx + 1 >= shuffled.length) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
    }
  };

  if (done) {
    const knownPct = Math.round((known.length / shuffled.length) * 100);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-5 max-w-sm w-full"
        >
          <div className="w-20 h-20 rounded-3xl bg-violet-500/20 flex items-center justify-center mx-auto">
            <Trophy size={36} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Сессия завершена!</h2>
            <p className="text-neutral-400 text-sm">{deckName}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Карточек", value: shuffled.length, color: "text-white" },
              { label: "Знаю", value: known.length, color: "text-emerald-400" },
              { label: "Учить", value: unknown.length, color: "text-amber-400" },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl bg-white/5 border border-white/8 p-3">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="text-4xl font-black text-violet-400">{knownPct}%</div>
          <div className="flex gap-3">
            <button
              onClick={() => { setIdx(0); setFlipped(false); setKnown([]); setUnknown([]); setDone(false); }}
              className="flex-1 py-3 rounded-xl bg-white/8 hover:bg-white/12 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-white/10"
            >
              <RotateCcw size={14} />Ещё раз
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Check size={14} />Завершить
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (surpriseQ) {
    const correct = surpriseQ.card.back;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm space-y-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold flex items-center gap-1">
              <Sparkles size={11} />⚡ Внезапный тест
            </div>
            <button onClick={dismissSurprise} className="ml-auto text-white/30 hover:text-white/60 text-xs">
              пропустить
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 p-5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">Переведите слово</p>
            <p className="text-xl font-bold text-white">{surpriseQ.card.front}</p>
            {surpriseQ.card.pronunciation && (
              <p className="text-xs text-white/30 mt-1 font-mono">{surpriseQ.card.pronunciation}</p>
            )}
          </div>
          <div className="space-y-2">
            {surpriseQ.options.map(opt => {
              const isAnswered = surpriseQ.answered !== null;
              const isCorrect = opt === correct;
              const isSelected = opt === surpriseQ.answered;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (isAnswered) return;
                    setSurpriseQ(q => q ? { ...q, answered: opt } : null);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl text-sm border transition-all",
                    !isAnswered && "bg-white/5 border-white/8 hover:bg-white/10 text-white/80",
                    isAnswered && isCorrect && "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
                    isAnswered && isSelected && !isCorrect && "bg-red-500/15 border-red-500/30 text-red-300",
                    isAnswered && !isSelected && !isCorrect && "border-white/5 text-white/30",
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {surpriseQ.answered !== null && (
            <button
              onClick={dismissSurprise}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
            >
              Продолжить →
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-white/8">
        <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
          <X size={20} />
        </button>
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{deckName}</div>
          <div className="text-xs text-white/30">{idx + 1} / {shuffled.length}</div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{known.length} ✓</span>
          <span className="text-amber-400">{unknown.length} ✗</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/8">
        <motion.div
          animate={{ width: `${progress}%` }}
          className="h-full bg-violet-500 transition-all"
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${current.id}-${flipped ? "back" : "front"}`}
              initial={{ opacity: 0, rotateY: flipped ? -90 : 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setFlipped(f => !f)}
              className="cursor-pointer"
            >
              <div
                className={cn(
                  "rounded-3xl p-8 text-center min-h-[240px] flex flex-col items-center justify-center border transition-all select-none",
                  flipped
                    ? "bg-indigo-500/10 border-indigo-500/25"
                    : "bg-white/4 border-white/8 hover:bg-white/6"
                )}
              >
                {current.imageUrl && !flipped && (
                  <img src={current.imageUrl} alt="" className="w-28 h-28 rounded-2xl object-cover mb-4" />
                )}
                <div className={cn("font-bold leading-tight mb-2", flipped ? "text-2xl text-indigo-200" : "text-3xl text-white")}>
                  {flipped ? current.back : current.front}
                </div>
                {!flipped && current.pronunciation && (
                  <div className="text-sm text-white/30 font-mono">{current.pronunciation}</div>
                )}
                {flipped && current.examples?.[0] && (
                  <div className="text-sm text-white/40 italic mt-3 max-w-xs">"{current.examples[0]}"</div>
                )}
                <div className="mt-4 text-xs text-white/20">
                  {flipped ? "нажмите чтобы скрыть" : "нажмите чтобы перевернуть"}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-3 mt-5">
            {!flipped ? (
              <button
                onClick={() => setFlipped(true)}
                className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={16} />Показать перевод
              </button>
            ) : (
              <>
                <button
                  onClick={() => next(false)}
                  className="flex-1 py-3 rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors"
                >
                  ✗ Не знаю
                </button>
                <button
                  onClick={() => next(true)}
                  className="flex-1 py-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-semibold transition-colors"
                >
                  ✓ Знаю
                </button>
              </>
            )}
          </div>
          <div className="text-center mt-3 text-xs text-white/15">
            Пробел — перевернуть · ← Не знаю · → Знаю
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CARDS_PER_PAGE = 20;

export default function VocabularyPage() {
  const { decks, cards, isLoading, fetchDecks, fetchCards, createDeck, updateDeck, deleteDeck, createCard, updateCard, deleteCard } = useCardsStore();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastSelectedIdx = useRef<number | null>(null);

  // Modals
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [editDeck, setEditDeck] = useState<Deck | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [showBulkAI, setShowBulkAI] = useState(false);

  // Study mode
  const [showStudySetup, setShowStudySetup] = useState(false);
  const [studyCards, setStudyCards] = useState<Card[] | null>(null);
  const [studyDeckName, setStudyDeckName] = useState("");

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, items: [] });

  // DnD
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const deckCoverInputRef = useRef<HTMLInputElement>(null);
  const deckCoverTargetId = useRef<string | null>(null);

  // Load data
  useEffect(() => {
    fetchDecks();
    fetchCards();
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [selectedDeckId, search, statusFilter, sortMode]);

  // ── Filtered & sorted cards ──────────────────────────────────────────────

  const filteredCards = cards
    .filter((c) => {
      if (selectedDeckId && c.deckId !== selectedDeckId) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.front.toLowerCase().includes(q) ||
          c.back.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortMode) {
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "alphabetical": return a.front.localeCompare(b.front);
        case "next-review": return new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime();
        default: return 0;
      }
    });

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / CARDS_PER_PAGE));
  const pagedCards = filteredCards.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE);

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = useCallback((cardId: string, e: React.MouseEvent, idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && lastSelectedIdx.current !== null) {
        const lo = Math.min(lastSelectedIdx.current, idx);
        const hi = Math.max(lastSelectedIdx.current, idx);
        for (let i = lo; i <= hi; i++) {
          if (pagedCards[i]) next.add(pagedCards[i].id);
        }
      } else {
        if (next.has(cardId)) next.delete(cardId);
        else next.add(cardId);
        lastSelectedIdx.current = idx;
      }
      return next;
    });
  }, [pagedCards]);

  const selectAll = () => setSelected(new Set(pagedCards.map((c) => c.id)));
  const clearSelection = () => setSelected(new Set());

  // ── Deck actions ──────────────────────────────────────────────────────────

  const handleCreateDeck = async (data: any) => {
    try {
      await createDeck(data);
      toast.success("Deck created");
    } catch { toast.error("Failed to create deck"); throw new Error(); }
  };

  const handleUpdateDeck = async (id: string, data: any) => {
    try {
      await updateDeck(id, data);
      toast.success("Deck updated");
    } catch { toast.error("Failed to update deck"); throw new Error(); }
  };

  const handleDeleteDeck = async (id: string) => {
    if (!confirm("Delete this deck? Cards will remain but become unassigned.")) return;
    try {
      await deleteDeck(id);
      if (selectedDeckId === id) setSelectedDeckId(null);
      toast.success("Deck deleted");
    } catch { toast.error("Failed to delete deck"); }
  };

  const handleDeckCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = deckCoverTargetId.current;
    if (!file || !id) return;
    try {
      const res = await cardsApi.uploadDeckImage(id, file);
      await updateDeck(id, { imageUrl: res.imageUrl });
      toast.success("Cover uploaded");
    } catch { toast.error("Upload failed"); }
    e.target.value = "";
  };

  // ── Card actions ──────────────────────────────────────────────────────────

  const handleCreateCard = async (data: any): Promise<Card | void> => {
    try {
      const card = await createCard({ ...data, deckId: selectedDeckId ?? data.deckId });
      toast.success("Card created");
      return card;
    } catch { toast.error("Failed to create card"); throw new Error(); }
  };

  const handleUpdateCard = async (id: string, data: any) => {
    try {
      await updateCard(id, data);
      toast.success("Card saved");
    } catch { toast.error("Failed to save card"); throw new Error(); }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      await deleteCard(id);
      setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
      toast.success("Card deleted");
    } catch { toast.error("Failed to delete card"); }
  };

  const handleDeleteSelected = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} card(s)?`)) return;
    for (const id of Array.from(selected)) await deleteCard(id).catch(() => {});
    clearSelection();
    toast.success("Deleted");
  };

  const handleMoveSelected = async (deckId: string) => {
    for (const id of Array.from(selected)) {
      await cardsApi.updateCard(id, { deckId }).catch(() => {});
    }
    await fetchCards();
    clearSelection();
    toast.success("Moved");
  };

  const handleCopyCard = (card: Card) => {
    navigator.clipboard.writeText(`${card.front} — ${card.back}`);
    toast.success("Copied");
  };

  // ── Context menus ─────────────────────────────────────────────────────────

  const openDeckMenu = (e: React.MouseEvent, el: HTMLElement, deck: Deck) => {
    e.preventDefault();
    const pos = positionNearElement(el);
    setCtxMenu({
      visible: true,
      ...pos,
      items: [
        {
          label: "Edit deck",
          icon: Edit2,
          action: () => setEditDeck(deck),
        },
        {
          label: "Upload cover",
          icon: ImageIcon,
          action: () => {
            deckCoverTargetId.current = deck.id;
            deckCoverInputRef.current?.click();
          },
        },
        {
          label: "Delete deck",
          icon: Trash2,
          danger: true,
          action: () => handleDeleteDeck(deck.id),
        },
      ],
    });
  };

  const openCardMenu = (e: React.MouseEvent, el: HTMLElement, card: Card) => {
    e.preventDefault();
    const pos = positionNearElement(el);
    const moveSubmenu: ContextMenuItem[] = decks.map((d) => ({
      label: `${d.emoji} ${d.name}`,
      icon: ArrowRight,
      action: async () => {
        await cardsApi.updateCard(card.id, { deckId: d.id });
        await fetchCards();
        toast.success(`Moved to ${d.name}`);
      },
    }));

    setCtxMenu({
      visible: true,
      ...pos,
      items: [
        { label: "Edit", icon: Edit2, action: () => setEditCard(card) },
        { label: "Copy", icon: Copy, action: () => handleCopyCard(card) },
        {
          label: "Move to deck",
          icon: Layers,
          action: () => {},
          submenu: moveSubmenu,
        },
        { label: "Delete", icon: Trash2, danger: true, action: () => handleDeleteCard(card.id) },
      ],
    });
  };

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (e: DragStartEvent) => {
    const c = cards.find((c) => c.id === e.active.id);
    if (c) setActiveCard(c);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveCard(null);
    const { over, active } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("deck-")) return;
    const deckId = overId.replace("deck-", "");
    const cardIds = selected.size > 0 && selected.has(String(active.id))
      ? Array.from(selected)
      : [String(active.id)];
    for (const cid of cardIds) {
      await cardsApi.updateCard(cid, { deckId }).catch(() => {});
    }
    await fetchCards();
    clearSelection();
    toast.success("Moved to deck");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const selectedDeck = decks.find((d) => d.id === selectedDeckId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full min-h-screen text-white" style={{ background: "transparent" }}>

        {/* Hidden inputs */}
        <input ref={deckCoverInputRef} type="file" accept="image/*" className="hidden" onChange={handleDeckCoverUpload} />

        {/* Study overlays */}
        <AnimatePresence>
          {showStudySetup && (
            <StudySetupModal
              decks={decks}
              allCards={cards}
              onStart={(studyCardList, name) => {
                setStudyCards(studyCardList);
                setStudyDeckName(name);
                setShowStudySetup(false);
              }}
              onClose={() => setShowStudySetup(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {studyCards && (
            <StudySession
              cards={studyCards}
              deckName={studyDeckName}
              onClose={() => setStudyCards(null)}
            />
          )}
        </AnimatePresence>

        {/* ── Left sidebar: deck list ────────────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-white/8 pt-6 pb-4">
          <div className="px-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Колоды</span>
              <button
                onClick={() => setShowNewDeck(true)}
                className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* All cards */}
          <div
            className={cn(
              "mx-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors mb-1",
              selectedDeckId === null ? "bg-white/10" : "hover:bg-white/[0.05]"
            )}
            style={{ borderLeft: selectedDeckId === null ? "3px solid #6366f1" : "3px solid transparent" }}
            onClick={() => setSelectedDeckId(null)}
          >
            <BookOpen size={16} className="text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">Все карточки</div>
              <div className="text-[11px] text-neutral-500">{cards.length} всего</div>
            </div>
          </div>

          {/* Deck list */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {decks.map((deck) => {
              const deckCards = cards.filter((c) => c.deckId === deck.id);
              return (
                <DroppableDeck
                  key={deck.id}
                  deck={deck}
                  isSelected={selectedDeckId === deck.id}
                  isExpanded={expandedDecks.has(deck.id)}
                  onSelect={() => setSelectedDeckId(deck.id)}
                  onToggleExpand={() => {
                    setExpandedDecks((p) => {
                      const n = new Set(p);
                      if (n.has(deck.id)) n.delete(deck.id);
                      else n.add(deck.id);
                      return n;
                    });
                  }}
                  onMenu={(e, el) => openDeckMenu(e, el, deck)}
                  cards={deckCards}
                />
              );
            })}
            {decks.length === 0 && (
              <div className="px-3 py-4 text-xs text-neutral-600 italic">Колод пока нет</div>
            )}
          </div>

          {/* Bulk AI button */}
          <div className="px-4 pt-3 border-t border-white/8 mt-2">
            <button
              onClick={() => setShowBulkAI(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 text-xs hover:bg-violet-600/20 transition-colors"
            >
              <Zap size={12} />
              <span>AI генерация</span>
            </button>
          </div>
        </aside>

        {/* ── Main area ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 flex-wrap">
            {/* Deck title */}
            <div className="flex items-center gap-2 mr-2">
              {selectedDeck ? (
                <>
                  <span className="text-xl">{selectedDeck.emoji}</span>
                  <div>
                    <div className="text-base font-semibold text-white leading-tight">{selectedDeck.name}</div>
                    <div className="text-xs text-neutral-500">{filteredCards.length} карточек</div>
                  </div>
                </>
              ) : (
                <div>
                  <div className="text-base font-semibold text-white leading-tight">Все карточки</div>
                  <div className="text-xs text-neutral-500">{filteredCards.length} карточек</div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-72">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск карточек..."
                className="pl-8 bg-white/5 border-white/10 text-white placeholder:text-neutral-500 text-sm h-9"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5 border border-white/8">
              {([
                { id: "all", label: "Все" },
                { id: "new", label: "Новые" },
                { id: "learning", label: "Учу" },
                { id: "review", label: "Повтор" },
                { id: "mastered", label: "Знаю" },
              ] as {id: StatusFilter; label: string}[]).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    statusFilter === s.id
                      ? "bg-white/10 text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-9 rounded-lg bg-white/[0.04] border border-white/8 text-neutral-300 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-white/20"
            >
              <option value="newest">Новые</option>
              <option value="oldest">Старые</option>
              <option value="alphabetical">А–Я</option>
              <option value="next-review">Повторить</option>
            </select>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/8">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                  viewMode === "grid" ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300")}
              >
                <Grid size={13} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                  viewMode === "list" ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300")}
              >
                <List size={13} />
              </button>
            </div>

            {/* Study + Add card */}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                onClick={() => setShowStudySetup(true)}
                size="sm"
                disabled={cards.length === 0}
                className="h-9 gap-1.5 bg-violet-600 hover:bg-violet-500 text-white border-0"
              >
                <Brain size={14} />
                Учить
              </Button>
              <Button
                onClick={() => setShowNewCard(true)}
                size="sm"
                className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white border-0"
              >
                <Plus size={14} />
                Добавить
              </Button>
            </div>
          </div>

          {/* Selection bar */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 px-5 py-2 bg-blue-500/10 border-b border-blue-500/20">
                  <span className="text-sm text-blue-300 font-medium">{selected.size} выбрано</span>
                  <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 underline">Выбрать все</button>
                  <button onClick={clearSelection} className="text-xs text-neutral-400 hover:text-white underline">Снять</button>
                  <div className="flex items-center gap-2 ml-auto">
                    {decks.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) handleMoveSelected(e.target.value); e.target.value = ""; }}
                        className="h-7 rounded-lg bg-white/5 border border-white/10 text-white text-xs px-2 focus:outline-none"
                      >
                        <option value="" disabled>Переместить в колоду…</option>
                        {decks.map((d) => <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
                      </select>
                    )}
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/25 transition-colors"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cards area */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 size={24} className="animate-spin text-neutral-500" />
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="text-5xl mb-4">📭</div>
                <div className="text-neutral-400 font-medium mb-1">Карточки не найдены</div>
                <div className="text-sm text-neutral-600 mb-6">
                  {search ? "Попробуйте другой запрос" : "Добавьте первую карточку для начала"}
                </div>
                <Button onClick={() => setShowNewCard(true)} size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-500">
                  <Plus size={14} />
                  Добавить карточку
                </Button>
              </div>
            ) : viewMode === "grid" ? (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                layout
              >
                <AnimatePresence mode="popLayout">
                  {pagedCards.map((card, idx) => (
                    <DraggableCard
                      key={card.id}
                      card={card}
                      isSelected={selected.has(card.id)}
                      onSelect={(e) => toggleSelect(card.id, e, idx)}
                      onMenu={(e, el) => openCardMenu(e, el, card)}
                      onEdit={() => setEditCard(card)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="space-y-0.5">
                {/* List header */}
                <div className="flex items-center gap-3 px-3 py-2 text-[11px] text-neutral-500 uppercase tracking-wider border-b border-white/8 mb-1">
                  <div className="w-4 shrink-0" />
                  <div className="w-40">Word</div>
                  <div className="flex-1">Translation</div>
                  <div className="flex-1 hidden xl:block">Example</div>
                  <div className="w-20 shrink-0">Status</div>
                  <div className="w-20 shrink-0 text-right">Next review</div>
                  <div className="w-5 shrink-0" />
                </div>
                <AnimatePresence mode="popLayout">
                  {pagedCards.map((card, idx) => (
                    <DraggableCardRow
                      key={card.id}
                      card={card}
                      isSelected={selected.has(card.id)}
                      onSelect={(e) => toggleSelect(card.id, e, idx)}
                      onMenu={(e, el) => openCardMenu(e, el, card)}
                      onEdit={() => setEditCard(card)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/8">
              <span className="text-xs text-neutral-500">
                {(page - 1) * CARDS_PER_PAGE + 1}–{Math.min(page * CARDS_PER_PAGE, filteredCards.length)} of {filteredCards.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-neutral-300 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                        p === page ? "bg-white/15 text-white" : "bg-white/[0.03] hover:bg-white/10 text-neutral-400"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-neutral-300 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ── DragOverlay ────────────────────────────────────────────────── */}
        <DragOverlay>
          {activeCard && (
            <div className="rounded-xl border border-white/20 bg-background shadow-2xl p-3 w-44 rotate-3 opacity-90 pointer-events-none">
              <div className="text-sm font-semibold text-white truncate">{activeCard.front}</div>
              <div className="text-xs text-neutral-400 truncate">{activeCard.back}</div>
            </div>
          )}
        </DragOverlay>

        {/* ── Context menu ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {ctxMenu.visible && (
            <ContextMenu state={ctxMenu} onClose={() => setCtxMenu((p) => ({ ...p, visible: false }))} />
          )}
        </AnimatePresence>

        {/* ── Modals ─────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showNewDeck && (
            <NewDeckModal
              onClose={() => setShowNewDeck(false)}
              onSave={handleCreateDeck}
            />
          )}
          {editDeck && (
            <NewDeckModal
              initial={{ name: editDeck.name, emoji: editDeck.emoji, color: editDeck.color, description: editDeck.description ?? "" }}
              onClose={() => setEditDeck(null)}
              onSave={(data) => handleUpdateDeck(editDeck.id, data)}
            />
          )}
          {showNewCard && (
            <CardEditorModal
              decks={decks}
              defaultDeckId={selectedDeckId ?? undefined}
              onClose={() => setShowNewCard(false)}
              onSave={handleCreateCard}
            />
          )}
          {editCard && (
            <CardEditorModal
              card={editCard}
              decks={decks}
              onClose={() => setEditCard(null)}
              onSave={(data) => handleUpdateCard(editCard.id, data)}
            />
          )}
          {showBulkAI && (
            <BulkAIModal
              decks={decks}
              onClose={() => setShowBulkAI(false)}
              onGenerated={() => { fetchCards(); fetchDecks(); }}
            />
          )}
        </AnimatePresence>
      </div>
    </DndContext>
  );
}
