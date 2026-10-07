import { createFileRoute } from "@tanstack/react-router";
import { PaymentSection } from "@/components/settings/PaymentSection";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "お支払い｜Study#" },
      { name: "description", content: "Study# のプランと追加パックをご確認いただけます。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PaymentSection />
    </div>
  );
}
