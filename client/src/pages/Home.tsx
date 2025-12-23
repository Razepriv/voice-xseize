import { useAuth } from "@/hooks/useAuth";
import AdminDashboard from "./dashboards/AdminDashboard";
import SalesAgentDashboard from "./dashboards/SalesAgentDashboard";
import SiteManagerDashboard from "./dashboards/SiteManagerDashboard";
import SourcingManagerDashboard from "./dashboards/SourcingManagerDashboard";

export default function Home() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'sales_agent':
      return <SalesAgentDashboard />;
    case 'site_manager':
      return <SiteManagerDashboard />;
    case 'sourcing_manager':
      return <SourcingManagerDashboard />;
    default:
      return <SalesAgentDashboard />;
  }
}
