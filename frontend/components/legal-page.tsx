import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing-footer";
import { LandingHeader } from "@/components/landing-header";

interface LegalPageProps {
  title: string;
  lead: string;
  children: ReactNode;
}

export function LegalPage({ title, lead, children }: LegalPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader />
      <main className="flex-1 mx-auto max-w-4xl px-4 py-16 md:py-24">
        <h1 className="mb-8 text-4xl font-extrabold tracking-tight md:text-5xl">
          {title}
        </h1>
        <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-6 prose-headings:font-bold prose-p:leading-relaxed">
          <p className="mb-8 text-lg text-muted-foreground">{lead}</p>
          {children}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
