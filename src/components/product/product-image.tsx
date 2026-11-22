import { cn } from "@/lib/utils";

/** Product photo with a neutral placeholder. Plain <img> so admin uploads, SVG seeds and CDN URLs all work. */
export function ProductImage({ src, alt, className, priority }: { src?: string | null; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-paper-muted", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center font-display text-xl tracking-[0.3em] text-neutral-300">DAMIR</div>
      )}
    </div>
  );
}
