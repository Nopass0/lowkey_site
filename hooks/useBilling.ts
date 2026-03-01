import { create } from "zustand";
import { API_CONFIG } from "@/api/config";

interface BillingState {
  paymentStatus: "idle" | "pending" | "success" | "failed";
  qrCodeUrl: string | null;
  amount: number | null;
  paymentId: string | null;
  pendingSubscriptionInfo: {
    planId: string;
    period: string;
    cost: number;
  } | null;
  startPayment: (
    amount: number,
    pendingSub?: { planId: string; period: string; cost: number },
  ) => void;
  checkStatus: () => Promise<boolean>;
  reset: () => void;
}

export const useBilling = create<BillingState>((set, get) => ({
  paymentStatus: "idle",
  qrCodeUrl: null,
  amount: null,
  paymentId: null,
  pendingSubscriptionInfo: null,

  startPayment: (amount, pendingSub) => {
    const mockId = "pay_" + Math.random().toString(36).substr(2, 9);
    set({
      paymentStatus: "pending",
      amount,
      paymentId: mockId,
      pendingSubscriptionInfo: pendingSub || null,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=SBPMOCK-${mockId}-${amount}`,
    });
  },

  checkStatus: async () => {
    const { paymentStatus, paymentId } = get();
    if (paymentStatus !== "pending" || !paymentId) return false;

    if (API_CONFIG.debug) {
      const isSuccess = Math.random() > 0.7; // simulate chance of payment
      if (isSuccess) {
        set({ paymentStatus: "success" });
        return true;
      }
      return false;
    }

    // Real API call
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/payments/${paymentId}`);
      const data = await res.json();
      if (data.status === "success") {
        set({ paymentStatus: "success" });
        return true;
      }
    } catch {
      // ignore errors in polling
    }
    return false;
  },

  reset: () =>
    set({
      paymentStatus: "idle",
      qrCodeUrl: null,
      amount: null,
      paymentId: null,
      pendingSubscriptionInfo: null,
    }),
}));
