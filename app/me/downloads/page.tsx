"use client";

import { Button } from "@/components/ui/button";
import { Download, Monitor, Smartphone, Check } from "lucide-react";
import { motion } from "motion/react";

export default function DownloadsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-10 max-w-xl">
        <h1 className="text-3xl font-bold mb-3">Приложения</h1>
        <p className="text-muted-foreground text-lg">
          Защитите ваше соединение на всех устройствах. Удобное приложение,
          работающее в один клик.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring" }}
          className="bg-card border border-border rounded-2xl p-8 flex flex-col shadow-sm relative overflow-hidden"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />

          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
              <Smartphone className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Android</h2>
              <p className="text-sm font-medium text-muted-foreground mt-0.5">
                Android 8.0 или выше
              </p>
            </div>
          </div>

          <ul className="text-sm space-y-3 font-medium text-left w-full mb-8 flex-1 relative z-10">
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-muted-foreground text-[15px] leading-snug">
                Фоновая работа приложения без разрывов
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-muted-foreground text-[15px] leading-snug">
                Минимальный расход батареи и памяти
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-muted-foreground text-[15px] leading-snug">
                Встроенный Kill Switch для безопасности
              </span>
            </li>
          </ul>

          <Button
            size="lg"
            className="w-full cursor-pointer mt-auto font-semibold h-12 relative z-10"
          >
            <Download className="w-5 h-5 mr-2" />
            Скачать APK (v1.4.2)
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-8 flex flex-col shadow-sm relative overflow-hidden"
        >
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />

          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
              <Monitor className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Windows</h2>
              <p className="text-sm font-medium text-muted-foreground mt-0.5">
                Windows 10/11 64-bit
              </p>
            </div>
          </div>

          <ul className="text-sm space-y-3 font-medium text-left w-full mb-8 flex-1 relative z-10">
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-muted-foreground text-[15px] leading-snug">
                Быстрый старт вместе с запуском ОС
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-muted-foreground text-[15px] leading-snug">
                Специальный режим для онлайн игр
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-muted-foreground text-[15px] leading-snug">
                Полная совместимость с торрентами
              </span>
            </li>
          </ul>

          <Button
            size="lg"
            className="w-full cursor-pointer mt-auto font-semibold h-12 relative z-10 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
          >
            <Download className="w-5 h-5 mr-2" />
            Скачать Installer (v2.1.0)
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
