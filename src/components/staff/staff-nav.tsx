"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { STAFF_PORTAL_NAV } from "@/config/staff-portal";
import { cn } from "@/lib/utils";

/**
 * Staff Portal navigation — real destinations only (brief §21): Home, My
 * Appointment, Onboarding, Resources, Profile. Plus the logout action,
 * which POSTs /api/staff/auth/logout (revoking the DB session — not merely
 * dropping the cookie) and returns to the login screen.
 *
 * Mobile: destinations wrap to a second row like the recruitment header —
 * compact, no hidden drawer needed at five links. Keyboard accessible
 * throughout; the active destination is communicated by text + style.
 */
export function StaffNav({ staffId }: { staffId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/staff/auth/logout", { method: "POST" });
    } catch {
      // Even if the network call fails, send the user to login — the
      // session row (if any) will still resolve server-side or expire.
    }
    router.push("/staff/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 sm:h-16 sm:flex-nowrap sm:py-0">
      <Link
        href="/staff"
        className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        aria-label="FinFam Staff Portal home"
      >
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        >
          F
        </span>
        <span className="text-base font-bold tracking-tight text-foreground">
          FinFam
        </span>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          Staff Portal
        </span>
      </Link>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap sm:gap-4">
        <nav aria-label="Staff Portal navigation">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
            {STAFF_PORTAL_NAV.map((item) => {
              const isActive =
                item.href === "/staff"
                  ? pathname === "/staff"
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
            className="hidden font-mono text-xs tracking-wider text-muted-foreground md:inline"
            title="Your Staff ID"
          >
            {staffId}
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
