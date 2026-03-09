"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  Brain,
  FileUp,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MessageSquarePlus,
  PanelRight,
  Send,
  Shield,
  Sparkles,
  VenetianMask,
  Wallet,
  X,
} from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";
import { AiMarkdown } from "@/components/ai-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { apiClient, ApiClientError } from "@/api/client";
import type {
  AiChatMessage,
  AiChatResponse,
  AiConversationDetail,
  AiFileItem,
  AiPublicConfig,
  AiUserState,
} from "@/api/types";
import { useAuth } from "@/hooks/useAuth";

function formatTokens(value: number) {
  return value.toLocaleString("ru-RU");
}

function AuthGate({
  config,
}: {
  config: AiPublicConfig | null;
}) {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col justify-center px-4 py-16 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              lowkey AI
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-black tracking-tight md:text-6xl">
                AI-рабочее пространство в стиле ChatGPT внутри lowkey
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Один аккаунт для VPN и AI. Чаты, поиск по сайтам, работа с
                файлами, генерация артефактов и отдельные лимиты токенов без
                выхода из сервиса.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-12 rounded-2xl px-6 text-base">
                <Link href="/?auth=register">
                  Начать работу
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-2xl px-6 text-base">
                <Link href="/legal/ai-offer">Оферта AI</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
            <div className="space-y-5">
              <div className="rounded-3xl bg-zinc-950 p-5 text-zinc-50">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-white/10 p-2">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">lowkey AI</div>
                    <div className="text-sm text-zinc-400">
                      Поиск, файлы, артефакты, markdown-таблицы
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 text-sm leading-7 text-zinc-200">
                  <p>
                    Спроси: "Собери сравнение 5 VPN-протоколов, найди свежие
                    источники и сделай таблицу CSV".
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Free
                  </div>
                  <div className="mt-2 text-2xl font-black">
                    {config ? formatTokens(config.freeMonthlyTokens) : "500 000"}
                  </div>
                  <div className="text-sm text-muted-foreground">токенов без подписки</div>
                </div>
                {config?.plans.slice(0, 2).map((plan) => (
                  <div
                    key={plan.slug}
                    className="rounded-2xl border border-border/60 bg-muted/30 p-4"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {plan.title}
                    </div>
                    <div className="mt-2 text-2xl font-black">
                      {plan.price} ₽
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {plan.monthlyTokens
                        ? `${formatTokens(plan.monthlyTokens)} токенов в месяц`
                        : "Гибкие лимиты"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

export default function AiPage() {
  const { isAuthenticated, user, logout } = useAuth();
  const [config, setConfig] = useState<AiPublicConfig | null>(null);
  const [state, setState] = useState<AiUserState | null>(null);
  const [conversation, setConversation] = useState<AiConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [artifacts, setArtifacts] = useState<AiFileItem[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<AiFileItem | null>(null);
  const [pendingFiles, setPendingFiles] = useState<AiFileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const hasCanvas = artifacts.length > 0 && selectedArtifact;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const publicConfig = await apiClient.get<AiPublicConfig>("/ai/config");
        if (mounted) {
          setConfig(publicConfig);
        }

        if (isAuthenticated) {
          const userState = await apiClient.get<AiUserState>("/user/ai/state");
          if (!mounted) return;
          setState(userState);

          if (userState.conversations[0]) {
            const detail = await apiClient.get<AiConversationDetail>(
              `/user/ai/conversations/${userState.conversations[0].id}`,
            );
            if (!mounted) return;
            setConversation(detail);
            setArtifacts(detail.files.filter((file) => file.kind === "artifact"));
            setSelectedArtifact(
              detail.files.find((file) => file.kind === "artifact") ?? null,
            );
          }
        }
      } finally {
        if (mounted) {
          setIsBootLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation?.messages, artifacts]);

  const quotaLabel = useMemo(() => {
    if (!state) {
      return null;
    }

    return `${formatTokens(state.quota.totalAvailable)} токенов доступно`;
  }, [state]);

  const handleSelectConversation = async (conversationId: string) => {
    const detail = await apiClient.get<AiConversationDetail>(
      `/user/ai/conversations/${conversationId}`,
    );
    setConversation(detail);
    const nextArtifacts = detail.files.filter((file) => file.kind === "artifact");
    setArtifacts(nextArtifacts);
    setSelectedArtifact(nextArtifacts[0] ?? null);
  };

  const handleCreateConversation = async () => {
    const created = await apiClient.post<{ id: string; title: string; updatedAt: string }>(
      "/user/ai/conversations",
      {},
    );

    const nextState = await apiClient.get<AiUserState>("/user/ai/state");
    setState(nextState);
    setConversation({
      id: created.id,
      title: created.title,
      model: null,
      createdAt: created.updatedAt,
      updatedAt: created.updatedAt,
      messages: [],
      files: [],
    });
    setArtifacts([]);
    setSelectedArtifact(null);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    const uploaded: AiFileItem[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      if (conversation?.id) {
        form.append("conversationId", conversation.id);
      }

      const item = await apiClient.upload<AiFileItem>("/user/ai/uploads", form);
      uploaded.push(item);
    }

    setPendingFiles((prev) => [...prev, ...uploaded]);
    event.target.value = "";
  };

  const handlePurchase = async (plan: string) => {
    await apiClient.post("/user/ai/purchase", { plan });
    const nextState = await apiClient.get<AiUserState>("/user/ai/state");
    setState(nextState);
    setShowPaywall(false);
  };

  const handleSend = async () => {
    if (!draft.trim() || isSending) {
      return;
    }

    setIsSending(true);
    const optimisticMessage: AiChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: draft.trim(),
      createdAt: new Date().toISOString(),
    };

    const currentConversation = conversation ?? {
      id: "",
      title: "Новый диалог",
      model: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      files: [],
    };

    setConversation({
      ...currentConversation,
      messages: [...currentConversation.messages, optimisticMessage],
    });

    const currentDraft = draft.trim();
    setDraft("");

    try {
      const response = await apiClient.post<AiChatResponse>("/user/ai/chat", {
        conversationId: conversation?.id,
        message: currentDraft,
        attachmentIds: pendingFiles.map((file) => file.id),
      });

      const detail = await apiClient.get<AiConversationDetail>(
        `/user/ai/conversations/${response.conversationId}`,
      );
      const nextState = await apiClient.get<AiUserState>("/user/ai/state");
      setState(nextState);
      setConversation(detail);
      const nextArtifacts = response.artifacts;
      setArtifacts(nextArtifacts);
      if (nextArtifacts[0]) {
        setSelectedArtifact(nextArtifacts[0]);
      }
      setPendingFiles([]);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 402) {
        setShowPaywall(true);
      }
    } finally {
      setIsSending(false);
    }
  };

  if (isBootLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader size={72} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthGate config={config} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/60 bg-background/80 p-5 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-2 text-primary-foreground">
              <VenetianMask className="h-5 w-5" />
            </div>
            <div>
              <div className="font-black tracking-tight">lowkey AI</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                workspace
              </div>
            </div>
          </div>

          <Button
            className="mt-6 h-12 justify-start rounded-2xl"
            onClick={handleCreateConversation}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Новый чат
          </Button>

          <div className="mt-6 space-y-2 overflow-y-auto">
            {state?.conversations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectConversation(item.id)}
                className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                  conversation?.id === item.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/50 bg-card/60 hover:border-primary/20"
                }`}
              >
                <div className="truncate font-semibold">{item.title}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {item.lastMessage || "Пустой диалог"}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-auto space-y-3">
            <Link
              href="/me"
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Панель VPN
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <div className="text-sm font-semibold">{user?.login}</div>
              <div className="mt-1 text-xs text-muted-foreground">{quotaLabel}</div>
              <Button
                variant="ghost"
                className="mt-3 h-9 w-full justify-start rounded-xl px-3"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Выйти
              </Button>
            </div>
          </div>
        </aside>

        <main className={`grid min-h-screen ${hasCanvas ? "xl:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
          <section className="flex min-h-screen flex-col">
            <div className="flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl lg:px-6">
              <div>
                <div className="font-semibold">{conversation?.title || "Новый чат"}</div>
                <div className="text-xs text-muted-foreground">
                  {state?.settings.defaultModel || config?.defaultModel}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  Файл
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setSelectedArtifact(artifacts[0] ?? null)}
                >
                  <PanelRight className="mr-2 h-4 w-4" />
                  Холст
                </Button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
              <div className="mx-auto w-full max-w-4xl space-y-6">
                {conversation?.messages.length ? (
                  conversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-[1.75rem] border p-5 ${
                        message.role === "user"
                          ? "ml-auto max-w-3xl border-primary/20 bg-primary/8"
                          : "border-border/60 bg-card/70"
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {message.role === "user" ? (
                          <>Вы</>
                        ) : (
                          <>
                            <Brain className="h-3.5 w-3.5 text-primary" />
                            lowkey AI
                          </>
                        )}
                      </div>
                      {message.reasoning && message.role === "assistant" && (
                        <details className="mb-4 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                          <summary className="cursor-pointer font-medium">
                            Мыслительный процесс
                          </summary>
                          <div className="mt-3 whitespace-pre-wrap leading-7">
                            {message.reasoning}
                          </div>
                        </details>
                      )}
                      {message.role === "assistant" ? (
                        <AiMarkdown content={message.content} />
                      ) : (
                        <div className="whitespace-pre-wrap leading-7">
                          {message.content}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[2rem] border border-dashed border-border/60 bg-card/60 p-10 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Bot className="h-7 w-7 text-primary" />
                    </div>
                    <div className="text-2xl font-black">Готов к работе</div>
                    <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                      Попросите собрать исследование, сделать markdown-документ,
                      CSV-таблицу, просканировать сайты или разобрать загруженные
                      файлы и изображения.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border/60 bg-background/80 px-4 py-4 backdrop-blur-xl lg:px-8">
              <div className="mx-auto w-full max-w-4xl">
                {pendingFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {pendingFiles.map((file) => (
                      <div
                        key={file.id}
                        className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs"
                      >
                        {file.mimeType.startsWith("image/") ? (
                          <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <FileUp className="h-3.5 w-3.5 text-primary" />
                        )}
                        {file.fileName}
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-[1.75rem] border border-border/60 bg-card/80 p-3 shadow-sm">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Напишите сообщение, прикрепите файл или попросите создать артефакт..."
                    className="min-h-[96px] w-full resize-none border-0 bg-transparent px-2 py-2 text-base outline-none"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      {quotaLabel}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                      />
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        Загрузить
                      </Button>
                      <Button
                        className="rounded-xl"
                        onClick={handleSend}
                        disabled={isSending || !draft.trim()}
                      >
                        {isSending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Отправить
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {hasCanvas && selectedArtifact && (
            <aside className="border-l border-border/60 bg-background/80 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div>
                  <div className="font-semibold">Холст</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedArtifact.fileName}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setSelectedArtifact(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  {artifacts.map((artifact) => (
                    <button
                      key={artifact.id}
                      type="button"
                      onClick={() => setSelectedArtifact(artifact)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        selectedArtifact.id === artifact.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/60 bg-muted/40"
                      }`}
                    >
                      {artifact.fileName}
                    </button>
                  ))}
                </div>
                <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card">
                  {selectedArtifact.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedArtifact.blobUrl}
                      alt={selectedArtifact.fileName}
                      className="h-auto w-full object-cover"
                    />
                  ) : (
                    <iframe
                      title={selectedArtifact.fileName}
                      src={selectedArtifact.blobUrl}
                      className="h-[70vh] w-full"
                    />
                  )}
                </div>
                <Button asChild variant="outline" className="w-full rounded-xl">
                  <a href={selectedArtifact.blobUrl} target="_blank" rel="noreferrer">
                    Открыть файл
                  </a>
                </Button>
              </div>
            </aside>
          )}
        </main>
      </div>

      {showPaywall && state && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/70 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl rounded-[2rem] border border-border/60 bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-black tracking-tight">
                  Лимит AI токенов исчерпан
                </div>
                <p className="mt-2 text-muted-foreground">
                  Выберите AI-подписку или докупите токены. Оплата спишется с
                  баланса аккаунта.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowPaywall(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                {
                  slug: "ai",
                  title: "AI",
                  price: state.settings.aiPlanPrice,
                  tokens: state.settings.defaultModel,
                  caption: "10 000 000 токенов / мес",
                },
                {
                  slug: "max",
                  title: "MAX",
                  price: state.settings.maxPlanPrice,
                  tokens: "",
                  caption: "25 000 000 токенов / мес",
                },
                {
                  slug: "combo",
                  title: "Combo",
                  price: state.settings.comboPlanPrice,
                  tokens: "",
                  caption: "VPN + AI в одном пакете",
                },
                {
                  slug: "tokens",
                  title: "Токены",
                  price: state.settings.tokenPackPrice,
                  tokens: "",
                  caption: `${formatTokens(state.settings.tokenPackSize)} токенов`,
                },
              ].map((item) => (
                <div
                  key={item.slug}
                  className="rounded-2xl border border-border/60 bg-card/70 p-4"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {item.title}
                  </div>
                  <div className="mt-2 text-3xl font-black">{item.price} ₽</div>
                  <div className="mt-2 min-h-[40px] text-sm text-muted-foreground">
                    {item.caption}
                  </div>
                  <Button
                    className="mt-4 w-full rounded-xl"
                    onClick={() => handlePurchase(item.slug)}
                  >
                    Купить
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
