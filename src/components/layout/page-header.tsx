import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

/**
 * Consistent page title block. Used at the top of every page below the
 * header, so every page answers "where am I?" the same way.
 */
export function PageHeader({ title, description, className }: PageHeaderProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
