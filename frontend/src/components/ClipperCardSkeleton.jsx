/**
 * Shaped loading placeholder that mirrors ClipperCard's layout:
 * avatar + name row, a 3-up stat row, a 3-up portfolio strip and a price row.
 */
export default function ClipperCardSkeleton() {
  return (
    <div className="card-dark p-6 flex flex-col gap-4 animate-pulse" data-testid="clipper-card-skeleton">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white/10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 w-2/3 rounded bg-white/10 mb-2" />
          <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-white/[0.05]" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-lg bg-white/[0.05]" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-white/[0.06]" />
        <div className="h-3 w-16 rounded bg-white/10" />
      </div>
    </div>
  );
}
