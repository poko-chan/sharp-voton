import { createFileRoute } from "@tanstack/react-router";
import { EduComingSoon } from "./makron.edu.index";

export const Route = createFileRoute("/_authenticated/makron/edu/$orgId")({
  head: () => ({
    meta: [
      { title: "Makron for Education — 準備中 | Study#" },
      { name: "description", content: "Makron for Education は現在リニューアル準備中です。" },
    ],
  }),
  component: EduComingSoon,
});
