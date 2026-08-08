import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface EmptyStateProps {
  kicker?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

function EmptyState({
  kicker,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center",
        className
      )}
    >
      {kicker ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-text">
          {kicker}
        </p>
      ) : null}
      <h3 className="font-display text-xl tracking-tight text-foreground">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
