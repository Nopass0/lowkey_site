import { useState, useEffect } from "react";
import { API_CONFIG } from "@/api/config";

export interface Subscription {
  planId: string;
  planName: string;
  activeUntil: string; // ISO date
  isLifetime: boolean;
}

export interface UserProfile {
  balance: number;
  subscription: Subscription | null;
}

export function useUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchUser() {
      setIsLoading(true);
      if (API_CONFIG.debug) {
        // Mock data
        setTimeout(() => {
          if (!mounted) return;
          setProfile({
            balance: 1500,
            subscription: {
              planId: "pro",
              planName: "Рабочий",
              activeUntil: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              isLifetime: false,
            },
          });
          setIsLoading(false);
        }, 800);
        return;
      }

      try {
        const res = await fetch(`${API_CONFIG.baseUrl}/user/profile`);
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        if (mounted) setProfile(data);
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchUser();
    return () => {
      mounted = false;
    };
  }, []);

  // Expose an updater for mock purposes
  const mockTopUp = (amount: number) => {
    if (API_CONFIG.debug && profile) {
      setProfile({ ...profile, balance: profile.balance + amount });
    }
  };

  const mockSubscribe = (planName: string, days: number, planCost: number) => {
    if (API_CONFIG.debug && profile) {
      setProfile({
        balance: profile.balance - planCost,
        subscription: {
          planId: "new-plan",
          planName: planName,
          activeUntil: new Date(
            Date.now() + days * 24 * 60 * 60 * 1000,
          ).toISOString(),
          isLifetime: false,
        },
      });
    }
  };

  return { profile, isLoading, error, mockTopUp, mockSubscribe };
}
