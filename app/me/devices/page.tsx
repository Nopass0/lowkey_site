"use client";

import { useDevices } from "@/hooks/useDevices";
import { Loader } from "@/components/ui/loader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MonitorSmartphone,
  ShieldBan,
  ShieldAlert,
  Monitor,
  Smartphone,
  Globe,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function DevicesPage() {
  const { devices, isLoading, toggleBlock } = useDevices();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[50vh]">
        <Loader size={64} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MonitorSmartphone className="w-8 h-8 text-primary" />
          Ваши устройства
        </h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Управляйте подключениями к вашей VPN подписке.
        </p>
      </div>

      <div className="grid gap-6 auto-rows-min">
        <AnimatePresence>
          {devices.map((device, i) => (
            <motion.div
              key={device.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                delay: i * 0.1,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
            >
              <Card
                className={`overflow-hidden shadow-none transition-colors border ${device.isBlocked ? "border-destructive/30 bg-destructive/5" : device.isOnline ? "border-primary/20 bg-primary/[0.02]" : "border-border/50"}`}
              >
                <CardContent className="p-0 sm:flex items-center">
                  <div className="p-6 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-border min-w-[120px] bg-background/50">
                    {device.os.toLowerCase().includes("windows") ||
                    device.os.toLowerCase().includes("mac") ? (
                      <Monitor className="w-12 h-12 text-muted-foreground" />
                    ) : (
                      <Smartphone className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xl">{device.name}</h3>
                        {device.isBlocked && (
                          <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            Заблокировано
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        {device.os} {device.version}
                      </p>
                      <p className="text-xs text-muted-foreground/60 font-mono flex items-center gap-1.5 mt-2">
                        <Globe className="w-3.5 h-3.5" /> Последний IP:{" "}
                        {device.lastIp}
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-4 min-w-[180px]">
                      {device.isBlocked ? (
                        <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                          <ShieldBan className="w-4 h-4" /> Доступ ограничен
                        </div>
                      ) : device.isOnline ? (
                        <div className="flex flex-col sm:items-end gap-1">
                          <div className="flex items-center gap-2 text-green-500 font-bold text-sm">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Онлайн
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                            <Activity className="w-3 h-3 text-primary" />
                            {(device.speedMode! / 1024).toFixed(1)} МБ/с
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                          Офлайн
                        </div>
                      )}

                      <Button
                        variant={device.isBlocked ? "outline" : "destructive"}
                        size="sm"
                        className="cursor-pointer font-semibold shadow-sm w-full sm:w-auto mt-2"
                        onClick={() => toggleBlock(device.id)}
                      >
                        {device.isBlocked ? "Разблокировать" : "Заблокировать"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
