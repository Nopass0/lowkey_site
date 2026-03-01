"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { useBilling } from "@/hooks/useBilling";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { Check, Wallet, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const plans = [
  { id: "starter", name: "Начальный", basePrice: 349 },
  { id: "pro", name: "Рабочий", basePrice: 499, popular: true },
  { id: "advanced", name: "Продвинутый", basePrice: 699 },
];

const periods = [
  { value: "1", label: "1 мес", disc: 0 },
  { value: "3", label: "3 мес", disc: 0.05 },
  { value: "6", label: "6 мес", disc: 0.15 },
  { value: "12", label: "1 год", disc: 0.2 },
];

export default function BillingPage() {
  const { profile, isLoading, mockTopUp, mockSubscribe } = useUser();
  const {
    paymentStatus,
    startPayment,
    qrCodeUrl,
    amount,
    reset,
    checkStatus,
    pendingSubscriptionInfo,
  } = useBilling();

  const [topUpAmount, setTopUpAmount] = useState("500");
  const [period, setPeriod] = useState("1");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (paymentStatus === "pending") {
      interval = setInterval(async () => {
        const isSuccess = await checkStatus();
        if (isSuccess && amount) {
          // Add to balance automatically
          mockTopUp(amount);

          // If there was a pending subscription waiting for money, buy it now
          if (pendingSubscriptionInfo) {
            setTimeout(() => {
              mockSubscribe(
                pendingSubscriptionInfo.planId,
                parseInt(pendingSubscriptionInfo.period) * 30,
                pendingSubscriptionInfo.cost,
              );
            }, 1000); // 1 second delay to let user see success first
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [
    paymentStatus,
    checkStatus,
    amount,
    mockTopUp,
    mockSubscribe,
    pendingSubscriptionInfo,
  ]);

  // Clean up billing state on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  if (isLoading || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  const handleTopUpClick = () => {
    const val = parseInt(topUpAmount);
    if (!isNaN(val) && val > 0) {
      startPayment(val);
    }
  };

  const handleSubscribe = (planId: string, cost: number) => {
    if (profile.balance >= cost) {
      mockSubscribe(planId, parseInt(period) * 30, cost);
    } else {
      const missingAmount = cost - profile.balance;
      startPayment(missingAmount, { planId, period, cost });
    }
  };

  const curPeriod = periods.find((p) => p.value === period);
  const discount = curPeriod?.disc || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Финансы</h1>
          <p className="text-muted-foreground mt-1">
            Пополнение баланса и покупка тарифов
          </p>
        </div>
        <div className="bg-primary/10 border border-primary/20 px-6 py-2 rounded-xl text-right">
          <div className="text-xs text-muted-foreground uppercase font-semibold">
            Ваш баланс
          </div>
          <div className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            {profile.balance} ₽
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-8 items-start">
        {/* Top Up Section */}
        <Card className="shadow-none border h-min">
          <CardHeader>
            <CardTitle>Пополнение СБП</CardTitle>
            <CardDescription>Деньги зачисляются мгновенно</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence mode="popLayout">
              {paymentStatus === "idle" || paymentStatus === "failed" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-4"
                  key="topup-form"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Сумма пополнения (₽)
                    </label>
                    <Input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      min="100"
                    />
                  </div>
                  <Button
                    onClick={handleTopUpClick}
                    className="w-full cursor-pointer h-12"
                    size="lg"
                  >
                    Пополнить
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center space-y-4"
                  key="qr-code"
                >
                  {paymentStatus === "pending" ? (
                    <>
                      <div className="border border-border p-4 rounded-xl bg-white shadow-none overflow-hidden flex flex-col items-center">
                        <h3 className="text-center font-bold text-black mb-2 flex items-center gap-2">
                          <QrCode className="w-5 h-5" />
                          СБП
                        </h3>
                        {qrCodeUrl && (
                          <img
                            src={qrCodeUrl}
                            alt="QR Code"
                            width={200}
                            height={200}
                            className="w-48 h-48 block opacity-90 transition-opacity"
                          />
                        )}
                        <p className="text-xs text-black/60 font-medium text-center mt-2 max-w-[200px]">
                          Отсканируйте код в приложении вашего банка для оплаты{" "}
                          {amount} ₽
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse font-medium">
                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        Ожидаем оплату...
                      </div>
                      <Button
                        variant="ghost"
                        onClick={reset}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Отменить
                      </Button>
                    </>
                  ) : paymentStatus === "success" ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mb-4"
                      >
                        <Check className="w-8 h-8" />
                      </motion.div>
                      <h3 className="text-xl font-bold mb-1 text-green-500">
                        Успешно!
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        Ваш баланс пополнен на {amount} ₽
                      </p>
                      <Button
                        onClick={reset}
                        className="mt-4"
                        variant="outline"
                      >
                        Ок
                      </Button>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Tariffs section */}
        <div className="space-y-6">
          <div className="bg-muted p-1 rounded-xl inline-flex flex-wrap items-center gap-1 w-full md:w-auto">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`flex-1 md:flex-none px-4 py-2 sm:px-6 sm:py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  period === p.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const monthly = Math.floor(plan.basePrice * (1 - discount));
              const isDiscounted = discount > 0;
              const totalCost = monthly * parseInt(period);

              return (
                <Card
                  key={plan.id}
                  className={`flex flex-col group relative shadow-none transition-colors hover:border-primary/50 ${plan.popular ? "border-primary" : "border-border"}`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-xl rounded-tr-xl whitespace-nowrap">
                      Популярный
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle>{plan.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 text-center pb-4">
                    {isDiscounted ? (
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-sm line-through text-muted-foreground">
                          {plan.basePrice} ₽/мес
                        </span>
                        <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                          -{discount * 100}%
                        </span>
                      </div>
                    ) : (
                      <div className="h-6"></div>
                    )}
                    <div className="text-3xl font-extrabold text-primary mb-1">
                      {monthly} ₽
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mb-4">
                      / мес
                    </p>

                    <div className="bg-muted p-2 rounded-lg mb-4 text-xs font-medium text-muted-foreground">
                      Итого за {period}{" "}
                      {period === "1"
                        ? "мес."
                        : period === "3"
                          ? "мес."
                          : period === "6"
                            ? "мес."
                            : "год"}
                      :
                      <span className="text-foreground ml-1 font-bold">
                        {totalCost} ₽
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button
                      disabled={
                        paymentStatus === "pending" ||
                        paymentStatus === "success"
                      }
                      className="w-full"
                      variant={plan.popular ? "default" : "secondary"}
                      onClick={() => handleSubscribe(plan.name, totalCost)}
                    >
                      Купить тариф
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
