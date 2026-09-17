import Link from "next/link";
import type { ComponentProps } from "react";

import { buttonVariants } from "@heroui/styles";

import { cn } from "@/lib/utils";

type HeroButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-soft";

type HeroButtonSize = "sm" | "md" | "lg";

const buttonLinkSizeClasses: Record<HeroButtonSize, string> = {
  sm: "h-[2.375rem] min-h-[2.375rem] px-3",
  md: "h-11 min-h-11 px-4",
  lg: "h-12 min-h-12 px-6",
};

export interface ButtonLinkProps
  extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: HeroButtonVariant;
  size?: HeroButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/**
 * A link that looks like a HeroUI button.
 *
 * HeroUI v3's <Button> is a real <button> (it intentionally cannot render as
 * an anchor), so navigation CTAs use this component instead of rebuilding
 * button styles by hand. Styling comes from the SAME tailwind-variants
 * recipe HeroUI's Button uses (@heroui/styles `buttonVariants`), so the two
 * can never drift apart.
 *
 * Convention: <Button> performs an action (submit, copy, confirm).
 * <ButtonLink> navigates to a route.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button"
      className={cn(
        buttonVariants({ fullWidth, size, variant }),
        "inline-flex items-center justify-center rounded-[var(--field-radius)] shadow-none",
        buttonLinkSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
