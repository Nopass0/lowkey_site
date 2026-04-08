"use client";
import React, { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PatternType = "dots" | "grid" | "diagonal" | "hexagons" | "waves" | "circuit" | "cross" | "topography";

export function getPatternStyle(pattern: PatternType, color: string): React.CSSProperties {
  const c = (opacity: number) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
  switch (pattern) {
    case "dots":
      return {
        backgroundImage: `radial-gradient(circle, ${c(0.35)} 1.5px, transparent 1.5px)`,
        backgroundSize: "22px 22px",
      };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${c(0.12)} 1px, transparent 1px), linear-gradient(90deg, ${c(0.12)} 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      };
    case "diagonal":
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${c(0.12)} 0px, ${c(0.12)} 1px, transparent 0px, transparent 50%)`,
        backgroundSize: "10px 10px",
      };
    case "cross":
      return {
        backgroundImage: `radial-gradient(${c(0.3)} 1px, transparent 1px), radial-gradient(${c(0.3)} 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 10px 10px",
      };
    case "waves":
      return {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='24'><path d='M0 12 Q20 2 40 12 Q60 22 80 12' stroke='${color}' stroke-opacity='0.25' stroke-width='1.5' fill='none'/></svg>`
        )}")`,
        backgroundSize: "80px 24px",
      };
    case "circuit":
      return {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><path d='M10 10 h40 v10 h-10 v20 h-20 v-10 h-10 Z' stroke='${color}' stroke-opacity='0.18' stroke-width='1' fill='none'/><circle cx='10' cy='10' r='2' fill='${color}' opacity='0.2'/><circle cx='50' cy='10' r='2' fill='${color}' opacity='0.2'/><circle cx='50' cy='40' r='2' fill='${color}' opacity='0.2'/></svg>`
        )}")`,
        backgroundSize: "60px 60px",
      };
    case "hexagons":
      return {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='52' height='60'><polygon points='26,2 50,15 50,45 26,58 2,45 2,15' stroke='${color}' stroke-opacity='0.18' stroke-width='1.5' fill='none'/></svg>`
        )}")`,
        backgroundSize: "52px 60px",
      };
    case "topography":
    default:
      return {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><path d='M10,50 Q25,20 50,50 Q75,80 90,50' stroke='${color}' stroke-opacity='0.15' stroke-width='1' fill='none'/><path d='M0,70 Q30,40 60,70 Q80,90 100,70' stroke='${color}' stroke-opacity='0.1' stroke-width='1' fill='none'/></svg>`
        )}")`,
        backgroundSize: "100px 100px",
      };
  }
}

const PATTERNS: PatternType[] = ["dots", "grid", "diagonal", "cross", "waves", "circuit", "hexagons", "topography"];

export function getPatternForId(id: string): PatternType {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return PATTERNS[Math.abs(hash) % PATTERNS.length];
}

interface PatternHeaderProps {
  color: string;
  imageUrl?: string | null;
  pattern?: PatternType;
  height?: number;
  children?: React.ReactNode;
  onImageUpload?: (file: File) => Promise<void>;
  uploading?: boolean;
  className?: string;
}

export function PatternHeader({
  color,
  imageUrl,
  pattern = "dots",
  height = 160,
  children,
  onImageUpload,
  uploading,
  className,
}: PatternHeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;
    await onImageUpload(file);
    if (e.target) e.target.value = "";
  };

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl", className)}
      style={{ height, minHeight: height }}
    >
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${color}cc 0%, ${color}66 50%, ${color}33 100%)`,
        }}
      />
      {/* Radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 85% 30%, ${color}55 0%, transparent 65%)`,
        }}
      />
      {/* Pattern overlay */}
      <div
        className="absolute inset-0 opacity-100"
        style={getPatternStyle(pattern, "#ffffff")}
      />
      {/* Image overlay */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
      )}
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative h-full">{children}</div>

      {/* Upload button */}
      {onImageUpload && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/80 text-xs backdrop-blur-sm transition-colors border border-white/10"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            Фото
          </button>
        </>
      )}
    </div>
  );
}
