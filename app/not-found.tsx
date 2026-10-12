import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-5 pb-24 pt-16 text-center sm:px-8">
      <p className="mono-tag text-lime">Error 404</p>
      <h1 className="display mt-4 text-6xl font-semibold leading-[0.9] text-white sm:text-8xl">
        Nothing <em className="text-gradient-lime font-light">here.</em>
      </h1>
      <p className="mx-auto mt-6 max-w-md text-white/60">This page doesn&apos;t exist. The events you&apos;re looking for are on the dashboard.</p>
      <Link href="/" className="btn-neon mt-10 inline-block px-8 py-4">
        Back to dashboard
      </Link>
    </div>
  );
}
