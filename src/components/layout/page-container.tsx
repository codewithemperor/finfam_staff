import { cn } from "@/lib/utils";

type PageContainerSize = "narrow" | "default" | "wide";

const sizeClasses: Record<PageContainerSize, string> = {
  narrow: "max-w-3xl",
  default: "max-w-[90rem]",
  wide: "max-w-[90rem]",
};

interface PageContainerProps {
  children: React.ReactNode;
  size?: PageContainerSize;
  className?: string;
}

/**
 * Centers and constrains content width with consistent horizontal padding.
 * Every page composes its content inside a PageContainer — pages never
 * invent their own page margins.
 */
export function PageContainer({
  children,
  size = "default",
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6",
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
