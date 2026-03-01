"use client";

import { useUser } from "@/hooks/useUser";
import { Loader } from "@/components/ui/loader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Clock, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { profile, isLoading } = useUser();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[50vh]">
        <Loader size={64} />
      </div>
    );
  }

  const sub = profile?.subscription;
  const isSubActive = sub && new Date(sub.activeUntil) > new Date();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Добро пожаловать, {user?.login}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Управление вашим аккаунтом и подписками
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Текущая подписка
              </CardTitle>
              <CardDescription>
                Статус вашего доступа к lowkey vpn
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSubActive ? (
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-foreground">
                      {sub.planName}
                    </span>
                    <span className="text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full text-xs">
                      Активно
                    </span>
                  </div>

                  <div className="bg-muted p-4 rounded-xl flex items-start gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Действует до:</p>
                      <p className="text-lg font-bold text-foreground">
                        {new Date(sub.activeUntil).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 bg-muted/30 rounded-xl border border-dashed border-border p-6">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      У вас нет активной подписки
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Оформите подписку, чтобы получить защищенный доступ и
                      максимальную скорость.
                    </p>
                  </div>
                  <Button asChild className="cursor-pointer">
                    <Link href="/me/billing">Выбрать тариф</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full shadow-none border bg-card">
            <CardHeader className="pb-4">
              <CardTitle>Кошелек</CardTitle>
              <CardDescription>Ваш баланс и пополнения</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Доступно:
                </div>
                <div className="text-5xl font-black text-foreground">
                  {profile?.balance || 0} ₽
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full cursor-pointer border-primary/50 hover:bg-primary/5"
                asChild
              >
                <Link href="/me/billing">Пополнить баланс через СБП</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
