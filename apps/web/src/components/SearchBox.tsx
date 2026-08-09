"use client";

import { useRouter } from "next/navigation";

export function SearchBox({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q");
    const trimmed = String(query ?? "").trim();
    router.push(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
  }

  return (
    <form onSubmit={handleSubmit} className="search-box" role="search">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search your memory…"
        aria-label="Search your memory"
      />
      <button type="submit" className="btn">
        Search
      </button>
    </form>
  );
}
