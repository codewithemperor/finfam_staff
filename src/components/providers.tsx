"use client";

import { Toast } from "@heroui/react";

/**
 * Global client providers.
 *
 * HeroUI v3 does not need an app-wide provider for components, but the
 * imperative `toast()` helper requires a single mounted <Toast.Provider>.
 * Keep this component tiny — it should only mount browser-dependent
 * infrastructure that must exist on every page.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toast.Provider placement="bottom-right" />
    </>
  );
}
