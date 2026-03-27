"use client";

import { useMemo, useState } from "react";
import { Globe, TrendingUp, ArrowUpRight, Search, ChevronDown } from "lucide-react";
import { AdminUserDomainStat } from "@/api/types";
import { Input } from "@/components/ui/input";

function formatBytes(v: number) {
  if (!v || v <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let n = v, i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 || n >= 100 ? 0 : 1)} ${u[i]}`;
}

// Rough category classifier by known TLDs / keywords
function classifyDomain(domain: string): { label: string; color: string } {
  const d = domain.toLowerCase();
  if (/youtube|tiktok|twitch|vimeo|rutube|kinopoi|okko|ivi\.ru/.test(d))
    return { label: "Видео", color: "bg-red-500/15 text-red-400 border-red-500/20" };
  if (/vk\.com|ok\.ru|instagram|facebook|twitter|telegram|whatsapp|discord|snapchat/.test(d))
    return { label: "Соцсети", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" };
  if (/google|yandex|bing|duckduckgo|baidu/.test(d))
    return { label: "Поиск", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" };
  if (/netflix|spotify|apple\.com|steam|epic|gog\.com|play\.google/.test(d))
    return { label: "Стриминг", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" };
  if (/amazon|aliexpress|ozon|wildberries|avito|ebay/.test(d))
    return { label: "Шопинг", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" };
  if (/github|stackoverflow|gitlab|npmjs|pypi|docs\./.test(d))
    return { label: "Dev", color: "bg-green-500/15 text-green-400 border-green-500/20" };
  if (/news|lenta|rbc|ria|interfax|bbc|cnn|reuters/.test(d))
    return { label: "Новости", color: "bg-sky-500/15 text-sky-400 border-sky-500/20" };
  return { label: "Другое", color: "bg-muted/50 text-muted-foreground border-border/50" };
}

interface Props {
  domains: AdminUserDomainStat[];
}

const PAGE_SIZE = 20;

export function DomainStats({ domains }: Props) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const totalVisits = useMemo(
    () => domains.reduce((a, d) => a + d.visitCount, 0),
    [domains],
  );
  const totalBytes = useMemo(
    () => domains.reduce((a, d) => a + d.bytesTransferred, 0),
    [domains],
  );

  const filtered = useMemo(
    () =>
      search.trim()
        ? domains.filter((d) =>
            d.domain.toLowerCase().includes(search.trim().toLowerCase()),
          )
        : domains,
    [domains, search],
  );

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);

  // Category breakdown for mini chart
  const categories = useMemo(() => {
    const map: Record<string, { visits: number; bytes: number }> = {};
    for (const d of domains) {
      const { label } = classifyDomain(d.domain);
      if (!map[label]) map[label] = { visits: 0, bytes: 0 };
      map[label].visits += d.visitCount;
      map[label].bytes += d.bytesTransferred;
    }
    return Object.entries(map)
      .map(([label, v]) => ({ label, ...v, pct: Math.round((v.visits / totalVisits) * 100) }))
      .sort((a, b) => b.visits - a.visits);
  }, [domains, totalVisits]);

  if (!domains.length) return null;

  return (
    <div className="bg-card border border-border/60 rounded-[2.5rem] overflow-hidden">
      {/* ── Header ── */}
      <div className="px-8 pt-8 pb-6 border-b border-border/40">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Globe className="w-5 h-5 text-violet-400" />
              Посещённые сайты
            </h3>
            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">
              SNI-статистика · {domains.length} доменов · {totalVisits.toLocaleString("ru")} визитов
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm font-bold">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              {totalVisits.toLocaleString("ru")} req
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              {formatBytes(totalBytes)}
            </span>
          </div>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {categories.map((cat) => {
              const { color } = classifyDomain(cat.label === "Другое" ? "" : cat.label);
              return (
                <span
                  key={cat.label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${color}`}
                >
                  {cat.label}
                  <span className="opacity-70">{cat.pct}%</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Category breakdown bar ── */}
      {totalVisits > 0 && (
        <div className="px-8 py-4 border-b border-border/30">
          <div className="flex h-2 rounded-full overflow-hidden gap-px">
            {categories.map((cat) => {
              const colors: Record<string, string> = {
                "Видео": "bg-red-500",
                "Соцсети": "bg-blue-500",
                "Поиск": "bg-yellow-500",
                "Стриминг": "bg-purple-500",
                "Шопинг": "bg-orange-500",
                "Dev": "bg-green-500",
                "Новости": "bg-sky-500",
                "Другое": "bg-muted-foreground/40",
              };
              return (
                <div
                  key={cat.label}
                  className={`${colors[cat.label] ?? "bg-muted"} transition-all`}
                  style={{ width: `${cat.pct}%`, minWidth: cat.pct > 0 ? "2px" : 0 }}
                  title={`${cat.label}: ${cat.pct}%`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="px-8 py-4 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Поиск по домену…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/30 border-border/40 text-sm font-medium"
          />
        </div>
      </div>

      {/* ── Domain list ── */}
      <div className="divide-y divide-border/30">
        {visible.map((d, i) => {
          const pct = totalVisits > 0 ? (d.visitCount / totalVisits) * 100 : 0;
          const cat = classifyDomain(d.domain);
          const faviconURL = `https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`;

          return (
            <div
              key={d.domain}
              className="flex items-center gap-4 px-8 py-3.5 hover:bg-muted/20 transition-colors group"
            >
              {/* rank */}
              <span className="text-xs font-black text-muted-foreground/30 w-5 text-right shrink-0 tabular-nums">
                {i + 1}
              </span>

              {/* favicon */}
              <div className="relative w-8 h-8 shrink-0">
                <img
                  src={faviconURL}
                  alt=""
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-lg object-contain"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = "none";
                    const fb = el.nextElementSibling as HTMLElement | null;
                    if (fb) fb.style.display = "flex";
                  }}
                />
                {/* fallback icon */}
                <div
                  className="absolute inset-0 rounded-lg bg-muted/50 items-center justify-center text-xs font-black text-muted-foreground hidden"
                  aria-hidden
                >
                  {d.domain.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* domain + bar */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`https://${d.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold truncate hover:text-violet-400 transition-colors"
                  >
                    {d.domain}
                  </a>
                  <span
                    className={`hidden sm:inline-flex shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${cat.color}`}
                  >
                    {cat.label}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500/60 transition-all"
                    style={{ width: `${Math.max(pct, pct > 0 ? 0.5 : 0)}%` }}
                  />
                </div>
              </div>

              {/* stats */}
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-sm font-black tabular-nums">
                  {d.visitCount.toLocaleString("ru")}
                  <span className="text-xs font-bold text-muted-foreground ml-1">req</span>
                </p>
                <p className="text-xs font-bold text-muted-foreground tabular-nums">
                  {formatBytes(d.bytesTransferred)}
                </p>
              </div>

              {/* percent badge */}
              <div className="w-12 text-right shrink-0">
                <span className="text-xs font-black tabular-nums text-muted-foreground/70">
                  {pct.toFixed(pct < 1 ? 1 : 0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Show more ── */}
      {filtered.length > PAGE_SIZE && (
        <div className="px-8 py-5 border-t border-border/30 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showAll ? "rotate-180" : ""}`}
            />
            {showAll
              ? "Свернуть"
              : `Показать ещё ${filtered.length - PAGE_SIZE} доменов`}
          </button>
        </div>
      )}

      {filtered.length === 0 && search && (
        <div className="px-8 py-10 text-center text-sm text-muted-foreground italic">
          Домены по запросу «{search}» не найдены
        </div>
      )}
    </div>
  );
}
