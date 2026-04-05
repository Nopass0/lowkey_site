"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  ShieldOff,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Globe,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "motion/react";
import { useAdminBlockedDomains } from "@/hooks/useAdminBlockedDomains";
import type { AdminBlockedDomain } from "@/api/types";

const DEFAULT_REDIRECT = "https://lowkey.su/blocked";

// ─── Edit Row ────────────────────────────────────────────────────────────────

function EditRow({
  domain,
  onSave,
  onCancel,
}: {
  domain: AdminBlockedDomain;
  onSave: (payload: { reason?: string | null; redirectUrl?: string | null }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState(domain.reason ?? "");
  const [redirectUrl, setRedirectUrl] = useState(domain.redirectUrl ?? "");

  return (
    <tr className="bg-zinc-800/60">
      <td className="px-4 py-2 font-mono text-sm text-white">{domain.domain}</td>
      <td className="px-4 py-2">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина блокировки"
          className="h-8 text-sm bg-zinc-700 border-zinc-600"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
          placeholder={DEFAULT_REDIRECT}
          className="h-8 text-sm bg-zinc-700 border-zinc-600"
        />
      </td>
      <td className="px-4 py-2 text-center">—</td>
      <td className="px-4 py-2">
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-green-400 hover:text-green-300"
            onClick={() =>
              onSave({
                reason: reason.trim() || null,
                redirectUrl: redirectUrl.trim() || null,
              })
            }
          >
            <Check size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
            onClick={onCancel}
          >
            <X size={14} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Domain Row ───────────────────────────────────────────────────────────────

function DomainRow({
  domain,
  onToggle,
  onEdit,
  onDelete,
}: {
  domain: AdminBlockedDomain;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
      <td className="px-4 py-3 font-mono text-sm text-white">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-zinc-500 shrink-0" />
          {domain.domain}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-300 max-w-xs truncate">
        {domain.reason ?? <span className="text-zinc-600 italic">не указана</span>}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400 max-w-xs truncate font-mono">
        {domain.redirectUrl ?? (
          <span className="text-zinc-600 italic">{DEFAULT_REDIRECT}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={onToggle}
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
            domain.isActive
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
          }`}
        >
          {domain.isActive ? (
            <>
              <ShieldOff size={10} />
              блок
            </>
          ) : (
            <>
              <Shield size={10} />
              откл
            </>
          )}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
            onClick={onEdit}
            title="Редактировать"
          >
            <Edit2 size={13} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400"
            onClick={onDelete}
            title="Удалить"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddForm({ onAdd }: { onAdd: (payload: { domain: string; reason?: string | null; redirectUrl?: string | null }) => Promise<unknown> }) {
  const [domain, setDomain] = useState("");
  const [reason, setReason] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = domain.trim();
    if (!trimmed) return;
    setError("");
    setLoading(true);
    try {
      await onAdd({
        domain: trimmed,
        reason: reason.trim() || null,
        redirectUrl: redirectUrl.trim() || null,
      });
      setDomain("");
      setReason("");
      setRedirectUrl("");
    } catch (err: any) {
      setError(err?.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-6"
    >
      <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
        <Plus size={15} className="text-red-400" />
        Заблокировать домен
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <Label className="text-xs text-zinc-400 mb-1">Домен *</Label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="bg-zinc-800 border-zinc-700 font-mono text-sm"
            required
          />
        </div>
        <div>
          <Label className="text-xs text-zinc-400 mb-1">Причина</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Заблокировано в вашем регионе"
            className="bg-zinc-800 border-zinc-700 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-zinc-400 mb-1">Редирект URL</Label>
          <Input
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
            placeholder={DEFAULT_REDIRECT}
            className="bg-zinc-800 border-zinc-700 text-sm font-mono"
          />
        </div>
      </div>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={loading || !domain.trim()}
          className="bg-red-500 hover:bg-red-600 text-white h-8 text-sm"
        >
          {loading ? "Добавление..." : "Заблокировать"}
        </Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlockedDomainsPage() {
  const {
    domains,
    isLoading,
    fetchDomains,
    createDomain,
    updateDomain,
    deleteDomain,
  } = useAdminBlockedDomains();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const filtered = domains.filter((d) => {
    if (filter === "active" && !d.isActive) return false;
    if (filter === "inactive" && d.isActive) return false;
    if (search && !d.domain.includes(search.toLowerCase())) return false;
    return true;
  });

  const handleToggle = async (domain: AdminBlockedDomain) => {
    await updateDomain(domain.id, { isActive: !domain.isActive });
  };

  const handleSaveEdit = async (
    id: string,
    payload: { reason?: string | null; redirectUrl?: string | null },
  ) => {
    await updateDomain(id, payload);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить домен из списка блокировок?")) return;
    await deleteDomain(id);
  };

  const activeCount = domains.filter((d) => d.isActive).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-red-400" size={22} />
            Блокировка доменов
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Заблокированные домены редиректятся на страницу с баннером при попытке подключения через VPN
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-red-400">{activeCount}</div>
          <div className="text-xs text-zinc-500">активных блокировок</div>
        </div>
      </div>

      {/* Add form */}
      <AddForm onAdd={createDomain} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по домену..."
          className="bg-zinc-900 border-zinc-700 text-sm max-w-xs"
        />
        <div className="flex gap-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                filter === f
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f === "all" ? "Все" : f === "active" ? "Активные" : "Отключённые"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-zinc-500 text-sm">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Shield size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">
              {domains.length === 0
                ? "Список блокировок пуст"
                : "Нет совпадений"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Домен</th>
                  <th className="px-4 py-3 text-left">Причина</th>
                  <th className="px-4 py-3 text-left">Редирект</th>
                  <th className="px-4 py-3 text-center">Статус</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((domain) =>
                    editingId === domain.id ? (
                      <EditRow
                        key={domain.id}
                        domain={domain}
                        onSave={(payload) => handleSaveEdit(domain.id, payload)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <motion.tr
                        key={domain.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-sm text-white">
                          <div className="flex items-center gap-2">
                            <Globe size={14} className="text-zinc-500 shrink-0" />
                            {domain.domain}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-300 max-w-xs truncate">
                          {domain.reason ?? (
                            <span className="text-zinc-600 italic">не указана</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400 max-w-xs truncate font-mono">
                          {domain.redirectUrl ?? (
                            <span className="text-zinc-600 italic">
                              {DEFAULT_REDIRECT}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggle(domain)}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                              domain.isActive
                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                            }`}
                          >
                            {domain.isActive ? (
                              <>
                                <ShieldOff size={10} />
                                блок
                              </>
                            ) : (
                              <>
                                <Shield size={10} />
                                откл
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
                              onClick={() => setEditingId(domain.id)}
                              title="Редактировать"
                            >
                              <Edit2 size={13} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400"
                              onClick={() => handleDelete(domain.id)}
                              title="Удалить"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ),
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-500">
        <p className="font-medium text-zinc-400 mb-1">Как это работает</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>VPN-серверы (hysteria) периодически загружают список активных блокировок</li>
          <li>При попытке подключения к заблокированному домену — редирект на указанный URL</li>
          <li>По умолчанию редирект на <span className="font-mono text-zinc-400">{DEFAULT_REDIRECT}</span></li>
          <li>Отключение блокировки (статус «откл») не удаляет запись, просто деактивирует её</li>
        </ul>
      </div>
    </div>
  );
}
