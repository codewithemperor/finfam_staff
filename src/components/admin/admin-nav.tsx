"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { ADMIN_CONSOLE_LABEL, ADMIN_NAV } from "@/config/admin";
import { cn } from "@/lib/utils";

/**
 * FinFam Admin console navigation (Stage 11) — real destinations only:
 * Overview, Staff, Daily Reports, Audit Log. Plus the sign-out action,
 * which POSTs /api/admin/auth/logout (revoking the DB session — not
 * merely dropping the cookie) and returns to the login screen.
 *
 * The brand block is deliberately VISIBLY DISTINCT from the Staff Portal
 * (brief §16): "FinFam Admin" with a permanent "Management console" label
 * so a signed-in administrator can never confuse this surface with the
 * Staff Portal. The signed-in admin email is shown md+.
 *
 * Mobile: destinations wrap to a second row like the Staff Portal — no
 * hidden drawer at four links. Keyboard accessible throughout; the active
 * destination is communicated by text + style + aria-current.
 */
export function AdminNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // Even if the network call fails, send the user to login — the
      // session row (if any) will still resolve server-side or expire.
    }
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 sm:h-16 sm:flex-nowrap sm:py-0">
      <Link
        href="/admin"
        className="flex flex-wrap items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        aria-label="FinFam Admin console home"
      >
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-md border border-border bg-foreground text-sm font-bold text-background"
        >
          F
        </span>
        <span className="text-base font-bold tracking-tight text-foreground">
          {ADMIN_CONSOLE_LABEL}
        </span>
        <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Management console
        </span>
      </Link>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap sm:gap-4">
        <nav aria-label="Admin console navigation">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
            {ADMIN_NAV.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "whitespace-nowrap rounded-md text-[13px] font-medium underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-sm",
                      isActive
                        ? "font-semibold text-primary"
                        : "text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <span
            className="hidden max-w-[16rem] truncate font-mono text-xs tracking-wider text-muted-foreground md:inline"
            title="Signed in as"
          >
            {adminEmail}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-60 sm:text-sm"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
