"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Self-contained Sheet (slide-over) — same UX as shadcn/ui Sheet but
// implemented with raw React state instead of @radix-ui/react-dialog so we
// don't pull in another package for one component. Provides a backdrop,
// right-anchored panel, ESC-to-close, and focus restoration on close.

type SheetContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext(component: string): SheetContextValue {
  const ctx = React.useContext(SheetContext);
  if (!ctx) {
    throw new Error(`${component} must be used inside <Sheet>.`);
  }
  return ctx;
}

function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <SheetContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

function SheetTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { setOpen } = useSheetContext("SheetTrigger");
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<{ onClick?: React.MouseEventHandler }>).props.onClick?.(e);
        if (!e.defaultPrevented) setOpen(true);
      },
    });
  }
  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  );
}

function SheetContent({
  children,
  className,
  side = "right",
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  side?: "right" | "left";
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  const { open, setOpen } = useSheetContext("SheetContent");
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  // Lock body scroll + remember focus to restore on close
  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const sideClass =
    side === "right"
      ? "right-0 top-0 h-full w-full sm:max-w-md border-l"
      : "left-0 top-0 h-full w-full sm:max-w-md border-r";

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in-0"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        className={cn(
          "absolute bg-background p-6 shadow-lg animate-in",
          side === "right"
            ? "slide-in-from-right duration-300"
            : "slide-in-from-left duration-300",
          sideClass,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function SheetHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col space-y-2", className)}>{children}</div>;
}

function SheetTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-semibold", className)}>{children}</h2>;
}

function SheetDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}

function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)}>{children}</div>;
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter };
