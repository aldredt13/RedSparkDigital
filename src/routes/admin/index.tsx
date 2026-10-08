import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminDashboard } from "../../components/admin/AdminDashboard";
import { ADMIN_TABS, type AdminTab } from "../../components/admin/types";
import { supabase } from "../../lib/supabase";

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>): { tab?: AdminTab } => ({
    tab: ADMIN_TABS.includes(search.tab as AdminTab) ? (search.tab as AdminTab) : undefined,
  }),
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/admin/Login" });

    // Only accounts in the admin allowlist may use the dashboard. If the
    // allowlist function doesn't exist yet (SQL not run), fall back to session-only.
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (!error && isAdmin === false) {
      await supabase.auth.signOut();
      throw redirect({ to: "/admin/Login", search: { denied: true } });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AdminDashboard tab={tab ?? "overview"} onTabChange={(next) => navigate({ search: { tab: next }, replace: true })} />;
}
