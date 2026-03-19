"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  Calendar,
  Check,
  Filter,
  Loader2,
  Pencil,
  Search,
  Shield,
  ShieldBan,
  Users,
  X,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TablePagination } from "@/components/ui/table-pagination";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import type { AdminUserFilters } from "@/api/types";

const PAGE_SIZE = 8;

interface PlanOption {
  slug: string;
  name: string;
}

function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return "Нет подписки";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Некорректная дата";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseTriState(value: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export default function AdminUsersPage() {
  const {
    users,
    total,
    isLoading,
    fetchUsers,
    toggleBan,
    updateSubscription,
    updateBalance,
    updatePreferences,
  } = useAdminUsers();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState<string>("");
  const [editDateTime, setEditDateTime] = useState("");
  const [editBalance, setEditBalance] = useState(0);
  const [editRefBalance, setEditRefBalance] = useState(0);
  const [editHideAiMenu, setEditHideAiMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [filters, setFilters] = useState({
    isBanned: "all",
    hasSubscription: "all",
    hideAiMenu: "all",
    plan: "all",
  });

  const appliedFilters = useMemo<AdminUserFilters>(
    () => ({
      search: search.trim() || undefined,
      isBanned: parseTriState(filters.isBanned),
      hasSubscription: parseTriState(filters.hasSubscription),
      hideAiMenu: parseTriState(filters.hideAiMenu),
      plan: filters.plan !== "all" ? filters.plan : undefined,
    }),
    [filters, search],
  );

  useEffect(() => {
    void fetchUsers(page, PAGE_SIZE, appliedFilters);
  }, [page, appliedFilters, fetchUsers]);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      try {
        const plans = await apiClient.get<
          Array<{ slug: string; name: string; isActive: boolean }>
        >("/admin/tariffs");

        if (!cancelled) {
          setPlanOptions(
            plans
              .filter((plan) => plan.isActive)
              .map((plan) => ({ slug: plan.slug, name: plan.name })),
          );
        }
      } catch {
        if (!cancelled) {
          setPlanOptions([]);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const startEdit = (user: {
    id: string;
    plan: string | null;
    activeUntil: string | null;
    balance: number;
    referralBalance: number;
    hideAiMenu: boolean;
  }) => {
    setEditId(user.id);
    setEditPlan(user.plan ?? "");
    setEditDateTime(toDatetimeLocalValue(user.activeUntil));
    setEditBalance(user.balance);
    setEditRefBalance(user.referralBalance);
    setEditHideAiMenu(user.hideAiMenu);
  };

  const saveEdit = async (id: string) => {
    setIsSaving(true);
    try {
      await Promise.all([
        updateSubscription(id, editPlan || null, fromDatetimeLocalValue(editDateTime)),
        updateBalance(id, editBalance, editRefBalance),
        updatePreferences(id, editHideAiMenu),
      ]);
      setEditId(null);
    } catch {
      // Keep the editor open so the admin can adjust the values.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Users className="h-7 w-7 text-primary" />
            Пользователи
          </h1>
          <p className="mt-1 text-muted-foreground">Всего: {total}</p>
        </div>

        <div className="grid w-full gap-3 xl:max-w-5xl xl:grid-cols-[minmax(240px,1.4fr)_repeat(4,minmax(140px,1fr))]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по логину или ID"
              className="h-10 rounded-xl border-border/60 bg-card pl-10 shadow-none"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            value={filters.isBanned}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, isBanned: event.target.value }));
              setPage(1);
            }}
            className="h-10 rounded-xl border border-border/60 bg-card px-3 text-sm outline-none"
          >
            <option value="all">Бан: все</option>
            <option value="true">Только забаненные</option>
            <option value="false">Только активные</option>
          </select>

          <select
            value={filters.hasSubscription}
            onChange={(event) => {
              setFilters((prev) => ({
                ...prev,
                hasSubscription: event.target.value,
              }));
              setPage(1);
            }}
            className="h-10 rounded-xl border border-border/60 bg-card px-3 text-sm outline-none"
          >
            <option value="all">Подписка: все</option>
            <option value="true">С подпиской</option>
            <option value="false">Без подписки</option>
          </select>

          <select
            value={filters.hideAiMenu}
            onChange={(event) => {
              setFilters((prev) => ({
                ...prev,
                hideAiMenu: event.target.value,
              }));
              setPage(1);
            }}
            className="h-10 rounded-xl border border-border/60 bg-card px-3 text-sm outline-none"
          >
            <option value="all">AI меню: все</option>
            <option value="true">Скрыто</option>
            <option value="false">Показано</option>
          </select>

          <select
            value={filters.plan}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, plan: event.target.value }));
              setPage(1);
            }}
            className="h-10 rounded-xl border border-border/60 bg-card px-3 text-sm outline-none"
          >
            <option value="all">Тариф: все</option>
            {planOptions.map((plan) => (
              <option key={plan.slug} value={plan.slug}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_140px_180px] gap-4 border-b border-border/40 bg-muted/30 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <div>Пользователь</div>
          <div>Подписка и AI</div>
          <div>Баланс</div>
          <div>Действия</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Загрузка...
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {users.map((user, index) => (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`border-b border-border/40 last:border-b-0 ${
                  user.isBanned ? "bg-destructive/5" : ""
                }`}
              >
                <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_140px_180px] gap-4 px-5 py-4 items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">
                        {user.login}
                      </span>
                      {user.isBanned ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-black text-destructive">
                          БАН
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      ID: {user.id}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      с{" "}
                      {new Date(user.joinedAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {user.plan ? (
                      <div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                          {planOptions.find((plan) => plan.slug === user.plan)?.name ??
                            user.plan}
                        </span>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          до {formatDateTime(user.activeUntil)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Нет подписки
                      </span>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Filter className="h-3 w-3" />
                      AI в меню: {user.hideAiMenu ? "скрыт" : "показан"}
                    </div>
                  </div>

                  <div className="text-sm font-bold tabular-nums">
                    <div>{user.balance} ₽</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Реф: {user.referralBalance}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/me/admin/users/${user.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-border/60 px-3 shadow-none"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-border/60 px-3 shadow-none"
                      onClick={() => startEdit(user)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant={user.isBanned ? "outline" : "destructive"}
                      className="h-8 rounded-lg px-3"
                      onClick={() => void toggleBan(user.id)}
                    >
                      {user.isBanned ? (
                        <Shield className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldBan className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {editId === user.id ? (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/40 bg-muted/20 px-5 pb-4 pt-0">
                        <div className="flex flex-col gap-3 pt-4">
                          <div className="grid gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(220px,1.1fr)_120px_120px_180px]">
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Тариф
                              </label>
                              <select
                                value={editPlan}
                                onChange={(event) => setEditPlan(event.target.value)}
                                className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none"
                              >
                                <option value="">Без подписки</option>
                                {planOptions.map((plan) => (
                                  <option key={plan.slug} value={plan.slug}>
                                    {plan.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Активна до
                              </label>
                              <Input
                                type="datetime-local"
                                value={editDateTime}
                                onChange={(event) =>
                                  setEditDateTime(event.target.value)
                                }
                                className="h-10 rounded-xl border-border/60 bg-background shadow-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Баланс
                              </label>
                              <Input
                                type="number"
                                value={editBalance}
                                onChange={(event) =>
                                  setEditBalance(parseFloat(event.target.value) || 0)
                                }
                                className="h-10 rounded-xl border-border/60 bg-background px-2 font-mono text-sm shadow-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Реф
                              </label>
                              <Input
                                type="number"
                                value={editRefBalance}
                                onChange={(event) =>
                                  setEditRefBalance(
                                    parseFloat(event.target.value) || 0,
                                  )
                                }
                                className="h-10 rounded-xl border-border/60 bg-background px-2 font-mono text-sm shadow-none"
                              />
                            </div>

                            <div className="flex items-end">
                              <label className="flex h-10 w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 text-sm">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                  Скрыть AI в меню
                                </span>
                                <Switch
                                  checked={editHideAiMenu}
                                  onCheckedChange={setEditHideAiMenu}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => void saveEdit(user.id)}
                              className="rounded-xl"
                              disabled={isSaving}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Сохранить
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditId(null)}
                              className="rounded-xl"
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!users.length && !isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Пользователи не найдены
          </div>
        ) : null}

        <div className="px-5 pb-4">
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </div>
      </div>
    </div>
  );
}
