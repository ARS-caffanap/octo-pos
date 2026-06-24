"use client";

// "Clear cart" confirmation. Lives in a tiny component so the page can
// keep its JSX shallow and so we can later swap in a different confirmation
// surface (e.g. an undo toast) without ripping apart the page tree.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ClearCartDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  onConfirm: () => void;
};

export function ClearCartDialog({
  open,
  onOpenChange,
  itemCount,
  onConfirm,
}: ClearCartDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear the cart?</AlertDialogTitle>
          <AlertDialogDescription>
            {itemCount === 0
              ? "There are no items to clear."
              : `This will remove all ${itemCount} item${itemCount === 1 ? "" : "s"} from the current sale. This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={itemCount === 0}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={itemCount === 0}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear cart
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
