import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", {
  variants: {
    variant: {
      default: "bg-ink text-white",
      outline: "border border-ink text-ink",
      muted: "bg-paper-muted text-neutral-700",
      sale: "bg-white text-ink",
      success: "bg-emerald-50 text-emerald-800",
      warning: "bg-amber-50 text-amber-800",
      danger: "bg-red-50 text-red-700",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
