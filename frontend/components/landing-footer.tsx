import Link from "next/link";
import { Bot, VenetianMask } from "lucide-react";
import { BUSINESS_INFO } from "@/lib/business-info";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background px-4 py-16 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center text-center md:items-start md:text-left">
        <div className="flex w-full flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <div className="flex items-center gap-2">
              <VenetianMask className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold tracking-tight">lowkey</span>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">
                {BUSINESS_INFO.fullName}
              </p>
              <p>ИНН {BUSINESS_INFO.inn}</p>
              <p>ОГРНИП {BUSINESS_INFO.ogrnip}</p>
              <p>
                <a
                  href={`mailto:${BUSINESS_INFO.email}`}
                  className="underline-offset-4 hover:text-primary hover:underline"
                >
                  {BUSINESS_INFO.email}
                </a>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 md:items-end">
            <h4 className="mb-1 text-sm font-semibold uppercase tracking-wider text-foreground">
              Документы и условия
            </h4>
            <Link
              href="/telegram-proxy"
              className="text-sm text-muted-foreground transition-colors underline-offset-4 hover:text-primary hover:underline"
            >
              Telegram MTProto Proxy
            </Link>
            <Link
              href="/legal/offer"
              className="text-sm text-muted-foreground transition-colors underline-offset-4 hover:text-primary hover:underline"
            >
              Публичная оферта
            </Link>
            <Link
              href="/legal/privacy"
              className="text-sm text-muted-foreground transition-colors underline-offset-4 hover:text-primary hover:underline"
            >
              Политика конфиденциальности
            </Link>
            <Link
              href="/legal/payment"
              className="text-sm text-muted-foreground transition-colors underline-offset-4 hover:text-primary hover:underline"
            >
              Оплата, доступ и возврат
            </Link>
            <Link
              href="/legal/details"
              className="text-sm text-muted-foreground transition-colors underline-offset-4 hover:text-primary hover:underline"
            >
              Реквизиты
            </Link>
            <Link
              href={BUSINESS_INFO.telegramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors underline-offset-4 hover:text-primary hover:underline"
            >
              <Bot className="h-4 w-4" />
              {BUSINESS_INFO.telegram}
            </Link>
          </div>
        </div>

        <div className="my-8 h-px w-full bg-border" />

        <div className="w-full text-center text-xs text-muted-foreground/60">
          <p>© {new Date().getFullYear()} lowkey. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
