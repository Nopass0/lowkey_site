"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Users, BarChart2, Plus, Copy, RefreshCw,
  UserMinus, ChevronRight, Loader2, Crown, GraduationCap,
  Lock, ArrowLeft, Check, Link2, Edit3, Trash2, Share2,
  MoreHorizontal, Award, Camera,
} from "lucide-react";
import { socialApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";
import { PatternHeader, getPatternForId } from "@/components/course/pattern-header";
import { useContextMenu, ContextMenuPortal } from "@/components/ui/context-menu-custom";

type Member = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  level: string;
  role: string;
  joinedAt: string;
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  color: string;
  level: string;
  blockCount: number;
  isPublished: boolean;
  imageUrl?: string | null;
};

type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  memberCount: number;
  courseCount: number;
  isPublic: boolean;
  inviteCode: string;
  ownerId: string;
  isMember: boolean;
  myRole: string | null;
  members: Member[];
  imageUrl?: string | null;
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Начинающий",
  elementary: "Элементарный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

const ROLE_LABELS: Record<string, string> = { owner: "Владелец", teacher: "Учитель", student: "Ученик" };
const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5 text-yellow-400" />,
  teacher: <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />,
  student: <BookOpen className="w-3.5 h-3.5 text-emerald-400" />,
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
  teacher: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20",
  student: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
};

function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover flex-shrink-0" />;
  return (
    <div style={{ width: size, height: size }} className="rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CourseCard({ course, groupId, isTeacher, onDelete }: { course: Course; groupId: string; isTeacher: boolean; onDelete: () => void }) {
  const router = useRouter();
  const { menu, open, close } = useContextMenu();
  const pattern = getPatternForId(course.id);

  const contextItems = [
    { label: "Открыть курс", icon: ChevronRight, action: () => router.push(`/groups/${groupId}/courses/${course.id}`) },
    ...(isTeacher ? [
      { label: "Редактировать", icon: Edit3, action: () => router.push(`/groups/${groupId}/courses/${course.id}/edit`) },
      { label: "Удалить курс", icon: Trash2, danger: true, action: onDelete, divider: true },
    ] : []),
  ];

  return (
    <>
      <Link href={`/groups/${groupId}/courses/${course.id}`}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2, transition: { duration: 0.15 } }}
          onContextMenu={e => open(e, contextItems)}
          className="rounded-2xl overflow-hidden cursor-pointer group select-none"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
          }}
        >
          <PatternHeader color={course.color} imageUrl={course.imageUrl} pattern={pattern} height={72}>
            <div className="h-full flex items-end justify-between px-3 pb-2.5">
              <span className="text-2xl">{course.emoji}</span>
              {!course.isPublished && (
                <span className="text-[10px] bg-black/30 text-white/50 px-2 py-0.5 rounded-full backdrop-blur-sm">Черновик</span>
              )}
            </div>
          </PatternHeader>
          <div className="p-3.5">
            <div className="flex items-start justify-between gap-1 mb-1">
              <h3 className="font-semibold text-white text-[13px] leading-tight">{course.title}</h3>
              <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0 mt-0.5" />
            </div>
            {course.description && (
              <p className="text-white/40 text-[11px] mb-2 line-clamp-1 leading-relaxed">{course.description}</p>
            )}
            <div className="flex items-center gap-2 text-white/40 text-[11px]">
              <span className="px-1.5 py-0.5 rounded-md bg-white/5">{LEVEL_LABELS[course.level] || course.level}</span>
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.blockCount}</span>
            </div>
          </div>
        </motion.div>
      </Link>
      <ContextMenuPortal menu={menu} onClose={close} />
    </>
  );
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"courses" | "members" | "progress">("courses");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [progressData, setProgressData] = useState<any>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [headerUploading, setHeaderUploading] = useState(false);
  const createModalRef = useRef<HTMLDivElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");

  useEffect(() => {
    Promise.all([
      socialApi.getGroup(groupId),
      socialApi.getCourses(groupId),
    ]).then(([g, c]) => {
      setGroup(g);
      setCourses(Array.isArray(c) ? c : c?.courses || []);
    }).catch(() => toast.error("Ошибка загрузки группы"))
      .finally(() => setLoading(false));
  }, [groupId]);

  const isTeacher = group?.myRole === "owner" || group?.myRole === "teacher";
  const isOwner = group?.myRole === "owner";

  const copyInvite = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Код скопирован!");
  };

  const copyInviteLink = async () => {
    if (!group || typeof window === "undefined") return;
    const url = `${window.location.origin}/groups?groupId=${encodeURIComponent(group.id)}&inviteCode=${encodeURIComponent(group.inviteCode)}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast.success("Ссылка скопирована");
  };

  const regenInvite = async () => {
    if (!group) return;
    setRegenLoading(true);
    try {
      const { inviteCode } = await socialApi.regenerateInvite(groupId);
      setGroup(g => g ? { ...g, inviteCode } : g);
      toast.success("Код обновлён");
    } catch { toast.error("Ошибка"); }
    finally { setRegenLoading(false); }
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Удалить участника из группы?")) return;
    try {
      await socialApi.removeMember(groupId, userId);
      setGroup(g => g ? { ...g, members: g.members.filter(m => m.userId !== userId), memberCount: Math.max(0, g.memberCount - 1) } : g);
      toast.success("Участник удалён");
    } catch { toast.error("Ошибка"); }
  };

  const loadProgress = async () => {
    if (progressData) return;
    setProgressLoading(true);
    try {
      const data = await socialApi.getGroupProgress(groupId);
      setProgressData(data);
    } catch { toast.error("Ошибка загрузки прогресса"); }
    finally { setProgressLoading(false); }
  };

  const handleTabChange = (t: "courses" | "members" | "progress") => {
    setTab(t);
    if (t === "progress" && !progressData) loadProgress();
  };

  const createCourse = async () => {
    if (!newCourseTitle.trim()) { toast.error("Введите название курса"); return; }
    setCreatingCourse(true);
    try {
      const course = await socialApi.createCourse(groupId, {
        title: newCourseTitle.trim(),
        emoji: "📖",
        color: group?.color || "#6366f1",
        level: "beginner",
      });
      setCourses(prev => [...prev, course]);
      setGroup(g => g ? { ...g, courseCount: g.courseCount + 1 } : g);
      setShowCreateModal(false);
      setNewCourseTitle("");
      router.push(`/groups/${groupId}/courses/${course.id}/edit`);
    } catch {
      toast.error("Ошибка создания курса");
    } finally {
      setCreatingCourse(false);
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!confirm("Удалить курс? Это действие нельзя отменить.")) return;
    try {
      await socialApi.deleteCourse(groupId, courseId);
      setCourses(prev => prev.filter(c => c.id !== courseId));
      setGroup(g => g ? { ...g, courseCount: Math.max(0, g.courseCount - 1) } : g);
      toast.success("Курс удалён");
    } catch { toast.error("Ошибка"); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!group) return <div className="text-center text-white/50 py-20">Группа не найдена</div>;

  const pattern = getPatternForId(group.id);

  return (
    <div className="w-full max-w-none">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        {/* Group header */}
        <PatternHeader
          color={group.color}
          imageUrl={group.imageUrl}
          pattern={pattern}
          height={160}
        >
          <div className="h-full flex flex-col justify-end px-6 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-5xl mb-2 block drop-shadow-lg">{group.emoji}</span>
                <h1 className="text-2xl font-bold text-white drop-shadow-md">{group.name}</h1>
                {group.description && (
                  <p className="text-white/65 text-sm mt-1 max-w-lg">{group.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-white/55 text-xs">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{group.memberCount} участников</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{group.courseCount} курсов</span>
                  {group.myRole && (
                    <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", ROLE_BADGE[group.myRole])}>
                      {ROLE_ICONS[group.myRole]} {ROLE_LABELS[group.myRole]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </PatternHeader>
      </motion.div>

      {/* Invite code */}
      {isTeacher && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Lock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-xs mb-0.5">Код приглашения</p>
            <p className="text-white font-mono font-bold text-xl tracking-widest">{group.inviteCode}</p>
            <p className="text-white/25 text-xs">ID: {group.id}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={copyInvite} title="Скопировать код" className="p-2 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button onClick={copyInviteLink} title="Скопировать ссылку" className="p-2 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
              {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
            </button>
            {isOwner && (
              <button onClick={regenInvite} disabled={regenLoading} title="Обновить код" className="p-2 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
                <RefreshCw className={cn("w-4 h-4", regenLoading && "animate-spin")} />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {[
          { key: "courses", label: "Курсы", icon: BookOpen },
          { key: "members", label: "Участники", icon: Users },
          ...(isTeacher ? [{ key: "progress", label: "Прогресс", icon: BarChart2 }] : []),
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === "courses" && (
          <motion.div key="courses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {isTeacher && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowCreateModal(true)}
                  disabled={creatingCourse}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Новый курс
                </button>
              </div>
            )}

            {courses.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Курсов пока нет</p>
                {isTeacher && (
                  <p className="text-xs mt-1 text-white/25">Создайте первый курс для группы</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {courses.map((c, i) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <CourseCard
                      course={c}
                      groupId={groupId}
                      isTeacher={isTeacher}
                      onDelete={() => deleteCourse(c.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "members" && (
          <motion.div key="members" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {group.members.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-5 py-3.5 border-b last:border-0 hover:bg-white/[0.02] transition-colors"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}
              >
                <Avatar url={m.avatarUrl} name={m.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{m.name}</p>
                  <p className="text-white/35 text-xs">{LEVEL_LABELS[m.level] || m.level}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium", ROLE_BADGE[m.role] || "bg-white/5 text-white/40")}>
                    {ROLE_ICONS[m.role]}
                    {ROLE_LABELS[m.role] || m.role}
                  </span>
                  {isOwner && m.userId !== user?.id && (
                    <button
                      onClick={() => removeMember(m.userId)}
                      className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/25 hover:text-red-400 transition-colors"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {tab === "progress" && isTeacher && (
          <motion.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {progressLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
            ) : progressData ? (
              <div className="rounded-2xl overflow-x-auto" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <th className="px-5 py-3.5 text-left text-white/40 font-medium text-xs uppercase tracking-wider">Ученик</th>
                      {progressData.courses?.map((c: any) => (
                        <th key={c.id} className="px-4 py-3.5 text-center text-white/40 font-medium text-xs uppercase tracking-wider min-w-[120px]">
                          {c.emoji} {c.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {progressData.members?.filter((m: any) => m.role === "student").map((m: any) => (
                      <tr key={m.userId} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar url={m.avatarUrl} name={m.name} size={28} />
                            <span className="text-white text-sm">{m.name}</span>
                          </div>
                        </td>
                        {m.courseProgress?.map((cp: any) => (
                          <td key={cp.courseId} className="px-4 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn(
                                "text-xs px-2.5 py-1 rounded-full font-semibold",
                                cp.percentComplete === 100 ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                                  cp.percentComplete > 0 ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20" :
                                    "bg-white/5 text-white/25"
                              )}>
                                {cp.percentComplete}%
                              </span>
                              <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all", cp.percentComplete === 100 ? "bg-emerald-400" : "bg-indigo-400")}
                                  style={{ width: `${cp.percentComplete}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-white/40 text-sm">Нет данных</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create course modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: "rgba(15,15,25,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
            >
              <h2 className="text-lg font-bold text-white mb-4">Новый курс</h2>
              <input
                autoFocus
                value={newCourseTitle}
                onChange={e => setNewCourseTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createCourse()}
                placeholder="Название курса"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => { setShowCreateModal(false); setNewCourseTitle(""); }} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors">
                  Отмена
                </button>
                <button
                  onClick={createCourse}
                  disabled={creatingCourse}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {creatingCourse && <Loader2 className="w-4 h-4 animate-spin" />}
                  Создать
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
