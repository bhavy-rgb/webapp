/** Pulsing parchment-colored placeholder blocks shown while data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-parchment ${className}`} />;
}

/** Full-page skeleton for the Play screen (board + sidebar). */
export function PlaySkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-24">
      <div className="mx-auto mb-6 flex max-w-2xl flex-col items-center gap-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="mx-auto grid max-w-4xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-parchment bg-white p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="aspect-square w-full !rounded-2xl" />
          <div className="mt-3 flex items-center justify-between px-1">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-40 w-full !rounded-2xl" />
          <Skeleton className="h-32 w-full !rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Card-grid skeleton used by Home and Lobby while auth/data restores. */
export function CardsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-28">
      <div className="mx-auto mb-12 flex max-w-xl flex-col items-center gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-56 w-full !rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
