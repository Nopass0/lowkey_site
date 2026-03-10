"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  MessageSquareShare,
  Search,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMailings } from "@/hooks/useAdminMailings";
import type { AdminMailingRecipient } from "@/api/types";

function toDateTimeLocal(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function getDefaultScheduledAt(): string {
  return toDateTimeLocal(new Date(Date.now() + 10 * 60 * 1000));
}

function statusLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "Запланирована";
    case "processing":
      return "Отправляется";
    case "sent":
      return "Отправлена";
    case "failed":
      return "Ошибка";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "sent":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
    case "failed":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    case "processing":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600";
    default:
      return "border-primary/20 bg-primary/10 text-primary";
  }
}

export default function AdminMailingsPage() {
  const {
    mailings,
    total,
    isLoading,
    isSubmitting,
    fetchMailings,
    searchRecipients,
    createMailing,
    sendTest,
  } = useAdminMailings();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [targetType, setTargetType] = useState<"all" | "selected">("all");
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduledAt);
  const [recipientSearch, setRecipientSearch] = useState("");
  const deferredRecipientSearch = useDeferredValue(recipientSearch);
  const [recipients, setRecipients] = useState<AdminMailingRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void fetchMailings(1, 10);
  }, [fetchMailings]);

  useEffect(() => {
    if (targetType !== "selected") {
      return;
    }

    let disposed = false;
    void searchRecipients(deferredRecipientSearch).then((items) => {
      if (!disposed) {
        setRecipients(items);
      }
    });

    return () => {
      disposed = true;
    };
  }, [deferredRecipientSearch, searchRecipients, targetType]);

  const previewLines = useMemo(() => {
    if (!message) {
      return [];
    }
    return message.split("\n");
  }, [message]);

  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedIds.includes(recipient.id)),
    [recipients, selectedIds],
  );

  const canSubmit =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    scheduledAt.length > 0 &&
    (targetType === "all" || selectedIds.length > 0) &&
    (!!buttonText === !!buttonUrl);

  function toggleRecipient(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }

  async function handleTestSend() {
    setFeedback(null);
    try {
      await sendTest({
        title,
        message,
        buttonText: buttonText || undefined,
        buttonUrl: buttonUrl || undefined,
      });
      setFeedback("Тестовое сообщение отправлено в тестовый Telegram-чат.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Не удалось отправить тест.",
      );
    }
  }

  async function handleCreate() {
    setFeedback(null);
    try {
      await createMailing({
        title: title.trim(),
        message: message.trim(),
        buttonText: buttonText || undefined,
        buttonUrl: buttonUrl || undefined,
        targetType,
        selectedUserIds: selectedIds,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setFeedback("Рассылка поставлена в очередь.");
      setTitle("");
      setMessage("");
      setButtonText("");
      setButtonUrl("");
      setTargetType("all");
      setSelectedIds([]);
      setRecipientSearch("");
      setScheduledAt(getDefaultScheduledAt());
      await fetchMailings(1, 10);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Не удалось создать рассылку.",
      );
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <MessageSquareShare className="h-7 w-7 text-primary" />
          Рассылки в Telegram
        </h1>
        <p className="text-sm text-muted-foreground">
          Можно отправить всем пользователям с Telegram или выбрать конкретных и указать время отправки.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6 rounded-3xl border border-border/60 bg-card p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Заголовок
              </label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: Новое обновление"
                className="h-11 rounded-xl border-border/60 bg-background shadow-none"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Текст сообщения
              </label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Текст поста для Telegram."
                className="min-h-44 rounded-2xl border-border/60 bg-background shadow-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Текст кнопки
              </label>
              <Input
                value={buttonText}
                onChange={(event) => setButtonText(event.target.value)}
                placeholder="Открыть сайт"
                className="h-11 rounded-xl border-border/60 bg-background shadow-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ссылка кнопки
              </label>
              <Input
                value={buttonUrl}
                onChange={(event) => setButtonUrl(event.target.value)}
                placeholder="https://lowkey.su"
                className="h-11 rounded-xl border-border/60 bg-background shadow-none"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4 rounded-2xl border border-border/50 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" />
                Получатели
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTargetType("all")}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    targetType === "all"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-card"
                  }`}
                >
                  <div className="font-semibold">Всем</div>
                  <div className="text-xs text-muted-foreground">
                    Всем с подключенным Telegram
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("selected")}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    targetType === "selected"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-card"
                  }`}
                >
                  <div className="font-semibold">Точечно</div>
                  <div className="text-xs text-muted-foreground">
                    Выбрать конкретные логины
                  </div>
                </button>
              </div>

              {targetType === "selected" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={recipientSearch}
                      onChange={(event) => setRecipientSearch(event.target.value)}
                      placeholder="Поиск по логину"
                      className="h-11 rounded-xl border-border/60 bg-card pl-10 shadow-none"
                    />
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {recipients.map((recipient) => {
                      const active = selectedIds.includes(recipient.id);
                      return (
                        <button
                          key={recipient.id}
                          type="button"
                          onClick={() => toggleRecipient(recipient.id)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border/50 bg-card"
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{recipient.login}</div>
                            <div className="text-xs text-muted-foreground">
                              Telegram подключен
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-muted-foreground">
                            {active ? "Выбран" : "Выбрать"}
                          </div>
                        </button>
                      );
                    })}
                    {recipients.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                        Подходящих пользователей не найдено.
                      </div>
                    )}
                  </div>
                  {selectedRecipients.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedRecipients.map((recipient) => (
                        <span
                          key={recipient.id}
                          className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                        >
                          {recipient.login}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-border/50 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                Время отправки
              </div>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="h-11 rounded-xl border-border/60 bg-card shadow-none"
              />
              <p className="text-xs text-muted-foreground">
                Время берется из локальной зоны администратора в момент планирования.
              </p>
              <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm text-muted-foreground">
                Получателей:{" "}
                <span className="font-semibold text-foreground">
                  {targetType === "all" ? "все подключенные" : selectedIds.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestSend}
              disabled={!title.trim() || !message.trim() || isSubmitting}
              className="h-11 rounded-xl border-border/60 shadow-none"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Тест на втором боте
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!canSubmit || isSubmitting}
              className="h-11 rounded-xl shadow-none"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="mr-2 h-4 w-4" />
              )}
              Запланировать
            </Button>
          </div>

          {feedback && (
            <div className="rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm">
              {feedback}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-border/60 bg-[linear-gradient(180deg,#1d2733_0%,#121922_100%)] p-4 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <div className="text-sm font-semibold">Telegram preview</div>
                <div className="text-xs text-white/60">Как увидит пользователь</div>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold">
                @lowkey_test_bot
              </div>
            </div>
            <div className="rounded-[24px] bg-[#18222d] p-3">
              <div className="rounded-[20px] bg-[#2a5278] px-4 py-3 shadow-lg">
                <div className="text-sm font-semibold">
                  {title || "Заголовок поста"}
                </div>
                <div className="mt-2 space-y-2 text-sm leading-6 text-white/90">
                  {previewLines.length > 0 ? (
                    previewLines.map((line, index) => (
                      <p key={`${index}-${line}`}>{line || <span>&nbsp;</span>}</p>
                    ))
                  ) : (
                    <p className="text-white/55">Текст сообщения появится здесь.</p>
                  )}
                </div>
                {buttonText && buttonUrl && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-[#8cc8ff]">
                    {buttonText}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">История</div>
                <div className="text-sm text-muted-foreground">
                  Всего рассылок: {total}
                </div>
              </div>
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="space-y-3">
              {mailings.map((mailing) => (
                <div
                  key={mailing.id}
                  className="rounded-2xl border border-border/50 bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{mailing.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {mailing.targetType === "all"
                          ? "Всем пользователям"
                          : `Точечно: ${mailing.selectedUserIds.length}`}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                        mailing.status,
                      )}`}
                    >
                      {statusLabel(mailing.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <div>
                      Запланирована:{" "}
                      {new Date(mailing.scheduledAt).toLocaleString("ru-RU")}
                    </div>
                    <div>
                      Доставка: {mailing.sentCount}/{mailing.targetCount}
                      {mailing.failedCount > 0
                        ? `, ошибок ${mailing.failedCount}`
                        : ""}
                    </div>
                    {mailing.lastError && (
                      <div className="text-destructive">{mailing.lastError}</div>
                    )}
                  </div>
                </div>
              ))}
              {mailings.length === 0 && !isLoading && (
                <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-sm text-muted-foreground">
                  Рассылок пока нет.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
