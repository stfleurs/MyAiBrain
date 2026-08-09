import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getUser } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            Personal AI Memory
          </Link>
          <nav className="topbar-nav">
            <Link href="/knowledge/new" className="btn btn-primary btn-sm">
              New knowledge
            </Link>
            <span className="muted topbar-email">{user.email}</span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
