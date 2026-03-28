"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

interface Props {
  domain: string;
  className?: string;
}

function buildFaviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=https://${encodeURIComponent(domain)}`;
}

export function SiteFavicon({ domain, className = "h-10 w-10 rounded-xl" }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} flex items-center justify-center border border-border/60 bg-muted/30 text-muted-foreground`}
      >
        <Globe className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={buildFaviconUrl(domain)}
      alt=""
      className={`${className} border border-border/60 bg-background object-cover`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
