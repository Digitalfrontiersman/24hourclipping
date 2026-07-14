/**
 * Shaped loading placeholder that mirrors JobCard's layout:
 * a video thumb block, a title bar, a 2-col meta grid and a CTA button row.
 */
export default function JobCardSkeleton() {
  return (
    <div className="card-dark overflow-hidden flex flex-col h-full animate-pulse" data-testid="job-card-skeleton">
      <div className="relative aspect-video bg-white/[0.05]" />
      <div className="p-5 flex flex-col flex-1">
        <div className="h-4 w-3/4 rounded bg-white/10 mb-2" />
        <div className="h-4 w-1/2 rounded bg-white/10 mb-4" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 w-full rounded bg-white/[0.06]" />
          ))}
        </div>
        <div className="mt-auto h-11 w-full rounded-full bg-white/[0.08]" />
      </div>
    </div>
  );
}
