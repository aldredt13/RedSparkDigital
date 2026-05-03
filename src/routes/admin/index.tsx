import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/site/AdminDashboard";
import { supabase } from "@/lib/supabase"; // adjust path if needed

export const Route = createFileRoute("/admin/")({
  // Auth guard — runs before the component renders
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw redirect({ to: "/admin/Login" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  return <AdminDashboard />;
}