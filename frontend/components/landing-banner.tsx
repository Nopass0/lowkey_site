"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useLanding } from "@/hooks/useLanding";
import { Button } from "./ui/button";

interface LandingBannerProps {
  lowestPrice: number;
}

export function LandingBanner({ lowestPrice }: LandingBannerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setAuthModalOpen, setPlan } = useLanding();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight * 0.7);

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight * 0.7;
    };

    window.addEventListener("resize", resize);

    const pixelSize = 16;
    const pixels: Array<{ val: number; target: number; speed: number }> = [];

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const currentCols = Math.floor(width / pixelSize);
      const currentRows = Math.floor(height / pixelSize);

      for (let i = 0; i < currentCols; i++) {
        for (let j = 0; j < currentRows; j++) {
          const idx = i + j * currentCols;

          if (!pixels[idx]) {
            pixels[idx] = {
              val: Math.random() * 0.5,
              target: Math.random(),
              speed: Math.random() * 0.05 + 0.01,
            };
          }

          const pixel = pixels[idx];
          pixel.val += (pixel.target - pixel.val) * pixel.speed;

          if (Math.abs(pixel.target - pixel.val) < 0.05) {
            pixel.target = Math.random() > 0.9 ? Math.random() : 0;
            pixel.speed = Math.random() * 0.1 + 0.05;
          }

          if (pixel.val > 0.1) {
            ctx.fillStyle = `rgba(59, 130, 246, ${pixel.val * 0.8})`;
            ctx.fillRect(
              i * pixelSize + 1,
              j * pixelSize + 1,
              pixelSize - 2,
              pixelSize - 2,
            );
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative flex h-[70vh] min-h-[500px] w-full items-center justify-center overflow-hidden border-b border-border bg-background">
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40 dark:opacity-20"
      />
      <div className="pointer-events-none absolute inset-0 bg-background [mask-image:radial-gradient(transparent_20%,black_100%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-4 text-center md:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-6 inline-block rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur-md"
        >
          Защищенное соединение для повседневной работы
        </motion.div>

        <motion.h1
          className="mb-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-primary text-transparent">
            lowkey
          </span>{" "}
          - защищенное соединение и оптимизация интернет-маршрутов
        </motion.h1>

        <motion.p
          className="mb-2 mt-6 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl md:text-5xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <span className="tracking-tight text-primary">
            {lowestPrice > 0
              ? `от ${lowestPrice} рублей в месяц`
              : "Актуальные цены в личном кабинете"}
          </span>
        </motion.p>

        <motion.p
          className="mb-10 text-sm font-semibold text-muted-foreground/80 md:text-base"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Актуальная стоимость подтягивается из базы данных
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button
            size="lg"
            className="group cursor-pointer rounded-full px-8 py-7 text-lg font-bold shadow-[0_0_40px_-10px_rgba(59,130,246,0.6)] outline-none transition-all hover:scale-105"
            onClick={() => {
              setPlan("advanced", "yearly");
              setAuthModalOpen(true);
            }}
          >
            Подключить lowkey
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
