type RouteLoadingSkeletonProps = {
  fullscreen?: boolean;
  cards?: number;
};

export default function RouteLoadingSkeleton({
  fullscreen = false,
  cards = 6,
}: RouteLoadingSkeletonProps) {
  return (
    <div className={fullscreen ? "min-h-screen bg-background px-4 pb-12 pt-24" : "space-y-6"}>
      <div className="h-8 w-56 animate-pulse rounded-xl bg-muted/60" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted/45" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl border border-border/70 bg-card/60" />
        ))}
      </div>
    </div>
  );
}
