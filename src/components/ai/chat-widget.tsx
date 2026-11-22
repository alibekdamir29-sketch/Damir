"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, Sparkles, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { ProductCard } from "@/lib/catalog";
import { useStore } from "@/components/store/store-provider";
import { cn, formatPrice } from "@/lib/utils";
import { ProductImage } from "@/components/product/product-image";

type Msg = { role: "user" | "assistant"; text: string; products: ProductCard[]; error?: boolean };

const SUGGESTIONS = ["Есть чёрные худи?", "Подбери образ на осень", "Сколько стоит доставка в Астану?", "Қандай джинсылар бар?"];

/** Minimal safe formatter: **bold**, line breaks and internal links (/product/..., /checkout). No HTML injection. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => (
        <p key={li} className={cn(li > 0 && "mt-2", !line.trim() && "h-1")}>
          {line.split(/(\*\*[^*]+\*\*|\/(?:product\/[a-z0-9-]+|checkout|cart|track|catalog[^\s),.]*))/g).map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
            if (/^\/(product\/|checkout|cart|track|catalog)/.test(part))
              return (
                <Link key={i} href={part} className="underline underline-offset-2">
                  {part === "/checkout" ? "оформление заказа" : part === "/cart" ? "корзина" : part === "/track" ? "отслеживание" : part}
                </Link>
              );
            return <span key={i}>{part.replace(/^#+\s/, "").replace(/^[-*]\s/, "• ")}</span>;
          })}
        </p>
      ))}
    </>
  );
}

function MiniCard({ p }: { p: ProductCard }) {
  const sizes = p.sizes.filter((s) => s.available).map((s) => s.label);
  return (
    <Link href={`/product/${p.slug}`} className="flex w-44 shrink-0 flex-col border bg-white hover:border-ink" data-testid="ai-product-card">
      <ProductImage src={p.images[0]?.url} alt={p.name} className="aspect-[4/5]" />
      <div className="space-y-1 p-3 text-xs">
        <p className="line-clamp-2 font-medium leading-snug">{p.name}</p>
        <p className="font-semibold">{formatPrice(p.price)}</p>
        <p className="text-neutral-500">{sizes.length ? `Размеры: ${sizes.join(", ")}` : "Нет в наличии"}</p>
        <div className="flex gap-1">
          {p.colors.map((c) => (
            <span key={c.id} title={c.name} className={cn("size-3 rounded-full border border-neutral-300", !c.available && "opacity-30")} style={{ backgroundColor: c.hex }} />
          ))}
        </div>
        <span className="block pt-1 text-[10px] font-semibold uppercase tracking-[0.16em]">Смотреть →</span>
      </div>
    </Link>
  );
}

export function ChatWidget() {
  const { refreshCart } = useStore();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    api<{ messages: Msg[]; enabled: boolean }>("/api/ai/chat")
      .then((r) => {
        setMessages(r.messages);
        setEnabled(r.enabled);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [open, loaded]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("damir:open-chat", openChat);
    return () => window.removeEventListener("damir:open-chat", openChat);
  }, []);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg, products: [] }]);
    setBusy(true);
    try {
      const r = await api<{ text: string; products: ProductCard[] }>("/api/ai/chat", { method: "POST", json: { message: msg } });
      setMessages((m) => [...m, { role: "assistant", text: r.text, products: r.products }]);
      void refreshCart(); // the assistant may have added an item
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: e instanceof ApiError ? e.message : "Не удалось связаться с консультантом.", products: [], error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    await api("/api/ai/chat", { method: "DELETE" }).catch(() => {});
    setMessages([]);
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-ink p-4 sm:px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-2xl ring-1 ring-white/20 transition hover:bg-ink-soft md:bottom-8 md:right-8",
          open && "max-sm:hidden",
        )}
        aria-expanded={open}
        aria-controls="damir-ai-chat"
        data-testid="ai-chat-toggle"
      >
        {open ? <X className="size-4" /> : <Sparkles className="size-4" />}
        <span className="max-sm:sr-only">{open ? "Закрыть" : "AI-стилист"}</span>
      </button>

      {open && (
        <section
          id="damir-ai-chat"
          role="dialog"
          aria-label="AI-консультант DAMIR"
          className="fixed inset-0 z-50 flex animate-fade-up flex-col bg-white sm:inset-auto sm:bottom-28 sm:right-8 sm:h-[min(680px,calc(100vh-9rem))] sm:w-[420px] sm:border sm:shadow-2xl"
        >
          <header className="flex items-center justify-between bg-ink px-5 py-4 text-white">
            <div>
              <p className="font-display text-xl tracking-[0.2em]">DAMIR</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">AI-консультант · RU / KZ</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={reset} className="p-2 text-neutral-400 hover:text-white" aria-label="Новый диалог" title="Новый диалог">
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-2 hover:opacity-70" aria-label="Закрыть чат">
                <X className="size-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-paper-muted p-4" data-testid="ai-messages">
            {messages.length === 0 && (
              <div className="space-y-4 p-2">
                <p className="text-sm leading-relaxed">
                  Здравствуйте! Я помогу подобрать одежду DAMIR: найду модели, проверю размеры, цвета и наличие. Сәлеметсіз бе! Қазақша да жаза аласыз.
                </p>
                {!enabled && <p className="text-xs text-red-700">Консультант ещё не подключён администратором.</p>}
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} disabled={!enabled} className="border border-neutral-300 bg-white px-3 py-2 text-xs hover:border-ink disabled:opacity-40">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[88%] px-4 py-3 text-sm leading-relaxed",
                    m.role === "user" ? "bg-ink text-white" : m.error ? "border border-red-200 bg-red-50 text-red-800" : "bg-white",
                  )}
                >
                  {m.role === "assistant" ? <RichText text={m.text} /> : m.text}
                </div>
                {m.products.length > 0 && (
                  <div className="no-scrollbar mt-2 flex w-full gap-2 overflow-x-auto pb-1">
                    {m.products.map((p) => (
                      <MiniCard key={p.id} p={p} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-1 bg-white px-4 py-3 text-sm text-neutral-500 w-fit" aria-live="polite">
                <span className="size-1.5 animate-bounce rounded-full bg-neutral-400" />
                <span className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:.3s]" />
                <span className="ml-2">Проверяю каталог…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 border-t bg-white p-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Спросите о товаре, размере, доставке…"
              className="max-h-32 min-h-[44px] flex-1 resize-none px-3 py-3 text-sm outline-none"
              aria-label="Сообщение консультанту"
              disabled={!enabled}
              data-testid="ai-input"
            />
            <button type="submit" disabled={busy || !input.trim() || !enabled} className="grid size-11 place-items-center bg-ink text-white disabled:opacity-30" aria-label="Отправить">
              <ArrowUp className="size-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
