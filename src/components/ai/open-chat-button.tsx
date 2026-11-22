"use client";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OpenChatButton({ label = "Спросить стилиста" }: { label?: string }) {
  return (
    <Button onClick={() => window.dispatchEvent(new Event("damir:open-chat"))}>
      <Sparkles /> {label}
    </Button>
  );
}
