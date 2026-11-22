"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetTitle = Dialog.Title;

export function SheetContent({ side = "right", className, children, title }: { side?: "left" | "right"; className?: string; children: React.ReactNode; title: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-[fade-up_.2s_ease-out]" />
      <Dialog.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl focus:outline-none",
          side === "right" ? "right-0" : "left-0",
          className,
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Dialog.Title className="text-xs font-semibold uppercase tracking-luxe">{title}</Dialog.Title>
          <Dialog.Close className="p-2 hover:opacity-60" aria-label="Закрыть">
            <X className="size-5" />
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
