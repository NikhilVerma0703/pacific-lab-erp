import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <h1 className="text-lg font-bold">Not found</h1>
      <p className="mt-1 text-sm text-ink-2">This record does not exist, was deleted, or your role cannot open it.</p>
      <Link href="/samples" className="btn-primary mt-5">Go to Sample Data Entry</Link>
    </div>
  );
}
