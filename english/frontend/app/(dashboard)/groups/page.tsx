"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, LogIn, BookOpen, Crown, GraduationCap,
  Loader2, X, ChevronRight, Globe, Lock, Copy, Trash2, Edit3, Share2,
} from "lucide-react";
import { socialApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { PatternHeader, getPatternForId } from "@/components/course/pattern-header";
import { useContextMenu, ContextMenuPortal } from "@/components/ui/context-menu-custom";

type Group = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  memberCount: number;
  courseCount: number;
  isPublic: boolean;
  myRole?: string;
  imageUrl?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  teacher: "Учитель",
  student: "Ученик",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/20",
  teacher: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/20",
  student: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20",
};

function GroupCard({
  group,
  onClick,
  onDelete,
  onCopyInvite,
}: {
  group: Group;
  onClick: () => void;
  onDelete: () => void;
  onCopyInvite: () => void;
}) {
  const { menu, open, close } = useContextMenu();
  const pattern = getPatternForId(group.id);

  const contextItems = [
    { label: "Открыть", icon: ChevronRight, action: onClick },
    { label: "Скопировать ссылку", icon: Share2, action: onCopyInvite },
    ...(group.myRole === "owner"
      ? [{ label: "Удалить группу", icon: Trash2, danger: true, action: onDelete, divider: true }]
      : []),
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3, transition: { duration: 0.18 } }}
        onClick={onClick}
        onContextMenu={e => open(e, contextItems)}
        className="rounded-2xl overflow-hidden cursor-pointer group select-none"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        {/* Pattern header */}
        <PatternHeader color={group.color} imageUrl={group.imageUrl} pattern={pattern} height={96}>
          <div className="h-full flex items-end justify-between px-4 pb-3">
            <span className="text-3xl drop-shadow-lg">{group.emoji}</span>
            <div className="flex items-center gap-1.5">
              {group.myRole && (
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm", ROLE_COLORS[group.myRole])}>
                  {ROLE_LABELS[group.myRole]}
                </span>
              )}
              {group.isPublic
                ? <Globe className="w-3.5 h-3.5 text-white/50" />
                : <Lock className="w-3.5 h-3.5 text-white/50" />
              }
            </div>
          </div>
        </PatternHeader>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-white text-sm leading-tight">{group.name}</h3>
            <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5 group-hover:text-white/50 transition-colors" />
          </div>
          {group.description && (
            <p className="text-white/40 text-xs mb-3 line-clamp-2 leading-relaxed">{group.description}</p>
          )}
          <div className="flex items-center gap-3 text-white/40 text-xs">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {group.memberCount} участников
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {group.courseCount} курсов
            </span>
          </div>
        </div>
      </motion.div>

      <ContextMenuPortal menu={menu} onClose={close} />
    </>
  );
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: Group) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [color, setColor] = useState("#6366f1");
  const [loading, setLoading] = useState(false);

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4"];
  const EMOJIS = ["📚", "🎓", "✏️", "📝", "🔬", "🌍", "🎯", "💡", "🏆", "⚡", "🦁", "🚀", "🎨", "🎵", "💬"];

  const submit = async () => {
    if (!name.trim()) { toast.error("Введите название"); return; }
    setLoading(true);
    try {
      const g = await socialApi.createGroup({ name: name.trim(), description: description || null, emoji, color });
      toast.success("Группа создана!");
      onCreated(g);
    } catch {
      toast.error("Ошибка создания группы");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "rgba(15,15,25,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
      >
        {/* Preview */}
        <div className="mb-5 rounded-xl overflow-hidden" style={{ height: 80 }}>
          <PatternHeader color={color} pattern={getPatternForId(name || "preview")} height={80}>
            <div className="h-full flex items-end px-4 pb-3">
              <span className="text-2xl">{emoji}</span>
              <span className="ml-3 text-white font-semibold text-sm truncate">{name || "Название группы"}</span>
            </div>
          </PatternHeader>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Создать группу</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Название *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Английский 8Б"
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткое описание группы"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Эмодзи</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn("w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all", emoji === e ? "bg-indigo-500/40 ring-2 ring-indigo-500 scale-110" : "bg-white/5 hover:bg-white/10")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Цвет</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  className={cn("w-8 h-8 rounded-full transition-all", color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#0f0f19] scale-110" : "hover:scale-105")}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Создать
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function JoinGroupModal({ onClose, onJoined, initialCode, initialGroupId }: {
  onClose: () => void;
  onJoined: (g: Group) => void;
  initialCode?: string;
  initialGroupId?: string;
}) {
  const [code, setCode] = useState(initialCode || "");
  const [groupId, setGroupId] = useState(initialGroupId || "");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!code.trim() || !groupId.trim()) { toast.error("Введите ID группы и код"); return; }
    setLoading(true);
    try {
      const { group } = await socialApi.joinGroup(groupId.trim(), code.trim().toUpperCase());
      toast.success("Вы вступили в группу!");
      onJoined(group);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Неверный код или ID группы");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "rgba(15,15,25,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Войти в группу</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">ID группы</label>
            <input
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              placeholder="Вставьте ID группы"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Код приглашения</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors font-mono tracking-widest uppercase"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Вступить
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function GroupsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const inviteGroupId = searchParams.get("groupId") || searchParams.get("group") || "";
  const inviteCode = (searchParams.get("inviteCode") || searchParams.get("code") || "").toUpperCase();

  useEffect(() => {
    socialApi.getGroups()
      .then(data => setGroups(Array.isArray(data) ? data : data?.groups || []))
      .catch(() => toast.error("Ошибка загрузки групп"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (inviteGroupId && inviteCode) setShowJoin(true);
  }, [inviteCode, inviteGroupId]);

  const handleCreated = (g: Group) => {
    setGroups(prev => [{ ...g, myRole: "owner" }, ...prev]);
    setShowCreate(false);
    router.push(`/groups/${g.id}`);
  };

  const handleJoined = (g: Group) => {
    setGroups(prev => prev.find(x => x.id === g.id) ? prev : [{ ...g, myRole: "student" }, ...prev]);
    setShowJoin(false);
    router.push(`/groups/${g.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить группу? Это действие нельзя отменить.")) return;
    try {
      await socialApi.updateGroup(id, { deleted: true });
      setGroups(prev => prev.filter(g => g.id !== id));
      toast.success("Группа удалена");
    } catch { toast.error("Ошибка удаления"); }
  };

  const handleCopyInvite = (group: Group) => {
    const url = `${window.location.origin}/groups?groupId=${group.id}&inviteCode=${(group as any).inviteCode || ""}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Ссылка скопирована"));
  };

  return (
    <>
      <div className="w-full max-w-none">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-7"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Группы</h1>
            </div>
            <p className="text-white/40 text-sm ml-12">Учитесь вместе с другими</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white/70 hover:text-white text-sm transition-colors border border-white/10"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Войти</span>
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Создать</span>
            </button>
          </div>
        </motion.div>

        {/* Groups grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-10 h-10 text-white/20" />
            </div>
            <p className="text-white/50 mb-2 font-medium">У вас нет групп</p>
            <p className="text-white/30 text-sm mb-7">Создайте группу или войдите по коду приглашения</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowJoin(true)} className="px-5 py-2.5 rounded-xl bg-white/8 text-white/70 text-sm hover:bg-white/12 transition-colors border border-white/10">
                Войти по коду
              </button>
              <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
                Создать группу
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {groups.map((g, i) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <GroupCard
                  group={g}
                  onClick={() => router.push(`/groups/${g.id}`)}
                  onDelete={() => handleDelete(g.id)}
                  onCopyInvite={() => handleCopyInvite(g)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
        {showJoin && (
          <JoinGroupModal
            onClose={() => setShowJoin(false)}
            onJoined={handleJoined}
            initialGroupId={inviteGroupId}
            initialCode={inviteCode}
          />
        )}
      </AnimatePresence>
    </>
  );
}
