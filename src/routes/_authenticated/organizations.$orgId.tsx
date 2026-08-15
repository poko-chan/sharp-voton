import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/organizations/$orgId")({
  component: () => <Outlet />,
});
