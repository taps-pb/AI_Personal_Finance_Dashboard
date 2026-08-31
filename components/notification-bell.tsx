"use client";
import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface BellItem {
  text: string;
  tone: string;
  href: string;
}

const dot = (tone: string) =>
  tone === "negative" ? "bg-destructive" : tone === "warning" ? "bg-[var(--warning)]" : tone === "positive" ? "bg-[var(--success)]" : "bg-muted-foreground";

export function NotificationBell({ notifications }: { notifications: BellItem[] }) {
  const count = notifications.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${count ? ` (${count})` : ""}`} className="relative">
          <Bell />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">You&rsquo;re all caught up.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {notifications.map((n, i) => (
              <li key={i}>
                <Link href={n.href} className="flex items-start gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot(n.tone)}`} />
                  <span>{n.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
