"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextMenuAction {
  label: string;
  icon: React.ElementType;
  action: () => void;
  danger?: boolean;
  divider?: boolean;
  submenu?: ContextMenuAction[];
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuAction[];
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, items: [] });

  const open = (e: React.MouseEvent, items: ContextMenuAction[]) => {
    e.preventDefault();
    e.stopPropagation();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = 220;
    const menuH = items.length * 38 + 16;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuW > vw) x = vw - menuW - 8;
    if (y + menuH > vh) y = vh - menuH - 8;
    setMenu({ visible: true, x, y, items });
  };

  const close = () => setMenu(s => ({ ...s, visible: false }));

  return { menu, open, close };
}

export function ContextMenuPortal({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [submenuIdx, setSubmenuIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!menu.visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menu.visible, onClose]);

  useEffect(() => {
    if (!menu.visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menu.visible, onClose]);

  return (
    <AnimatePresence>
      {menu.visible && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.94, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -4 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="fixed z-[9999] min-w-[200px] rounded-xl overflow-hidden"
          style={{
            top: menu.y,
            left: menu.x,
            background: "rgba(15,15,25,0.96)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
          }}
          onContextMenu={e => e.preventDefault()}
        >
          <div className="py-1">
            {menu.items.map((item, i) => {
              const Icon = item.icon;
              const hasSub = item.submenu && item.submenu.length > 0;
              return (
                <div key={i}>
                  {item.divider && i > 0 && (
                    <div className="my-1 mx-3 h-px bg-white/8" />
                  )}
                  <div
                    className={cn(
                      "relative flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer select-none transition-colors mx-1 rounded-lg",
                      item.danger
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-white/80 hover:bg-white/8 hover:text-white",
                    )}
                    onMouseEnter={() => setSubmenuIdx(hasSub ? i : null)}
                    onMouseLeave={() => !hasSub && setSubmenuIdx(null)}
                    onClick={() => {
                      if (!hasSub) { item.action(); onClose(); }
                    }}
                  >
                    <Icon size={13} className="flex-shrink-0 opacity-70" />
                    <span className="flex-1">{item.label}</span>
                    {hasSub && <ChevronRight size={11} className="opacity-40" />}

                    {/* Submenu */}
                    <AnimatePresence>
                      {hasSub && submenuIdx === i && (
                        <motion.div
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute left-full top-0 ml-1 min-w-[180px] rounded-xl overflow-hidden z-[10000]"
                          style={{
                            background: "rgba(15,15,25,0.97)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                          }}
                        >
                          <div className="py-1">
                            {item.submenu!.map((sub, j) => {
                              const SubIcon = sub.icon;
                              return (
                                <div
                                  key={j}
                                  className="flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg text-[13px] text-white/80 hover:bg-white/8 hover:text-white cursor-pointer select-none transition-colors"
                                  onClick={() => { sub.action(); onClose(); }}
                                >
                                  <SubIcon size={13} className="opacity-70" />
                                  <span>{sub.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
