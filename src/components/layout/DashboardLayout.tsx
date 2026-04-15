import { useEffect, useRef, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Users,
  BarChart3,
  Puzzle,
  Settings,
  LogOut,
  Eye,
} from "lucide-react";

const navItems = [
  { title: "Eventos", url: "/dashboard/events", icon: CalendarDays },
  { title: "Participantes", url: "/dashboard/attendees", icon: Users },
  { title: "Análises", url: "/dashboard/analytics", icon: BarChart3 },
  { title: "Integrações", url: "/dashboard/integrations", icon: Puzzle },
  { title: "Configurações", url: "/dashboard/settings", icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const allItems = [
    ...navItems,
    ...(profile?.company_slug
      ? [{ title: "Empresa", url: `/company/${profile.company_slug}`, icon: Eye }]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <header className="h-14 flex items-center px-6 gap-4">
        <Link to="/dashboard/events" className="mr-6 shrink-0">
          <Logo size="sm" />
        </Link>
        <div className="flex-1 flex items-center h-full overflow-x-auto">
          <div className="flex items-center gap-1">
            {allItems.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                className="px-4 py-2 text-sm font-medium text-muted-foreground rounded-full transition-colors hover:text-foreground hover:bg-muted"
                activeClassName="bg-foreground text-background hover:bg-foreground hover:text-background"
              >
                {item.title}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <span className="text-xs text-muted-foreground hidden lg:block truncate max-w-[160px]">{user.email}</span>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>
      <main ref={mainRef} className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
    </div>
  );
}
