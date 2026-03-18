import { LandingPageClient } from "@/components/landing-page-client";
import {
  fetchPublicPlans,
  getLowestDisplayedPlanPrice,
} from "@/lib/public-plans";

export default async function Page() {
  const plans = await fetchPublicPlans();
  const lowestPrice = getLowestDisplayedPlanPrice(plans);

  return <LandingPageClient initialPlans={plans} lowestPrice={lowestPrice} />;
}
