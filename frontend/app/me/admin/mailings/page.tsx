"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Image,
  Loader2,
  MessageSquareShare,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMailings } from "@/hooks/useAdminMailings";
import type {
  AdminMailingItem,
  AdminMailingRecipient,
  AdminMailingRecipientGroup,
  MailingButton,
  MailingGroupCondition,
} from "@/api/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateTimeLocal(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function getDefaultScheduledAt(): string {
  return toDateTimeLocal(new Date(Date.now() + 10 * 60 * 1000));
}

function statusLabel(status: string): string {
  switch (status) {
    case "scheduled": return "Запланирована";
    case "processing": return "Отправляется";
    case "sent": return "Отправлена";
    case "failed": return "Ошибка";
    default: return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "sent": return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
    case "failed": return "border-destructive/20 bg-destructive/10 text-destructive";
    case "processing": return "border-amber-500/20 bg-amber-500/10 text-amber-600";
    default: return "border-primary/20 bg-primary/10 text-primary";
  }
}

// ─── Recipient Groups Panel ───────────────────────────────────────────────────

const CONDITION_FIELDS = [
  { value: "subscriptionActive", label: "Подписка активна", type: "boolean" },
  { value: "plan", label: "Тарифный план (slug)", type: "string" },
  { value: "joinedAfter", label: "Зарегистрировался после", type: "date" },
  { value: "joinedBefore", label: "Зарегистрировался до", type: "date" },
  { value: "minBalance", label: "Баланс от (руб)", type: "number" },
  { value: "maxBalance", label: "Баланс до (руб)", type: "number" },
];

function GroupsPanel({
  groups,
  onGroupCreated,
  onGroupDeleted,
  createGroup,
  deleteGroup,
}: {
  groups: AdminMailingRecipientGroup[];
  onGroupCreated: (g: AdminMailingRecipientGroup) => void;
  onGroupDeleted: (id: string) => void;
  createGroup: (name: string, conditions: MailingGroupCondition[]) => Promise<AdminMailingRecipientGroup>;
  deleteGroup: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<MailingGroupCondition[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCondition() {
    setConditions((prev) => [...prev, { field: "subscriptionActive", value: true }]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, partial: Partial<MailingGroupCondition>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...partial } : c)),
    );
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createGroup(name.trim(), conditions);
      onGroupCreated(created);
      setName("");
      setConditions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать группу");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/50 bg-background/60 p-4 space-y-3">
        <div className="text-sm font-semibold">Новая группа</div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название группы"
          className="h-10 rounded-xl border-border/60 bg-background shadow-none text-sm"
        />
        <div className="space-y-2">
          {conditions.map((cond, i) => {
            const field = CONDITION_FIELDS.find((f) => f.value === cond.field);
            return (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={cond.field}
                  onChange={(e) =>
                    updateCondition(i, {
                      field: e.target.value as MailingGroupCondition["field"],
                      value: e.target.value === "subscriptionActive" ? true : "",
                    })
                  }
                  className="flex-1 h-9 rounded-xl border border-border/60 bg-background px-3 text-xs"
                >
                  {CONDITION_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                {field?.type === "boolean" ? (
                  <select
                    value={String(cond.value)}
                    onChange={(e) => updateCondition(i, { value: e.target.value === "true" })}
                    className="w-24 h-9 rounded-xl border border-border/60 bg-background px-2 text-xs"
                  >
                    <option value="true">Да</option>
                    <option value="false">Нет</option>
                  </select>
                ) : (
                  <Input
                    value={String(cond.value)}
                    onChange={(e) =>
                      updateCondition(i, {
                        value: field?.type === "number" ? Number(e.target.value) : e.target.value,
                      })
                    }
                    type={field?.type === "date" ? "date" : field?.type === "number" ? "number" : "text"}
                    placeholder="Значение"
                    className="w-36 h-9 rounded-xl border-border/60 bg-background shadow-none text-xs"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeCondition(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="rounded-xl text-xs border-border/60 shadow-none"
          >
            <Plus className="h-3 w-3 mr-1" />
            Добавить условие
          </Button>
        </div>
        {error && <div className="text-xs text-destructive">{error}</div>}
        <Button
          type="button"
          size="sm"
          disabled={!name.trim() || saving}
          onClick={handleCreate}
          className="rounded-xl shadow-none text-xs"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Создать группу
        </Button>
      </div>

      {groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/60 px-4 py-2"
            >
              <div>
                <div className="text-sm font-semibold">{g.name}</div>
                <div className="text-xs text-muted-foreground">
                  ~{g.estimatedCount} получателей · {g.conditions.length} условий
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  deleteGroup(g.id).then(() => onGroupDeleted(g.id));
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mailing Detail Modal ─────────────────────────────────────────────────────

function MailingDetail({
  mailing,
  onClose,
}: {
  mailing: AdminMailingItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl border border-border/60 bg-card p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold text-lg">{mailing.title}</div>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-border/50 bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Отправлено</div>
            <div className="text-lg font-bold text-emerald-600">{mailing.sentCount}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Ошибок</div>
            <div className="text-lg font-bold text-destructive">{mailing.failedCount}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Заблокировали бота</div>
            <div className="text-lg font-bold text-amber-600">{mailing.blockedCount ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Кликов по кнопке</div>
            <div className="text-lg font-bold">{mailing.clickCount ?? 0}</div>
          </div>
        </div>

        {mailing.blockedUsers && mailing.blockedUsers.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Заблокировали бота
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {mailing.blockedUsers.map((u) => (
                <div key={u.id} className="text-sm text-amber-600 px-2">{u.login}</div>
              ))}
            </div>
          </div>
        )}

        {mailing.failedUsers && mailing.failedUsers.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Ошибки отправки
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {mailing.failedUsers.map((u) => (
                <div key={u.id} className="text-sm text-destructive px-2">{u.login}</div>
              ))}
            </div>
          </div>
        )}

        {mailing.lastError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {mailing.lastError}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminMailingsPage() {
  const {
    mailings,
    total,
    isLoading,
    isSubmitting,
    groups,
    fetchMailings,
    fetchMailing,
    fetchGroups,
    searchRecipients,
    createMailing,
    createGroup,
    deleteGroup,
    deleteMailing,
    sendTest,
    uploadImage,
  } = useAdminMailings();

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [buttons, setButtons] = useState<MailingButton[]>([]);
  const [targetType, setTargetType] = useState<"all" | "selected" | "group">("all");
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduledAt);
  const [recipientSearch, setRecipientSearch] = useState("");
  const deferredSearch = useDeferredValue(recipientSearch);
  const [recipients, setRecipients] = useState<AdminMailingRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [detailMailing, setDetailMailing] = useState<AdminMailingItem | null>(null);

  useEffect(() => {
    void fetchMailings(1, 10);
    void fetchGroups();
  }, [fetchMailings, fetchGroups]);

  useEffect(() => {
    if (targetType !== "selected") return;
    let disposed = false;
    void searchRecipients(deferredSearch).then((items) => {
      if (!disposed) setRecipients(items);
    });
    return () => { disposed = true; };
  }, [deferredSearch, searchRecipients, targetType]);

  const previewLines = useMemo(() => message.split("\n"), [message]);

  const selectedRecipients = useMemo(
    () => recipients.filter((r) => selectedIds.includes(r.id)),
    [recipients, selectedIds],
  );

  const canSubmit =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    scheduledAt.length > 0 &&
    (targetType !== "selected" || selectedIds.length > 0) &&
    (targetType !== "group" || selectedGroupId.length > 0);

  function toggleRecipient(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  function addButton() {
    setButtons((prev) => [...prev, { text: "", url: "" }]);
  }

  function removeButton(index: number) {
    setButtons((prev) => prev.filter((_, i) => i !== index));
  }

  function updateButton(index: number, partial: Partial<MailingButton>) {
    setButtons((prev) => prev.map((b, i) => (i === index ? { ...b, ...partial } : b)));
  }

  async function handleTestSend() {
    setFeedback(null);
    try {
      await sendTest({
        title,
        message,
        imageUrl: imageUrl.trim() || null,
        buttons: buttons.filter((b) => b.text.trim()),
      });
      setFeedback("Тестовое сообщение отправлено в Telegram.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Не удалось отправить тест.");
    }
  }

  async function handleCreate() {
    setFeedback(null);
    try {
      await createMailing({
        title: title.trim(),
        message: message.trim(),
        imageUrl: imageUrl.trim() || null,
        buttons: buttons.filter((b) => b.text.trim()),
        targetType,
        selectedUserIds: targetType === "selected" ? selectedIds : [],
        recipientGroupId: targetType === "group" ? selectedGroupId : null,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setFeedback("Рассылка поставлена в очередь.");
      setTitle("");
      setMessage("");
      setImageUrl("");
      setButtons([]);
      setTargetType("all");
      setSelectedIds([]);
      setSelectedGroupId("");
      setScheduledAt(getDefaultScheduledAt());
      await fetchMailings(1, 10);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Не удалось создать рассылку.");
    }
  }

  async function handleOpenDetail(mailing: AdminMailingItem) {
    if (mailing.status === "sent") {
      try {
        const detail = await fetchMailing(mailing.id);
        setDetailMailing(detail);
      } catch {
        setDetailMailing(mailing);
      }
    } else {
      setDetailMailing(mailing);
    }
  }

  return (
    <div className="space-y-8 pb-20">
      {detailMailing && (
        <MailingDetail mailing={detailMailing} onClose={() => setDetailMailing(null)} />
      )}

      <div className="space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <MessageSquareShare className="h-7 w-7 text-primary" />
          Рассылки в Telegram
        </h1>
        <p className="text-sm text-muted-foreground">
          Отправка всем или выбранным пользователям с изображениями, несколькими кнопками и группами получателей.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        {/* ─── Form ─────────────────────────────────────────── */}
        <div className="space-y-6 rounded-3xl border border-border/60 bg-card p-6">
          <div className="grid gap-4">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Заголовок</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Обновление приложения"
                className="h-11 rounded-xl border-border/60 bg-background shadow-none"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текст сообщения</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Текст поста для Telegram..."
                className="min-h-36 rounded-2xl border-border/60 bg-background shadow-none"
              />
            </div>

            {/* Image */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Image className="h-3 w-3" /> Изображение
              </label>
              <div className="flex gap-2">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg или загрузите файл →"
                  className="h-11 flex-1 rounded-xl border-border/60 bg-background shadow-none text-sm"
                />
                <label className={`inline-flex items-center justify-center h-11 px-4 rounded-xl border border-border/60 bg-background text-sm cursor-pointer hover:bg-accent transition-colors ${imageUploading ? "opacity-50 pointer-events-none" : ""}`}>
                  {imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImageUploading(true);
                      try {
                        const url = await uploadImage(file);
                        setImageUrl(url);
                      } catch (err) {
                        setFeedback(err instanceof Error ? err.message : "Ошибка загрузки");
                      } finally {
                        setImageUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Кнопки (до 5)
              </label>
              <div className="space-y-2">
                {buttons.map((btn, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={btn.text}
                      onChange={(e) => updateButton(i, { text: e.target.value })}
                      placeholder="Текст кнопки"
                      className="flex-1 h-10 rounded-xl border-border/60 bg-background shadow-none text-sm"
                    />
                    <Input
                      value={btn.url ?? ""}
                      onChange={(e) => updateButton(i, { url: e.target.value || null })}
                      placeholder="https://..."
                      className="flex-1 h-10 rounded-xl border-border/60 bg-background shadow-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeButton(i)}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {buttons.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addButton}
                    className="rounded-xl border-border/60 shadow-none text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Добавить кнопку
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Recipients + Scheduling */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Recipients */}
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" />
                Получатели
              </div>
              <div className="grid gap-2">
                {(["all", "selected", "group"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTargetType(type)}
                    className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      targetType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 bg-card"
                    }`}
                  >
                    <div className="font-semibold">
                      {type === "all" ? "Всем" : type === "selected" ? "Точечно" : "Группа"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {type === "all"
                        ? "Все с Telegram"
                        : type === "selected"
                        ? "Конкретные логины"
                        : "По условиям"}
                    </div>
                  </button>
                ))}
              </div>

              {targetType === "selected" && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      placeholder="Поиск по логину"
                      className="h-10 rounded-xl border-border/60 bg-card pl-10 shadow-none text-sm"
                    />
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                    {recipients.map((r) => {
                      const active = selectedIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleRecipient(r.id)}
                          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                            active ? "border-primary bg-primary/10" : "border-border/50 bg-card"
                          }`}
                        >
                          <span className="font-medium">{r.login}</span>
                          <span className="text-xs text-muted-foreground">{active ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedRecipients.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedRecipients.map((r) => (
                        <span key={r.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {r.login}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {targetType === "group" && (
                <div className="pt-1 space-y-2">
                  {groups.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Нет групп. Создайте группу ниже.
                    </div>
                  ) : (
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
                    >
                      <option value="">Выберите группу...</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} (~{g.estimatedCount})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Scheduling */}
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                Время отправки
              </div>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-10 rounded-xl border-border/60 bg-card shadow-none text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Время вашей временной зоны. Статус "Отправлена" выставляется если хотя бы один получатель принял сообщение.
              </p>
              <div className="rounded-xl border border-border/50 bg-card p-3 text-sm text-muted-foreground">
                Получателей:{" "}
                <span className="font-semibold text-foreground">
                  {targetType === "all"
                    ? "все подключённые"
                    : targetType === "selected"
                    ? selectedIds.length
                    : groups.find((g) => g.id === selectedGroupId)?.estimatedCount ?? "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Recipient Groups Manager */}
          <div className="rounded-2xl border border-border/50 bg-background/60">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
              onClick={() => setShowGroups((v) => !v)}
            >
              <span>Группы получателей</span>
              {showGroups ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showGroups && (
              <div className="border-t border-border/50 p-4">
                <GroupsPanel
                  groups={groups}
                  onGroupCreated={() => {}}
                  onGroupDeleted={() => {}}
                  createGroup={createGroup}
                  deleteGroup={deleteGroup}
                />
              </div>
            )}
          </div>

          {/* Actions */}
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
              Отправить тест в Telegram
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

        {/* ─── Preview + History ────────────────────────────── */}
        <div className="space-y-4">
          {/* Telegram Preview */}
          <div className="rounded-[28px] border border-border/60 bg-[linear-gradient(180deg,#1d2733_0%,#121922_100%)] p-4 text-white shadow-xl">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <div className="text-sm font-semibold">Telegram preview</div>
                <div className="text-xs text-white/60">Как увидит пользователь</div>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold">@lowkey_bot</div>
            </div>
            <div className="rounded-[24px] bg-[#18222d] p-3">
              <div className="rounded-[20px] bg-[#2a5278] overflow-hidden shadow-lg">
                {imageUrl && (
                  <div className="h-32 bg-white/10 flex items-center justify-center text-white/40 text-xs">
                    <Image className="h-8 w-8 opacity-40" />
                  </div>
                )}
                <div className="px-4 py-3">
                  <div className="text-sm font-semibold">{title || "Заголовок поста"}</div>
                  <div className="mt-2 space-y-1 text-sm leading-5 text-white/90">
                    {previewLines.length > 0 && message ? (
                      previewLines.map((line, i) => (
                        <p key={i}>{line || <span>&nbsp;</span>}</p>
                      ))
                    ) : (
                      <p className="text-white/55">Текст сообщения...</p>
                    )}
                  </div>
                  {buttons.filter((b) => b.text.trim()).map((btn, i) => (
                    <div
                      key={i}
                      className="mt-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-center text-sm font-semibold text-[#8cc8ff]"
                    >
                      {btn.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="rounded-3xl border border-border/60 bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">История</div>
                <div className="text-xs text-muted-foreground">Всего: {total}</div>
              </div>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="space-y-2">
              {mailings.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-border/50 bg-background/60 p-3 cursor-pointer hover:border-primary/40 transition"
                  onClick={() => handleOpenDetail(m)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{m.title}</div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(m.status)}`}>
                      {statusLabel(m.status)}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    <div>
                      {m.targetType === "all" ? "Всем" : m.targetType === "group" ? "Группа" : `Точечно: ${m.selectedUserIds.length}`}
                      {" · "}
                      {new Date(m.scheduledAt).toLocaleString("ru-RU")}
                    </div>
                    {m.status === "sent" && (
                      <div className="flex gap-3">
                        <span className="text-emerald-600">✓ {m.sentCount}</span>
                        {m.failedCount > 0 && <span className="text-destructive">✗ {m.failedCount}</span>}
                        {(m.blockedCount ?? 0) > 0 && <span className="text-amber-600">🚫 {m.blockedCount}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {mailings.length === 0 && !isLoading && (
                <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-sm text-muted-foreground text-center">
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
