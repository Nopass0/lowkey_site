import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { BUSINESS_INFO } from "@/lib/business-info";

export const metadata: Metadata = {
  title: "Реквизиты",
  description: "Реквизиты ИП Галин Богдан Маратович для сервиса lowkey.",
  alternates: {
    canonical: "/legal/details",
  },
};

export default function DetailsPage() {
  return (
    <LegalPage
      title="Реквизиты"
      lead="Реквизиты размещены в открытом доступе для пользователей сайта и проверки платежными партнерами."
    >
      <h2>1. Данные продавца</h2>
      <p>
        Полное наименование: {BUSINESS_INFO.fullName}
        <br />
        Краткое наименование: {BUSINESS_INFO.shortName}
        <br />
        ИНН: {BUSINESS_INFO.inn}
        <br />
        ОГРНИП: {BUSINESS_INFO.ogrnip}
        <br />
        Основной ОКВЭД: {BUSINESS_INFO.okved}
      </p>

      <h2>2. Контакты</h2>
      <p>
        Email: <a href={`mailto:${BUSINESS_INFO.email}`}>{BUSINESS_INFO.email}</a>
        <br />
        Telegram: <a href={BUSINESS_INFO.telegramUrl}>{BUSINESS_INFO.telegram}</a>
      </p>

      <h2>3. Банковские реквизиты</h2>
      <p>
        Банк: {BUSINESS_INFO.bankName}
        <br />
        Расчетный счет: {BUSINESS_INFO.checkingAccount}
        <br />
        БИК: {BUSINESS_INFO.bik}
        <br />
        Корреспондентский счет: {BUSINESS_INFO.correspondentAccount}
        <br />
        ИНН банка: {BUSINESS_INFO.bankInn}
        <br />
        КПП банка: {BUSINESS_INFO.bankKpp}
        <br />
        Юридический адрес банка: {BUSINESS_INFO.bankAddress}
      </p>
    </LegalPage>
  );
}
