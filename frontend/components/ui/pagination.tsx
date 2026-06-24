"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// Self-contained Pagination — same shape as shadcn/ui's Pagination
// (Pagination, PaginationContent, PaginationItem, PaginationLink,
// PaginationPrevious, PaginationNext, PaginationEllipsis) but built with
// raw buttons so we don't pull in a separate npm package.
//
// The page numbers collapse when there are many pages: first, last, the
// current page ± 1, plus ellipses for the gaps. This keeps the control
// compact no matter how big the data set is.

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

function buildPageList(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [];
  const add = (v: number | "ellipsis") => {
    if (pages[pages.length - 1] !== v) pages.push(v);
  };
  add(1);
  if (page > 4) add("ellipsis");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) add(i);
  if (page < totalPages - 3) add("ellipsis");
  add(totalPages);
  return pages;
}

function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
    >
      <ul className="flex flex-row items-center gap-1">
        <li>
          <button
            type="button"
            aria-label="Previous page"
            disabled={!canPrev}
            onClick={() => canPrev && onPageChange(page - 1)}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1 pl-2.5",
              !canPrev && "pointer-events-none opacity-50",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>
        </li>

        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <li key={`e-${idx}`} aria-hidden>
              <span
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "pointer-events-none",
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
              </span>
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                onClick={() => onPageChange(p)}
                className={cn(
                  buttonVariants({
                    variant: p === page ? "outline" : "ghost",
                    size: "icon",
                  }),
                )}
              >
                {p}
              </button>
            </li>
          ),
        )}

        <li>
          <button
            type="button"
            aria-label="Next page"
            disabled={!canNext}
            onClick={() => canNext && onPageChange(page + 1)}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1 pr-2.5",
              !canNext && "pointer-events-none opacity-50",
            )}
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </li>
      </ul>
    </nav>
  );
}

export { Pagination };
