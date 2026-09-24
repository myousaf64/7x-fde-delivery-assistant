"use client";

import Image from "next/image";
import Link from "next/link";

export type Section = "chat" | "overview" | "blocked" | "activity";

const NAV: { href: string; label: string; sections: Section[] }[] = [
  { href: "/", label: "Chat", sections: ["chat"] },
  { href: "/admin?tab=overview", label: "Operations", sections: ["overview", "blocked"] },
  { href: "/admin?tab=activity", label: "Activity", sections: ["activity"] },
];

/**
 * Operations console shell: brand bar, a navigation rail on desktop and a bottom
 * row on mobile. The Arabic wordmark replaces the Latin one while the
 * conversation is in Arabic.
 */
export default function AppShell({
  children,
  section,
  arabic = false,
  today,
  right,
}: {
  children: React.ReactNode;
  section: Section;
  arabic?: boolean;
  today?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2 sm:gap-3 sm:px-6">
        <Image
          src={arabic ? "/emx-arabic.jpg" : "/emx-latin.jpg"}
          alt="EMX"
          width={1536}
          height={arabic ? 476 : 617}
          priority
          className="h-6 w-auto sm:h-7"
        />
        <span className="hidden h-5 w-px bg-neutral-200 sm:block" />
        <span className="truncate text-sm font-semibold sm:text-base">Delivery assistant</span>
        <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">
          prototype
        </span>
        <div className="ms-auto flex shrink-0 items-center gap-3">
          {today && <span className="hidden text-xs text-neutral-600 sm:inline">operating date {today}</span>}
          {right}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav
          aria-label="Sections"
          className="hidden w-44 shrink-0 flex-col gap-1 border-e border-neutral-200 bg-white p-3 lg:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.sections.includes(section) ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm ${
                item.sections.includes(section)
                  ? "bg-brand-tint font-medium text-brand"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <p className="mt-auto text-[11px] leading-snug text-neutral-500">
            Assessment prototype. Synthetic shipment data.
          </p>
        </nav>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>

      <nav
        aria-label="Sections"
        className="flex shrink-0 gap-1 border-t border-neutral-200 bg-white px-2 py-1.5 lg:hidden"
      >
        {NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.sections.includes(section) ? "page" : undefined}
            className={`flex-1 rounded-md px-2 py-1.5 text-center text-xs ${
              item.sections.includes(section) ? "bg-brand-tint font-medium text-brand" : "text-neutral-700"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
