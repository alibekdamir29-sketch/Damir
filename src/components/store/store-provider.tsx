"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { CartView } from "@/lib/cart";

type Toast = { id: number; message: string; kind: "success" | "error" };

type StoreCtx = {
  cart: CartView | null;
  cartLoading: boolean;
  refreshCart: () => Promise<void>;
  addToCart: (variantId: string, quantity: number) => Promise<boolean>;
  updateCartItem: (itemId: string, patch: { quantity?: number; variantId?: string }) => Promise<boolean>;
  removeCartItem: (itemId: string) => Promise<void>;
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  toast: (message: string, kind?: Toast["kind"]) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
};

const Ctx = createContext<StoreCtx | null>(null);
const FAV_KEY = "damir:favorites";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const toast = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      setCart(await api<CartView>("/api/cart", { cache: "no-store" }));
    } finally {
      setCartLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCart();
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"));
    } catch {
      /* ignore */
    }
  }, [refreshCart]);

  const addToCart = useCallback(
    async (variantId: string, quantity: number) => {
      try {
        setCart(await api<CartView>("/api/cart/items", { method: "POST", json: { variantId, quantity } }));
        toast("Товар добавлен в корзину");
        return true;
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Не удалось добавить товар", "error");
        return false;
      }
    },
    [toast],
  );

  const updateCartItem = useCallback(
    async (itemId: string, patch: { quantity?: number; variantId?: string }) => {
      try {
        setCart(await api<CartView>(`/api/cart/items/${itemId}`, { method: "PATCH", json: patch }));
        return true;
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Не удалось изменить товар", "error");
        await refreshCart();
        return false;
      }
    },
    [toast, refreshCart],
  );

  const removeCartItem = useCallback(async (itemId: string) => {
    setCart(await api<CartView>(`/api/cart/items/${itemId}`, { method: "DELETE" }));
  }, []);

  const toggleFavorite = useCallback(
    (productId: string) => {
      setFavorites((prev) => {
        const next = prev.includes(productId) ? prev.filter((x) => x !== productId) : [...prev, productId];
        try {
          localStorage.setItem(FAV_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        toast(next.includes(productId) ? "Добавлено в избранное" : "Удалено из избранного");
        return next;
      });
    },
    [toast],
  );

  const value = useMemo<StoreCtx>(
    () => ({
      cart,
      cartLoading,
      refreshCart,
      addToCart,
      updateCartItem,
      removeCartItem,
      favorites,
      toggleFavorite,
      isFavorite: (id) => favorites.includes(id),
      toast,
      cartOpen,
      setCartOpen,
    }),
    [cart, cartLoading, refreshCart, addToCart, updateCartItem, removeCartItem, favorites, toggleFavorite, toast, cartOpen],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-fade-up px-5 py-3 text-sm shadow-lg ${t.kind === "error" ? "bg-red-600 text-white" : "bg-ink text-white"}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
