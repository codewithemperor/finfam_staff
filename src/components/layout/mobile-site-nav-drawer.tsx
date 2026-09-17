"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Drawer } from "@heroui/react";
import { Menu } from "lucide-react";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/button-link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function MobileSiteNavDrawer() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <Button
        aria-label="Open navigation menu"
        size="sm"
        variant="outline"
        onPress={() => setIsOpen(true)}
      >
        <Menu aria-hidden className="size-4" />
        Menu
      </Button>
      <Drawer.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="border-l border-border bg-background">
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Navigation</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <nav aria-label="Mobile navigation">
                <ul className="flex flex-col gap-2">
                  {siteConfig.nav.map((item) => {
                    const isActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href.split("#")[0]);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex min-h-11 items-center rounded-md px-3 text-sm font-medium underline-offset-4 hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                            isActive ? "text-primary" : "text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </Drawer.Body>
            <Drawer.Footer>
              <ButtonLink
                href="/apply"
                fullWidth
                onClick={() => setIsOpen(false)}
              >
                Apply now
              </ButtonLink>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </div>
  );
}
