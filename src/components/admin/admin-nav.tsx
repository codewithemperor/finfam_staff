"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Drawer } from "@heroui/react";
import {
  ClipboardList,
  FileClock,
  House,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { ADMIN_CONSOLE_LABEL, ADMIN_NAV } from "@/config/admin";
import { cn } from "@/lib/utils";

const navIcons: Record<string, LucideIcon> = {
  "/admin": House,
  "/admin/applicants": ClipboardList,
  "/admin/staff": Users,
  "/admin/reports": FileClock,
  "/admin/settings": Settings,
  "/admin/audit": ShieldCheck,
};

function Brand() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
        <Image
          src="/icon-192.png"
          alt=""
          width={36}
          height={36}
          className="size-9 object-contain"
          priority
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold tracking-tight">
          {ADMIN_CONSOLE_LABEL}
        </span>
        <span className="block truncate text-xs text-primary-foreground/70">
          Management console
        </span>
      </span>
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
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
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = navIcons[item.href] ?? FileClock;
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
        "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60",
        mobile
          ? "text-foreground hover:bg-surface hover:text-primary focus-visible:outline-primary"
          : "text-primary-foreground/82 hover:bg-primary-foreground/12 hover:text-primary-foreground focus-visible:outline-primary-foreground",
      )}
    >
      <LogOut aria-hidden className="size-[1.125rem] shrink-0" />
      {loggingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function AdminNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // The redirect still removes the authenticated view if the request fails.
    }
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      <aside className="sticky top-0 hidden h-[100dvh] max-h-[100dvh] self-start overflow-y-auto bg-primary text-primary-foreground md:flex md:flex-col md:px-4 md:py-5 lg:px-5">
        <Link
          href="/admin"
          aria-label="FinFam Admin home"
          className="rounded-md px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
        >
          <Brand />
        </Link>
        <div className="mt-8 border-b border-primary-foreground/15 pb-6">
          <p className="truncate px-3 text-sm font-semibold">Administrator</p>
          <p className="mt-1 truncate px-3 font-mono text-xs tracking-wider text-primary-foreground/70">
            {adminEmail}
          </p>
        </div>
        <nav aria-label="Admin console navigation" className="mt-6">
          <NavItems pathname={pathname} />
        </nav>
        <div className="mt-auto border-t border-primary-foreground/15 pt-5">
          <LogoutButton onLogout={handleLogout} loggingOut={loggingOut} />
        </div>
      </aside>

      <header className="border-b border-border bg-background print:hidden md:hidden">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/admin"
            aria-label="FinFam Admin home"
            className="rounded-md text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <Brand />
          </Link>
          <Button
            aria-label="Open admin navigation menu"
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
              <p className="truncate text-sm text-primary-foreground/75">
                {adminEmail}
              </p>
            </Drawer.Header>
            <Drawer.Body>
              <nav aria-label="Mobile Admin console navigation">
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
