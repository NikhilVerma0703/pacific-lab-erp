export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-64 animate-pulse rounded bg-line" />
      <div className="h-40 animate-pulse rounded-xl bg-white" />
      <div className="h-64 animate-pulse rounded-xl bg-white" />
    </div>
  );
}
