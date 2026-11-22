import { cn } from "@/lib/utils";

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-4xl">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-white p-5", className)}>
      {title && <h2 className="eyebrow mb-4 text-ink">{title}</h2>}
      {children}
    </section>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[720px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-neutral-500 [&_thead]:border-b [&_tbody_tr]:border-b [&_tbody_tr:hover]:bg-paper-muted/60">
        {children}
      </table>
    </div>
  );
}
