"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Loader2, Search, Send, User, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/api/client";
import type { AdminUser } from "@/api/types";

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; sent?: number; error?: string } | null>(null);

  // ── User search ─────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const data = await apiClient.get<{ items: AdminUser[]; total: number }>(
        "/admin/users",
        { search: q, pageSize: 8, page: 1 },
      );
      setSearchResults(data.items ?? []);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleSearchInput(v: string) {
    setSearchQuery(v);
    if (selectedUser) setSelectedUser(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchUsers(v), 300);
  }

  function selectUser(u: AdminUser) {
    setSelectedUser(u);
    setSearchQuery(u.login);
    setShowDropdown(false);
    setSearchResults([]);
  }

  function clearUser() {
    setSelectedUser(null);
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function send(toAll: boolean) {
    if (!title.trim() || !message.trim()) return;
    if (!toAll && !selectedUser) return;

    setIsLoading(true);
    setResult(null);
    try {
      const data = await apiClient.post<{ ok: boolean; sent?: number }>(
        "/admin/notifications/send",
        {
          title: title.trim(),
          message: message.trim(),
          userIds: toAll ? undefined : [selectedUser!.id],
        },
      );
      setResult({ ok: true, sent: data.sent });
      setTitle("");
      setMessage("");
      clearUser();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ ok: false, error: msg });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
          <Bell className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Push-уведомления</h1>
          <p className="text-muted-foreground text-sm">
            Отправка уведомлений пользователям Android-приложения
          </p>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-[2rem] p-8 space-y-6">
        {/* Title */}
        <div className="space-y-3">
          <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Заголовок
          </label>
          <Input
            placeholder="Заголовок уведомления"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Message */}
        <div className="space-y-3">
          <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Текст
          </label>
          <Textarea
            placeholder="Текст уведомления..."
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {/* User search */}
        <div className="space-y-3" ref={searchRef}>
          <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Получатель (пусто = всем)
          </label>
          <div className="relative">
            <div className="relative flex items-center">
              {isSearching ? (
                <Loader2 className="absolute left-3 w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
              )}
              <Input
                className="pl-9 pr-9"
                placeholder="Поиск по логину..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              />
              {(searchQuery || selectedUser) && (
                <button
                  onClick={clearUser}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); selectUser(u); }}
                  >
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{u.login}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.id}</p>
                    </div>
                    {u.plan && (
                      <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                        {u.plan}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              Выбран: <span className="font-semibold text-foreground">{selectedUser.login}</span>
              <span className="text-xs opacity-60">({selectedUser.id})</span>
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              result.ok
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}
          >
            {result.ok
              ? `✓ Отправлено ${result.sent} пользователям`
              : `✗ ${result.error}`}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            className="flex-1 gap-2"
            disabled={isLoading || !title.trim() || !message.trim() || !selectedUser}
            onClick={() => send(false)}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
            Отправить пользователю
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            disabled={isLoading || !title.trim() || !message.trim()}
            onClick={() => send(true)}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Отправить всем
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-[2rem] p-6">
        <p className="text-sm text-muted-foreground">
          <strong>Как работает:</strong> Уведомления доставляются через polling — приложение
          проверяет сервер каждые ~60 секунд пока открыто, или каждые 15 минут в фоне.
          Пользователь увидит уведомление в статусной строке Android.
        </p>
      </div>
    </div>
  );
}
