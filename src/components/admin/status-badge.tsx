import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS } from "@/lib/utils";

const V: Record<string, "default" | "outline" | "muted" | "success" | "warning" | "danger"> = {
  NEW: "warning",
  CONFIRMED: "outline",
  PAYMENT_PENDING: "warning",
  PAID: "success",
  PROCESSING: "outline",
  SHIPPED: "default",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={V[status] ?? "muted"}>{ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}
