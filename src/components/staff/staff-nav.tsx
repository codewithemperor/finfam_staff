"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Drawer } from "@heroui/react";
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  House,
  LogOut,
  Menu,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { STAFF_PORTAL_NAV } from "@/config/staff-portal";
import { cn } from "@/lib/utils";

const navIcons: Record<string, LucideIcon> = {
  "/staff": House,
  "/staff/reports": ClipboardList,
  "/staff/training": GraduationCap,
  "/staff/appointment": FileText,
  "/staff/resources": BookOpen,
  "/staff/profile": UserRound,
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center",
          !compact && "rounded-full bg-white",
        )}
      >
        <Image
          src="/icon-192.png"
          alt=""
          width={36}
          height={36}
          className={cn("size-9 object-contain", compact && "size-8")}
          priority
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold tracking-tight">
          FinFam
        </span>
        {!compact && (
          <span className="block truncate text-xs text-primary-foreground/70">
            Staff Portal
          </span>
        )}
      </span>
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/staff"
    ? pathname === "/staff"
    : pathname.startsWith(href);
}

function NavItems({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {STAFF_PORTAL_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = navIcons[item.href] ?? FileText;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground",
                active
                  ? "bg-white text-primary"
                  : "text-primary-foreground/82 hover:bg-primary-foreground/12 hover:text-primary-foreground",
              )}
            >
              <Icon aria-hidden className="size-[1.125rem] shrink-0" />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function LogoutButton({
  onLogout,
  loggingOut,
  mobile = false,
}: {
  onLogout: () => void;
  loggingOut: boolean;
  mobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loggingOut}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground disabled:opacity-60",
        mobile
          ? "text-foreground hover:bg-surface hover:text-primary focus-visible:outline-primary"
          : "text-primary-foreground/82 hover:bg-primary-foreground/12 hover:text-primary-foreground",
      )}
    >
      <LogOut aria-hidden className="size-[1.125rem] shrink-0" />
      {loggingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function StaffNav({
  staffId,
  fullName,
}: {
  staffId: string;
  fullName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/staff/auth/logout", { method: "POST" });
    } catch {
      // Navigation still clears the client view if the request is interrupted.
    }
    router.push("/staff/login");
    router.refresh();
  }

  return (
    <>
      <aside className="sticky top-0 hidden h-[100dvh] max-h-[100dvh] self-start overflow-y-auto bg-primary text-primary-foreground md:flex md:flex-col md:px-4 md:py-5 lg:px-5">
        <Link
          href="/staff"
          aria-label="FinFam Staff Portal home"
          className="rounded-md px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
        >
          <Brand />
        </Link>

        <div className="mt-8 border-b border-primary-foreground/15 pb-6">
          <p className="truncate px-3 text-sm font-semibold">{fullName}</p>
          <p className="mt-1 px-3 font-mono text-xs tracking-wider text-primary-foreground/70">
            {staffId}
          </p>
        </div>

        <nav aria-label="Staff Portal navigation" className="mt-6">
          <NavItems pathname={pathname} />
        </nav>

        <div className="mt-auto border-t border-primary-foreground/15 pt-5">
          <LogoutButton onLogout={handleLogout} loggingOut={loggingOut} />
        </div>
      </aside>

      <header className="border-b border-border bg-background print:hidden md:hidden">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/staff"
            aria-label="FinFam Staff Portal home"
            className="rounded-md text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <Brand compact />
          </Link>
          <Button
            aria-label="Open staff navigation menu"
            size="sm"
            variant="outline"
            onPress={() => setIsOpen(true)}
          >
            <Menu aria-hidden className="size-4" />
            Menu
          </Button>
        </div>
      </header>

      <Drawer.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Content placement="left">
          <Drawer.Dialog className="bg-primary text-primary-foreground">
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>
                <Brand />
              </Drawer.Heading>
              <p className="text-sm text-primary-foreground/75">{staffId}</p>
            </Drawer.Header>
            <Drawer.Body>
              <nav aria-label="Mobile Staff Portal navigation">
                <NavItems pathname={pathname} onNavigate={() => setIsOpen(false)} />
              </nav>
            </Drawer.Body>
            <Drawer.Footer>
              <LogoutButton onLogout={handleLogout} loggingOut={loggingOut} mobile />
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
}
