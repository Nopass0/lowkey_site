const DISCARDED_EXACT_DOMAINS = new Set([
  "one.one.one.one",
]);

const DISCARDED_SUFFIXES = [
  ".deploy.static.akamaitechnologies.com",
  ".akamaiedge.net",
  ".akamaized.net",
  ".edgekey.net",
  ".edgesuite.net",
  ".cloudfront.net",
  ".amazonaws.com",
  ".azureedge.net",
  ".trafficmanager.net",
  ".fastly.net",
  ".fastlylb.net",
  ".hwcdn.net",
  ".cdn77.org",
  ".cdn77.com",
  ".aeza.network",
  ".your-server.de",
];

const DOMAIN_ALIASES: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\.1e100\.net$/i, value: "google.com" },
  { pattern: /\.googleusercontent\.com$/i, value: "google.com" },
  { pattern: /\.gvt1\.com$/i, value: "google.com" },
  { pattern: /\.ggpht\.com$/i, value: "google.com" },
  { pattern: /\.githubusercontent\.com$/i, value: "github.com" },
  { pattern: /\.github\.com$/i, value: "github.com" },
  { pattern: /\.fbcdn\.net$/i, value: "facebook.com" },
  { pattern: /\.facebook\.com$/i, value: "facebook.com" },
  { pattern: /\.cdninstagram\.com$/i, value: "instagram.com" },
  { pattern: /\.instagram\.com$/i, value: "instagram.com" },
  { pattern: /\.whatsapp\.net$/i, value: "whatsapp.com" },
  { pattern: /\.whatsapp\.com$/i, value: "whatsapp.com" },
  { pattern: /\.tcdn\.me$/i, value: "telegram.org" },
  { pattern: /\.telegram\.org$/i, value: "telegram.org" },
  { pattern: /\.discord(?:app)?\.com$/i, value: "discord.com" },
  { pattern: /\.discord\.gg$/i, value: "discord.gg" },
  { pattern: /\.twimg\.com$/i, value: "x.com" },
  { pattern: /\.x\.com$/i, value: "x.com" },
  { pattern: /\.twitter\.com$/i, value: "x.com" },
];

const MULTI_LABEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "com.tr",
  "co.jp",
  "co.kr",
  "co.id",
  "com.sg",
  "com.mx",
  "com.ar",
  "com.ua",
]);

export interface AdminDomainStatView {
  domain: string;
  visitCount: number;
  bytesTransferred: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  lastNetwork: string | null;
  lastPort: number | null;
  lastRemoteAddr: string | null;
  lastServerId: string | null;
  lastServerIp: string | null;
  sourceDomains: string[];
}

type RawDomainStat = {
  domain?: unknown;
  visitCount?: unknown;
  bytesTransferred?: unknown;
  firstVisitAt?: unknown;
  lastVisitAt?: unknown;
  lastNetwork?: unknown;
  lastPort?: unknown;
  lastRemoteAddr?: unknown;
  lastServerId?: unknown;
  lastServerIp?: unknown;
};

type AggregatedDomainStat = {
  domain: string;
  visitCount: number;
  bytesTransferred: number;
  firstVisitAt: Date | null;
  lastVisitAt: Date | null;
  lastNetwork: string | null;
  lastPort: number | null;
  lastRemoteAddr: string | null;
  lastServerId: string | null;
  lastServerIp: string | null;
  sourceDomains: Set<string>;
};

function normalizeDomain(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function toDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toRegistrableDomain(domain: string) {
  const labels = domain.split(".").filter(Boolean);
  if (labels.length < 2) {
    return null;
  }

  const lastTwo = labels.slice(-2).join(".");
  const lastThree = labels.slice(-3).join(".");
  if (labels.length >= 3 && MULTI_LABEL_SUFFIXES.has(lastTwo)) {
    return lastThree;
  }

  return lastTwo;
}

function toDisplayDomain(rawDomain: string) {
  if (!rawDomain) {
    return null;
  }
  if (DISCARDED_EXACT_DOMAINS.has(rawDomain)) {
    return null;
  }
  if (rawDomain.startsWith("ip-")) {
    return null;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(rawDomain)) {
    return null;
  }
  if (DISCARDED_SUFFIXES.some((suffix) => rawDomain.endsWith(suffix))) {
    return null;
  }

  for (const alias of DOMAIN_ALIASES) {
    if (alias.pattern.test(rawDomain)) {
      return alias.value;
    }
  }

  const registrableDomain = toRegistrableDomain(rawDomain);
  if (!registrableDomain) {
    return null;
  }
  if (
    DISCARDED_EXACT_DOMAINS.has(registrableDomain) ||
    DISCARDED_SUFFIXES.some((suffix) => registrableDomain.endsWith(suffix))
  ) {
    return null;
  }

  return registrableDomain;
}

export function buildAdminDomainStats(
  docs: RawDomainStat[],
): AdminDomainStatView[] {
  const grouped = new Map<string, AggregatedDomainStat>();

  for (const doc of docs) {
    const rawDomain = normalizeDomain(doc.domain);
    const displayDomain = toDisplayDomain(rawDomain);
    if (!displayDomain) {
      continue;
    }

    const firstVisitAt = toDate(doc.firstVisitAt);
    const lastVisitAt = toDate(doc.lastVisitAt);
    const visitCount = toNumber(doc.visitCount);
    const bytesTransferred = toNumber(doc.bytesTransferred);
    const lastPort =
      doc.lastPort == null ? null : Number.isFinite(Number(doc.lastPort)) ? Number(doc.lastPort) : null;

    const current = grouped.get(displayDomain);
    if (!current) {
      grouped.set(displayDomain, {
        domain: displayDomain,
        visitCount,
        bytesTransferred,
        firstVisitAt,
        lastVisitAt,
        lastNetwork: doc.lastNetwork ? String(doc.lastNetwork) : null,
        lastPort,
        lastRemoteAddr: doc.lastRemoteAddr ? String(doc.lastRemoteAddr) : null,
        lastServerId: doc.lastServerId ? String(doc.lastServerId) : null,
        lastServerIp: doc.lastServerIp ? String(doc.lastServerIp) : null,
        sourceDomains: new Set(rawDomain ? [rawDomain] : []),
      });
      continue;
    }

    current.visitCount += visitCount;
    current.bytesTransferred += bytesTransferred;
    current.sourceDomains.add(rawDomain);

    if (
      firstVisitAt &&
      (!current.firstVisitAt || firstVisitAt.getTime() < current.firstVisitAt.getTime())
    ) {
      current.firstVisitAt = firstVisitAt;
    }

    const incomingLastVisitAt = lastVisitAt?.getTime() ?? 0;
    const currentLastVisitAt = current.lastVisitAt?.getTime() ?? 0;
    if (incomingLastVisitAt >= currentLastVisitAt) {
      current.lastVisitAt = lastVisitAt;
      current.lastNetwork = doc.lastNetwork ? String(doc.lastNetwork) : null;
      current.lastPort = lastPort;
      current.lastRemoteAddr = doc.lastRemoteAddr
        ? String(doc.lastRemoteAddr)
        : null;
      current.lastServerId = doc.lastServerId ? String(doc.lastServerId) : null;
      current.lastServerIp = doc.lastServerIp ? String(doc.lastServerIp) : null;
    }
  }

  return Array.from(grouped.values())
    .map((item) => ({
      domain: item.domain,
      visitCount: item.visitCount,
      bytesTransferred: item.bytesTransferred,
      firstVisitAt: item.firstVisitAt?.toISOString() ?? null,
      lastVisitAt: item.lastVisitAt?.toISOString() ?? null,
      lastNetwork: item.lastNetwork,
      lastPort: item.lastPort,
      lastRemoteAddr: item.lastRemoteAddr,
      lastServerId: item.lastServerId,
      lastServerIp: item.lastServerIp,
      sourceDomains: Array.from(item.sourceDomains)
        .sort((left, right) => left.localeCompare(right))
        .slice(0, 12),
    }))
    .sort((left, right) => {
      const leftTs = left.lastVisitAt ? new Date(left.lastVisitAt).getTime() : 0;
      const rightTs = right.lastVisitAt
        ? new Date(right.lastVisitAt).getTime()
        : 0;
      if (rightTs !== leftTs) {
        return rightTs - leftTs;
      }
      return right.visitCount - left.visitCount;
    });
}
