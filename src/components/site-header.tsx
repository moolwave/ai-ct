"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "검수" },
  { href: "/verify", label: "해시 검증" },
  { href: "/errors", label: "에러 로그" },
];

export function SiteHeader({ authEnabled }: { authEnabled: boolean }) {
  const pathname = usePathname();
  return (
    <header className="no-print border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-xl tracking-tight text-foreground">ai ct</span>
          <span className="text-xs text-muted-foreground">납품 검수</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {authEnabled ? (
            <form action={logoutAction}>
              <button type="submit" className="rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground">
                로그아웃
              </button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
