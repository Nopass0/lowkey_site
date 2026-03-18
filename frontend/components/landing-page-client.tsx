"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionPlan } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { LandingBanner } from "@/components/landing-banner";
import { LandingFooter } from "@/components/landing-footer";
import { LandingHeader } from "@/components/landing-header";
import { LandingPricing } from "@/components/landing-pricing";
import { Loader } from "@/components/ui/loader";

interface LandingPageClientProps {
  initialPlans: SubscriptionPlan[];
  lowestPrice: number;
}

export function LandingPageClient({
  initialPlans,
  lowestPrice,
}: LandingPageClientProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.push("/me");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col flex-1">
      <LandingHeader />
      <main className="flex flex-col flex-1">
        <LandingBanner lowestPrice={lowestPrice} />
        <LandingPricing initialPlans={initialPlans} />
      </main>
      <LandingFooter />
    </div>
  );
}
