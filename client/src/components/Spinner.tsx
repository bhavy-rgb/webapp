export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="relative flex h-9 w-9 items-center justify-center">
        <span className="absolute inline-flex h-full w-full rounded-full bg-terracotta/25 animate-ping" />
        <span className="relative inline-flex h-6 w-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
      </span>
      {label ? <p className="text-sm text-ink-soft">{label}</p> : null}
    </div>
  );
}
