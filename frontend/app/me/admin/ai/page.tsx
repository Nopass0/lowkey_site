"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2, Save } from "lucide-react";
import { apiClient } from "@/api/client";
import type { AiAdminAnalytics, AiAdminSettings } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";

export default function AdminAiPage() {
  const [settings, setSettings] = useState<AiAdminSettings | null>(null);
  const [analytics, setAnalytics] = useState<AiAdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [settingsData, analyticsData] = await Promise.all([
        apiClient.get<AiAdminSettings>("/admin/ai/settings"),
        apiClient.get<AiAdminAnalytics>("/admin/ai/analytics"),
      ]);
      setSettings(settingsData);
      setAnalytics(analyticsData);
      setIsLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    const saved = await apiClient.post<AiAdminSettings>("/admin/ai/settings", settings);
    setSettings(saved);
    const analyticsData = await apiClient.get<AiAdminAnalytics>("/admin/ai/analytics");
    setAnalytics(analyticsData);
    setIsSaving(false);
  };

  if (isLoading || !settings || !analytics) {
    return (
      <div className="flex justify-center p-20">
        <Loader size={56} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Brain className="h-8 w-8 text-primary" />
            AI админка
          </h1>
          <p className="mt-1 text-muted-foreground">
            Модель OpenRouter, локальный fallback, лимиты токенов и аналитика.
          </p>
        </div>
        <Button onClick={handleSave} className="rounded-xl">
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Сохранить
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Настройки AI</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            {[
              ["defaultModel", "OpenRouter модель"],
              ["localModel", "Локальная модель"],
              ["localBaseUrl", "Local base URL"],
              ["freeMonthlyTokens", "Free tokens"],
              ["aiPlanMonthlyTokens", "AI plan tokens"],
              ["maxPlanMonthlyTokens", "MAX plan tokens"],
              ["aiPlanPrice", "AI price"],
              ["maxPlanPrice", "MAX price"],
              ["comboPlanPrice", "Combo price"],
              ["tokenPackSize", "Token pack size"],
              ["tokenPackPrice", "Token pack price"],
              ["maxContextMessages", "Context messages"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  value={String(settings[key as keyof AiAdminSettings] ?? "")}
                  onChange={(event) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            [key]:
                              typeof prev[key as keyof AiAdminSettings] === "number"
                                ? Number(event.target.value)
                                : event.target.value,
                          }
                        : prev,
                    )
                  }
                />
              </div>
            ))}
            <div className="space-y-2 md:col-span-2">
              <Label>OpenRouter API key</Label>
              <Input
                type="password"
                value={settings.openRouterApiKey ?? ""}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, openRouterApiKey: event.target.value || null }
                      : prev,
                  )
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>System prompt</Label>
              <textarea
                className="min-h-[140px] w-full rounded-2xl border border-border/60 bg-background px-4 py-3 outline-none"
                value={settings.systemPrompt ?? ""}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev ? { ...prev, systemPrompt: event.target.value || null } : prev,
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Суммарная статистика</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                ["Пользователи", analytics.totals.users],
                ["Активные AI-подписки", analytics.totals.activeSubscriptions],
                ["Input tokens", analytics.totals.inputTokens.toLocaleString("ru-RU")],
                ["Output tokens", analytics.totals.outputTokens.toLocaleString("ru-RU")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-2 text-2xl font-black">{value}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Топ пользователей по токенам</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.users.slice(0, 8).map((item) => (
                <div
                  key={item.userId}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <div>
                    <div className="font-semibold">{item.login}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.messages} сообщений
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black">
                      {item.totalTokens.toLocaleString("ru-RU")}
                    </div>
                    <div className="text-xs text-muted-foreground">tokens</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
