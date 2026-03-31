"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Blocks, BookOpen, Bot, CreditCard, FileText, KeyRound, Library, Save, Send, Shield, TestTube2, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminApi } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

type TabId = "overview" | "users" | "plans" | "templates" | "content" | "ai" | "hf" | "broadcast";

const HF_PRESETS = {
  tts: [
    { label: "Default small", model: "facebook/mms-tts-eng", note: "Fast small English TTS model." },
    { label: "Natural", model: "hexgrad/Kokoro-82M", note: "More natural English speech." },
  ],
  speech: [
    { label: "English small", model: "openai/whisper-small.en", note: "Best default for English pronunciation." },
    { label: "Multilingual", model: "openai/whisper-small", note: "Useful for mixed accents or multilingual input." },
  ],
};

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
  const [aiForm, setAiForm] = useState({ model: "", baseUrl: "", siteName: "", siteUrl: "", temperature: "0.7", maxTokens: "2048", apiKey: "" });
  const [hfForm, setHfForm] = useState({ ttsModel: "", speechModel: "", apiToken: "" });

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
    setHfForm({
      ttsModel: hfSettings.ttsModel || "",
      speechModel: hfSettings.speechModel || "",
      apiToken: "",
    });
  }, [hfSettings]);

  async function loadData() {
    try {
      const [nextStats, nextUsers, nextPlans, nextTemplateDecks, nextContentOverview, nextAiSettings, nextHfSettings] = await Promise.all([
        adminApi.getStats(),
        adminApi.getUsers({ limit: 50 }),
        adminApi.getPlans(),
        adminApi.getTemplateDecks({ publicOnly: false, limit: 100 }),
        adminApi.getContentOverview(),
        adminApi.getAiSettings(),
        adminApi.getHfSettings(),
      ]);
      setStats(nextStats);
      setUsers(nextUsers);
      setPlans(nextPlans);
      setTemplateDecks(nextTemplateDecks);
      setContentOverview(nextContentOverview);
      setAiSettings(nextAiSettings);
      setHfSettings(nextHfSettings);
    } catch {
      setStats(null);
      setUsers([]);
      setPlans([]);
      setTemplateDecks([]);
      setContentOverview(null);
      setAiSettings(null);
      setHfSettings(null);
    }
  }

  async function handleGivePremium(userId: string, days: number) {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    await adminApi.updateUser(userId, { isPremium: true, premiumUntil: until });
    toast.success(`Premium granted for ${days} days`);
    loadData();
  }

  async function handleToggleTemplateDeck(deck: any) {
    try {
      const updated = await adminApi.updateTemplateDeck(deck.id, { isPublic: !deck.isPublic });
      setTemplateDecks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.isPublic ? "Deck published" : "Deck hidden");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to update deck");
    }
  }

  async function handleSaveAiSettings() {
    setSavingAi(true);
    try {
      const payload: any = {
        model: aiForm.model.trim(),
        baseUrl: aiForm.baseUrl.trim(),
        siteName: aiForm.siteName.trim(),
        siteUrl: aiForm.siteUrl.trim(),
        temperature: Number.parseFloat(aiForm.temperature) || 0.7,
        maxTokens: Number.parseInt(aiForm.maxTokens, 10) || 2048,
      };
      if (aiForm.apiKey.trim()) payload.apiKey = aiForm.apiKey.trim();
      const saved = await adminApi.updateAiSettings(payload);
      setAiSettings(saved);
      setAiForm((current) => ({ ...current, apiKey: "" }));
      toast.success("AI settings saved");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to save AI settings");
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
      setHfForm((current) => ({ ...current, apiToken: "" }));
      toast.success("HuggingFace settings saved");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to save HuggingFace settings");
    } finally {
      setSavingHf(false);
    }
  }

  async function handleBroadcast() {
    if (!broadcastMsg.trim()) return;
    setSending(true);
    try {
      const { sent } = await adminApi.broadcast({ message: broadcastMsg, premiumOnly });
      toast.success(`Sent to ${sent} users`);
      setBroadcastMsg("");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  const filteredUsers = useMemo(() => users.filter((entry) => !search || entry.name?.toLowerCase().includes(search.toLowerCase()) || entry.email?.toLowerCase().includes(search.toLowerCase())), [search, users]);
  if (!user || user.role !== "admin") return null;

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "users", label: `Users (${users.length})` },
    { id: "plans", label: "Plans" },
    { id: "templates", label: `Templates (${templateDecks.length})` },
    { id: "content", label: "Content" },
    { id: "ai", label: "AI" },
    { id: "hf", label: "HF / TTS" },
    { id: "broadcast", label: "Broadcast" },
  ];

  const statsCards = stats ? [
    { label: "Users", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
    { label: "Premium", value: stats.premiumUsers, icon: Shield, color: "text-amber-400" },
    { label: "Cards", value: stats.totalCards, icon: BookOpen, color: "text-violet-400" },
    { label: "Active today", value: stats.activeToday, icon: Activity, color: "text-green-400" },
    { label: "Payments", value: stats.totalPayments, icon: CreditCard, color: "text-red-400" },
    { label: "Revenue", value: `${(stats.totalRevenue || 0).toLocaleString("ru")} ₽`, icon: TrendingUp, color: "text-emerald-400" },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto space-y-5 page-enter">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center"><Shield size={18} className="text-violet-500" /></div>
        <div>
          <h1 className="text-xl font-semibold">English Admin</h1>
          <p className="text-xs text-muted-foreground">Runtime, templates, courses, tests and platform status.</p>
        </div>
      </div>

      <div className="flex gap-1 bg-accent/50 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((item) => (
          <button key={item.id} onClick={() => setTab(item.id)} className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === item.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{statsCards.map((item) => <div key={item.label} className="glass-card rounded-2xl p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center"><item.icon size={18} className={item.color} /></div><div><div className={`text-xl font-bold ${item.color}`}>{item.value}</div><div className="text-xs text-muted-foreground">{item.label}</div></div></div>)}</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-5 space-y-3"><div className="flex items-center gap-2"><Bot size={17} className="text-blue-400" /><h3 className="font-semibold">AI Runtime</h3></div><div className="text-sm space-y-2"><div className="flex justify-between gap-3"><span className="text-muted-foreground">API key</span><Badge variant={aiSettings?.hasApiKey ? "default" : "secondary"}>{aiSettings?.hasApiKey ? (aiSettings?.maskedApiKey || "Configured") : "Missing"}</Badge></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Model</span><span className="text-right break-all">{aiSettings?.model || "Not set"}</span></div></div></div>
          <div className="glass-card rounded-2xl p-5 space-y-3"><div className="flex items-center gap-2"><KeyRound size={17} className="text-orange-400" /><h3 className="font-semibold">HF Runtime</h3></div><div className="text-sm space-y-2"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Token</span><Badge variant={hfSettings?.hasApiToken ? "default" : "secondary"}>{hfSettings?.hasApiToken ? (hfSettings?.maskedApiToken || "Configured") : "Missing"}</Badge></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">TTS</span><span className="text-right break-all">{hfSettings?.ttsModel || "Not set"}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Speech</span><span className="text-right break-all">{hfSettings?.speechModel || "Not set"}</span></div></div></div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[{ label: "Groups", value: contentOverview?.counts?.groups || 0, icon: Users, color: "text-blue-400" }, { label: "Courses", value: contentOverview?.counts?.courses || 0, icon: Library, color: "text-violet-400" }, { label: "Tests", value: contentOverview?.counts?.tests || 0, icon: TestTube2, color: "text-amber-400" }, { label: "Grammar", value: contentOverview?.counts?.grammarTopics || 0, icon: FileText, color: "text-emerald-400" }].map((item) => <div key={item.label} className="glass-card rounded-2xl p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center"><item.icon size={18} className={item.color} /></div><div><div className={`text-xl font-bold ${item.color}`}>{item.value}</div><div className="text-xs text-muted-foreground">{item.label}</div></div></div>)}
        </div>
      </div>}

      {tab === "users" && <div className="space-y-3">
        <Input placeholder="Search by name or email..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-9" />
        <div className="space-y-2">{filteredUsers.map((entry) => <div key={entry.id} className="glass-card rounded-xl p-4 flex items-center gap-4"><div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center text-white text-sm font-semibold">{entry.name?.charAt(0) || "?"}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-medium text-sm">{entry.name}</span>{entry.isPremium && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/15 text-amber-500 rounded-full font-semibold border border-amber-500/20">PRO</span>}{entry.role === "admin" && <span className="text-[9px] px-1.5 py-0.5 bg-violet-500/15 text-violet-500 rounded-full font-semibold border border-violet-500/20">Admin</span>}</div><div className="text-xs text-muted-foreground truncate">{entry.email}</div><div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground"><span>{entry.xp || 0} XP</span><span>{entry.studyStreak || 0} day streak</span><span>{formatDate(entry.createdAt)}</span></div></div><div className="flex flex-col gap-1.5 items-end">{!entry.isPremium && <Button variant="outline" size="sm" onClick={() => handleGivePremium(entry.id, 30)} className="text-[11px] h-7 px-2.5">+ 30 days PRO</Button>}{entry.isPremium && <Button variant="outline" size="sm" onClick={() => handleGivePremium(entry.id, 365)} className="text-[11px] h-7 px-2.5">+ 1 year PRO</Button>}</div></div>)}</div>
      </div>}

      {tab === "plans" && <div className="space-y-3">{plans.map((plan) => <div key={plan.id} className="glass-card rounded-xl p-5 flex items-start justify-between gap-4"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-semibold">{plan.name}</span><Badge variant={plan.isActive ? "default" : "secondary"}>{plan.isActive ? "Active" : "Disabled"}</Badge></div><div className="text-2xl font-bold gradient-text">{plan.price.toLocaleString("ru")} ₽</div><div className="text-sm text-muted-foreground">{plan.intervalDays} days</div><div className="flex gap-2 flex-wrap mt-2">{plan.features?.map((feature: string) => <Badge key={feature} variant="outline" className="text-xs">{feature}</Badge>)}</div></div><Button variant="outline" size="sm" onClick={async () => { await adminApi.updatePlan(plan.id, { isActive: !plan.isActive }); loadData(); toast.success("Plan updated"); }}>{plan.isActive ? "Disable" : "Enable"}</Button></div>)}</div>}

      {tab === "templates" && <div className="space-y-3">{templateDecks.length === 0 && <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground">No template decks found.</div>}{templateDecks.map((deck) => <div key={deck.id} className="glass-card rounded-2xl p-4 flex items-center gap-4"><div className="w-16 h-16 rounded-2xl overflow-hidden bg-accent flex items-center justify-center text-2xl">{deck.imageUrl ? <img src={deck.imageUrl} alt="" className="w-full h-full object-cover" /> : deck.emoji || "📚"}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-sm">{deck.name}</span><Badge variant={deck.isPublic ? "default" : "secondary"}>{deck.isPublic ? "Public" : "Hidden"}</Badge>{deck.category && <Badge variant="outline">{deck.category}</Badge>}</div><div className="text-xs text-muted-foreground mt-1 line-clamp-2">{deck.description || "No description"}</div><div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap"><span>{deck.cardCount || 0} cards</span><span>Owner: {deck.ownerName || "Unknown"}</span>{deck.updatedAt && <span>{formatDate(deck.updatedAt)}</span>}</div></div><Button variant={deck.isPublic ? "outline" : "gradient"} size="sm" onClick={() => handleToggleTemplateDeck(deck)}>{deck.isPublic ? "Hide" : "Publish"}</Button></div>)}</div>}

      {tab === "content" && <div className="grid xl:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5 space-y-3"><div className="flex items-center gap-2"><Users size={17} className="text-blue-400" /><h3 className="font-semibold">Groups</h3></div><div className="space-y-2">{(contentOverview?.groups || []).slice(0, 8).map((group: any) => <div key={group.id} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="font-medium text-sm">{group.name}</div><div className="text-xs text-muted-foreground mt-1">{group.description || "No description"}</div></div>)}</div><Button variant="outline" size="sm" onClick={() => router.push("/groups")} className="w-full">Open groups</Button></div>
        <div className="glass-card rounded-2xl p-5 space-y-3"><div className="flex items-center gap-2"><Library size={17} className="text-violet-400" /><h3 className="font-semibold">Courses</h3></div><div className="space-y-2">{(contentOverview?.courses || []).slice(0, 8).map((course: any) => <div key={course.id} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="font-medium text-sm">{course.title || course.name}</div><div className="text-xs text-muted-foreground mt-1">{course.groupName ? `Group: ${course.groupName}` : "No group linked"}</div></div>)}</div><Button variant="outline" size="sm" onClick={() => router.push("/groups")} className="w-full">Open courses</Button></div>
        <div className="glass-card rounded-2xl p-5 space-y-3"><div className="flex items-center gap-2"><TestTube2 size={17} className="text-amber-400" /><h3 className="font-semibold">Tests</h3></div><div className="space-y-2">{(contentOverview?.tests || []).slice(0, 8).map((test: any) => <div key={test.id} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="font-medium text-sm">{test.title || "Untitled test"}</div><div className="text-xs text-muted-foreground mt-1">{test.courseTitle ? `Course: ${test.courseTitle}` : "No course linked"}</div></div>)}</div><Button variant="outline" size="sm" onClick={() => router.push("/groups")} className="w-full">Open tests</Button></div>
        <div className="glass-card rounded-2xl p-5 space-y-3"><div className="flex items-center gap-2"><FileText size={17} className="text-emerald-400" /><h3 className="font-semibold">Grammar</h3></div><div className="space-y-2">{(contentOverview?.grammarTopics || []).slice(0, 8).map((topic: any) => <div key={topic.id} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="font-medium text-sm">{topic.title}</div><div className="text-xs text-muted-foreground mt-1">{topic.category || "grammar"}{topic.level ? ` • ${topic.level}` : ""}</div></div>)}</div><Button variant="outline" size="sm" onClick={() => router.push("/grammar")} className="w-full">Open grammar</Button></div>
      </div>}

      {tab === "ai" && <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6">
        <div className="glass-card rounded-2xl p-6 space-y-4"><div className="flex items-center gap-2"><Bot size={18} className="text-blue-400" /><h3 className="font-semibold">OpenRouter Runtime</h3></div><div className="grid md:grid-cols-2 gap-4"><div className="space-y-2"><label className="text-sm text-muted-foreground">Model</label><Input value={aiForm.model} onChange={(event) => setAiForm((current) => ({ ...current, model: event.target.value }))} placeholder="openai/gpt-4o-mini" /></div><div className="space-y-2"><label className="text-sm text-muted-foreground">Base URL</label><Input value={aiForm.baseUrl} onChange={(event) => setAiForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://openrouter.ai/api/v1" /></div><div className="space-y-2"><label className="text-sm text-muted-foreground">Site Name</label><Input value={aiForm.siteName} onChange={(event) => setAiForm((current) => ({ ...current, siteName: event.target.value }))} placeholder="LowKey English" /></div><div className="space-y-2"><label className="text-sm text-muted-foreground">Site URL</label><Input value={aiForm.siteUrl} onChange={(event) => setAiForm((current) => ({ ...current, siteUrl: event.target.value }))} placeholder="https://english.lowkey.su" /></div><div className="space-y-2"><label className="text-sm text-muted-foreground">Temperature</label><Input value={aiForm.temperature} onChange={(event) => setAiForm((current) => ({ ...current, temperature: event.target.value }))} placeholder="0.7" /></div><div className="space-y-2"><label className="text-sm text-muted-foreground">Max tokens</label><Input value={aiForm.maxTokens} onChange={(event) => setAiForm((current) => ({ ...current, maxTokens: event.target.value }))} placeholder="2048" /></div></div><div className="space-y-2"><label className="text-sm text-muted-foreground">OpenRouter API key</label><Input type="password" value={aiForm.apiKey} onChange={(event) => setAiForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder={aiSettings?.hasApiKey ? "Leave empty to keep current key" : "sk-or-v1-..."} /></div><Button variant="gradient" onClick={handleSaveAiSettings} disabled={savingAi} className="gap-2"><Save size={16} />{savingAi ? "Saving..." : "Save AI settings"}</Button></div>
        <div className="glass-card rounded-2xl p-6 space-y-4"><div className="flex items-center gap-2"><KeyRound size={18} className="text-amber-400" /><h3 className="font-semibold">Current state</h3></div><div className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Provider</span><Badge variant="outline">{aiSettings?.provider || "openrouter"}</Badge></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">API key</span><Badge variant={aiSettings?.hasApiKey ? "default" : "secondary"}>{aiSettings?.hasApiKey ? (aiSettings?.maskedApiKey || "Configured") : "Missing"}</Badge></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Model</span><span className="text-right break-all">{aiSettings?.model || "Not set"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Updated</span><span>{aiSettings?.updatedAt ? formatDate(aiSettings.updatedAt) : "Not yet saved"}</span></div></div></div>
      </div>}

      {tab === "hf" && <div className="space-y-6">
        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6">
          <div className="glass-card rounded-2xl p-6 space-y-4"><div className="flex items-center gap-2"><Bot size={18} className="text-orange-400" /><h3 className="font-semibold">HuggingFace Configuration</h3></div><div className="grid md:grid-cols-2 gap-4"><div className="space-y-2"><label className="text-sm text-muted-foreground">TTS Model</label><Input value={hfForm.ttsModel} onChange={(event) => setHfForm((current) => ({ ...current, ttsModel: event.target.value }))} placeholder="facebook/mms-tts-eng" /></div><div className="space-y-2"><label className="text-sm text-muted-foreground">Speech Model</label><Input value={hfForm.speechModel} onChange={(event) => setHfForm((current) => ({ ...current, speechModel: event.target.value }))} placeholder="openai/whisper-small.en" /></div></div><div className="space-y-2"><label className="text-sm text-muted-foreground">HF API Token</label><Input type="password" value={hfForm.apiToken} onChange={(event) => setHfForm((current) => ({ ...current, apiToken: event.target.value }))} placeholder={hfSettings?.hasApiToken ? "Leave empty to keep current token" : "hf_..."} /></div><Button variant="gradient" onClick={handleSaveHfSettings} disabled={savingHf} className="gap-2"><Save size={16} />{savingHf ? "Saving..." : "Save HF settings"}</Button></div>
          <div className="glass-card rounded-2xl p-6 space-y-4"><div className="flex items-center gap-2"><KeyRound size={18} className="text-amber-400" /><h3 className="font-semibold">Current state</h3></div><div className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">API token</span><Badge variant={hfSettings?.hasApiToken ? "default" : "secondary"}>{hfSettings?.hasApiToken ? (hfSettings?.maskedApiToken || "Configured") : "Missing"}</Badge></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">TTS model</span><span className="text-right break-all">{hfSettings?.ttsModel || "Not set"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Speech model</span><span className="text-right break-all">{hfSettings?.speechModel || "Not set"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Updated</span><span>{hfSettings?.updatedAt ? formatDate(hfSettings.updatedAt) : "Not yet saved"}</span></div></div><div className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-muted-foreground">Audio is cached in VoidDB `english-sounds`, media in `english-media`.</div></div>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 space-y-3"><div className="flex items-center gap-2"><BookOpen size={17} className="text-orange-400" /><h3 className="font-semibold">TTS presets</h3></div>{HF_PRESETS.tts.map((preset) => <div key={preset.model} className="rounded-xl border border-white/10 bg-black/10 p-4 flex items-start justify-between gap-4"><div><div className="font-medium text-sm">{preset.label}</div><div className="text-xs text-muted-foreground mt-1 break-all">{preset.model}</div><div className="text-xs text-muted-foreground mt-2">{preset.note}</div></div><Button variant="outline" size="sm" onClick={() => setHfForm((current) => ({ ...current, ttsModel: preset.model }))}>Use</Button></div>)}</div>
          <div className="glass-card rounded-2xl p-6 space-y-3"><div className="flex items-center gap-2"><TestTube2 size={17} className="text-amber-400" /><h3 className="font-semibold">Speech presets</h3></div>{HF_PRESETS.speech.map((preset) => <div key={preset.model} className="rounded-xl border border-white/10 bg-black/10 p-4 flex items-start justify-between gap-4"><div><div className="font-medium text-sm">{preset.label}</div><div className="text-xs text-muted-foreground mt-1 break-all">{preset.model}</div><div className="text-xs text-muted-foreground mt-2">{preset.note}</div></div><Button variant="outline" size="sm" onClick={() => setHfForm((current) => ({ ...current, speechModel: preset.model }))}>Use</Button></div>)}</div>
        </div>
      </div>}

      {tab === "broadcast" && <div className="glass-card rounded-2xl p-6 space-y-4 max-w-lg"><h3 className="font-semibold flex items-center gap-2"><Send size={18} />Telegram broadcast</h3><textarea value={broadcastMsg} onChange={(event) => setBroadcastMsg(event.target.value)} placeholder="Message text. Markdown is supported." rows={5} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" /><div className="flex items-center gap-2"><input type="checkbox" id="premiumOnly" checked={premiumOnly} onChange={(event) => setPremiumOnly(event.target.checked)} /><label htmlFor="premiumOnly" className="text-sm">Only premium users</label></div><Button variant="gradient" onClick={handleBroadcast} disabled={sending || !broadcastMsg.trim()} className="w-full gap-2"><Send size={16} />{sending ? "Sending..." : "Send broadcast"}</Button></div>}
    </div>
  );
}
