"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, Check, Gift } from "lucide-react";
import { motion } from "motion/react";

const mockPromo = [
  { id: 1, code: "WELCOME_100", desc: "+100 ₽ на баланс", date: "22.10.2025" },
  { id: 2, code: "SUMMER_VP", desc: "Скидка 20% на год", date: "15.08.2024" },
];

export default function PromoPage() {
  const [promo, setPromo] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const handleCopy = (code: string, id: number) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Промокоды</h1>
        <p className="text-muted-foreground mt-1">
          Активируйте купон для получения бонусов или скидок
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Активация промокода
          </CardTitle>
          <CardDescription>
            Введите промокод, чтобы получить баланс на счет или премиум статус.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="FRIDAY2026"
              className="uppercase font-mono text-lg tracking-widest bg-muted/30 focus-visible:bg-transparent transition-colors"
              value={promo}
              onChange={(e) => setPromo(e.target.value.toUpperCase())}
            />
            <Button
              size="lg"
              disabled={promo.length < 3}
              className="px-6 cursor-pointer"
            >
              Активировать
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">История активаций</h2>
        <div className="grid gap-3">
          {mockPromo.map((p, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              key={p.id}
              className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-foreground bg-muted px-2 py-0.5 rounded text-primary">
                    {p.code}
                  </span>
                  <button
                    onClick={() => handleCopy(p.code, p.id)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {copied === p.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-sm font-medium mt-1">{p.desc}</p>
              </div>
              <div className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-1 rounded-md">
                {p.date}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
