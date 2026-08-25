import { createFileRoute, redirect } from "@tanstack/react-router";

// ラベル管理は管理者画面に統合されました。
export const Route = createFileRoute("/_authenticated/makron/labels")({
  beforeLoad: () => {
    throw redirect({ to: "/makron/admin" });
  },
  component: () => null,
});
