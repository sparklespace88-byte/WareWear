import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, setMemoryAuthToken } from '../lib/api';
import type { CartItem, Category, Product, StoreSettings, User } from '../types';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppliedCoupon {
  code: string;
  discountPercent: number;
  discountCents: number;
}

interface StoreContextValue {
  currentPath: string;
  navigate: (to: string) => void;
  user: User | null;
  hasAdmin: boolean;
  authLoading: boolean;
  login: (email: string, password: string, rememberMe: boolean, adminOnly?: boolean) => Promise<User>;
  register: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
  }) => Promise<User>;
  claimAdmin: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    adminPasscode?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  settings: StoreSettings;
  categories: Category[];
  refreshStorefront: () => Promise<void>;
  cartItems: CartItem[];
  cartCount: number;
  subtotalCents: number;
  shippingCents: number;
  freeShippingThresholdCents: number;
  appliedCoupon: AppliedCoupon | null;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
  addToCart: (product: Product, selectedSize: string, selectedColor: string, quantity?: number) => Promise<void>;
  updateCartItem: (
    itemId: number | string,
    updates: { quantity?: number; selectedSize?: string; selectedColor?: string }
  ) => Promise<void>;
  removeCartItem: (itemId: number | string) => Promise<void>;
  clearLocalCartAfterOrder: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  wishlist: Product[];
  isInWishlist: (productId: number) => boolean;
  toggleWishlist: (product: Product) => Promise<void>;
  recentlyViewed: Product[];
  recordProductView: (product: Product) => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(
    () => `${window.location.pathname}${window.location.search}`
  );
  const [user, setUser] = useState<User | null>(null);
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [settings, setSettings] = useState<StoreSettings>({});
  const [categories, setCategories] = useState<Category[]>([]);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [shippingCents, setShippingCents] = useState<number>(0);
  const [freeShippingThresholdCents, setFreeShippingThresholdCents] = useState<number>(15000);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === `${window.location.pathname}${window.location.search}`) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.history.pushState({}, '', to);
    setCurrentPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handlePop = () => {
      setCurrentPath(`${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const refreshStorefront = useCallback(async () => {
    try {
      const data = await apiFetch<{ settings: StoreSettings; categories: Category[] }>('/api/storefront');
      setSettings(data.settings);
      setCategories(data.categories);
      if (data.settings.free_shipping_threshold_cents) {
        setFreeShippingThresholdCents(Number(data.settings.free_shipping_threshold_cents));
      }
    } catch {
      // keep existing settings on transient failure
    }
  }, []);

  const syncCartFromServer = useCallback(async () => {
    try {
      const data = await apiFetch<{
        items: CartItem[];
        shippingCents: number;
        freeShippingThresholdCents: number;
      }>('/api/cart');
      setCartItems(data.items);
      setShippingCents(data.shippingCents);
      setFreeShippingThresholdCents(data.freeShippingThresholdCents);
    } catch {
      // ignore if unauthenticated
    }
  }, []);

  const syncWishlistFromServer = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: Product[] }>('/api/wishlist');
      setWishlist(data.items);
    } catch {
      setWishlist([]);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User | null; hasAdmin: boolean }>('/api/auth/me');
      setUser(data.user);
      setHasAdmin(data.hasAdmin);
      if (data.user) {
        await Promise.all([syncCartFromServer(), syncWishlistFromServer()]);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [syncCartFromServer, syncWishlistFromServer]);

  useEffect(() => {
    void refreshStorefront();
    void refreshAuth();
  }, [refreshStorefront, refreshAuth]);

  const subtotalCents = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.lineTotalCents, 0),
    [cartItems]
  );

  // Compute guest shipping dynamically when unauthenticated
  const effectiveShippingCents = useMemo(() => {
    if (user) return shippingCents;
    if (subtotalCents === 0) return 0;
    const std = Number(settings.standard_shipping_cents || 1200);
    return subtotalCents >= freeShippingThresholdCents ? 0 : std;
  }, [user, shippingCents, subtotalCents, freeShippingThresholdCents, settings]);

  // Re-evaluate coupon discount dynamically when subtotal changes
  useEffect(() => {
    if (!appliedCoupon) return;
    if (subtotalCents === 0) {
      setAppliedCoupon(null);
      return;
    }
    apiFetch<{ code: string; discountPercent: number; discountCents: number }>('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: appliedCoupon.code, subtotalCents }),
    })
      .then((res) => setAppliedCoupon(res))
      .catch(() => setAppliedCoupon(null));
  }, [subtotalCents]); // eslint-disable-line react-hooks/exhaustive-deps

  const mergeGuestCartIfAny = useCallback(
    async (guestItems: CartItem[]) => {
      if (guestItems.length === 0) {
        await syncCartFromServer();
        return;
      }
      const data = await apiFetch<{
        items: CartItem[];
        shippingCents: number;
        freeShippingThresholdCents: number;
      }>('/api/cart/merge', {
        method: 'POST',
        body: JSON.stringify({
          items: guestItems.map((i) => ({
            productId: i.productId,
            selectedSize: i.selectedSize,
            selectedColor: i.selectedColor,
            quantity: i.quantity,
          })),
        }),
      });
      setCartItems(data.items);
      setShippingCents(data.shippingCents);
      setFreeShippingThresholdCents(data.freeShippingThresholdCents);
    },
    [syncCartFromServer]
  );

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean, adminOnly = false) => {
      const guestSnapshot = [...cartItems];
      const data = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, rememberMe, adminOnly }),
      });
      setMemoryAuthToken(data.token);
      setUser(data.user);
      setHasAdmin(true);
      await Promise.all([mergeGuestCartIfAny(guestSnapshot), syncWishlistFromServer()]);
      return data.user;
    },
    [cartItems, mergeGuestCartIfAny, syncWishlistFromServer]
  );

  const register = useCallback(
    async (payload: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
      confirmPassword: string;
    }) => {
      const guestSnapshot = [...cartItems];
      const data = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMemoryAuthToken(data.token);
      setUser(data.user);
      await Promise.all([mergeGuestCartIfAny(guestSnapshot), syncWishlistFromServer()]);
      return data.user;
    },
    [cartItems, mergeGuestCartIfAny, syncWishlistFromServer]
  );

  const claimAdmin = useCallback(
    async (payload: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
      adminPasscode?: string;
    }) => {
      const data = await apiFetch<{ token: string; user: User }>('/api/auth/claim-admin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMemoryAuthToken(data.token);
      setUser(data.user);
      setHasAdmin(true);
      await Promise.all([syncCartFromServer(), syncWishlistFromServer()]);
      return data.user;
    },
    [syncCartFromServer, syncWishlistFromServer]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // clear client state regardless
    }
    setMemoryAuthToken(null);
    setUser(null);
    setCartItems([]);
    setWishlist([]);
    setAppliedCoupon(null);
    showToast('Signed out cleanly.', 'info');
  }, [showToast]);

  const addToCart = useCallback(
    async (product: Product, selectedSize: string, selectedColor: string, quantity = 1) => {
      const sizeObj = product.sizes.find((s) => s.sizeLabel === selectedSize);
      if (!sizeObj || sizeObj.stockQuantity < 1) {
        showToast('Selected size is out of stock.', 'error');
        return;
      }

      if (user) {
        const data = await apiFetch<{
          items: CartItem[];
          shippingCents: number;
          freeShippingThresholdCents: number;
        }>('/api/cart', {
          method: 'POST',
          body: JSON.stringify({
            productId: product.id,
            selectedSize,
            selectedColor,
            quantity,
          }),
        });
        setCartItems(data.items);
        setShippingCents(data.shippingCents);
        setFreeShippingThresholdCents(data.freeShippingThresholdCents);
      } else {
        setCartItems((prev) => {
          const key = `${product.id}-${selectedSize}-${selectedColor}`;
          const existing = prev.find((i) => i.id === key);
          const nextQty = Math.min(sizeObj.stockQuantity, (existing?.quantity ?? 0) + quantity);
          const unit = product.effectivePriceCents;
          if (existing) {
            return prev.map((i) =>
              i.id === key
                ? { ...i, quantity: nextQty, lineTotalCents: unit * nextQty }
                : i
            );
          }
          const newItem: CartItem = {
            id: key,
            productId: product.id,
            name: product.name,
            slug: product.slug,
            brand: product.brand,
            selectedSize,
            selectedColor,
            quantity: nextQty,
            unitPriceCents: unit,
            regularPriceCents: product.regularPriceCents,
            lineTotalCents: unit * nextQty,
            imageUrl: product.images[0]?.imageUrl ?? '',
            availableStock: sizeObj.stockQuantity,
            availableSizes: product.sizes,
            availableColors: product.colors,
          };
          return [newItem, ...prev];
        });
      }
      showToast(`${product.name} added to bag.`, 'success');
      setIsCartOpen(true);
    },
    [user, showToast]
  );

  const updateCartItem = useCallback(
    async (
      itemId: number | string,
      updates: { quantity?: number; selectedSize?: string; selectedColor?: string }
    ) => {
      if (user) {
        const data = await apiFetch<{
          items: CartItem[];
          shippingCents: number;
          freeShippingThresholdCents: number;
        }>(`/api/cart/${itemId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
        setCartItems(data.items);
        setShippingCents(data.shippingCents);
      } else {
        setCartItems((prev) =>
          prev
            .map((item) => {
              if (item.id !== itemId) return item;
              const qty = updates.quantity !== undefined ? updates.quantity : item.quantity;
              if (qty <= 0) return null;
              const nextSize = updates.selectedSize ?? item.selectedSize;
              const nextColor = updates.selectedColor ?? item.selectedColor;
              const sizeObj = item.availableSizes?.find((s) => s.sizeLabel === nextSize);
              const maxStock = sizeObj ? sizeObj.stockQuantity : item.availableStock;
              const clamped = Math.min(maxStock, Math.max(1, qty));
              return {
                ...item,
                selectedSize: nextSize,
                selectedColor: nextColor,
                quantity: clamped,
                availableStock: maxStock,
                lineTotalCents: item.unitPriceCents * clamped,
              };
            })
            .filter((x): x is CartItem => Boolean(x))
        );
      }
    },
    [user]
  );

  const removeCartItem = useCallback(
    async (itemId: number | string) => {
      if (user) {
        const data = await apiFetch<{
          items: CartItem[];
          shippingCents: number;
          freeShippingThresholdCents: number;
        }>(`/api/cart/${itemId}`, { method: 'DELETE' });
        setCartItems(data.items);
        setShippingCents(data.shippingCents);
      } else {
        setCartItems((prev) => prev.filter((item) => item.id !== itemId));
      }
    },
    [user]
  );

  const clearLocalCartAfterOrder = useCallback(() => {
    setCartItems([]);
    setAppliedCoupon(null);
    setShippingCents(0);
  }, []);

  const applyCoupon = useCallback(
    async (code: string) => {
      const res = await apiFetch<AppliedCoupon>('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code, subtotalCents }),
      });
      setAppliedCoupon(res);
      showToast(`Coupon ${res.code} applied (${res.discountPercent}% off).`, 'success');
    },
    [subtotalCents, showToast]
  );

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
  }, []);

  const isInWishlist = useCallback(
    (productId: number) => wishlist.some((p) => p.id === productId),
    [wishlist]
  );

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (!user) {
        showToast('Sign in to save pieces to your wishlist.', 'info');
        navigate('/auth?redirect=/wishlist');
        return;
      }
      const data = await apiFetch<{ items: Product[]; inWishlist: boolean }>('/api/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      });
      setWishlist(data.items);
      showToast(
        data.inWishlist ? `${product.name} saved to wishlist.` : 'Removed from wishlist.',
        'success'
      );
    },
    [user, showToast, navigate]
  );

  const recordProductView = useCallback((product: Product) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      return [product, ...filtered].slice(0, 6);
    });
  }, []);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const value: StoreContextValue = {
    currentPath,
    navigate,
    user,
    hasAdmin,
    authLoading,
    login,
    register,
    claimAdmin,
    logout,
    refreshAuth,
    settings,
    categories,
    refreshStorefront,
    cartItems,
    cartCount,
    subtotalCents,
    shippingCents: effectiveShippingCents,
    freeShippingThresholdCents,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearLocalCartAfterOrder,
    isCartOpen,
    setIsCartOpen,
    wishlist,
    isInWishlist,
    toggleWishlist,
    recentlyViewed,
    recordProductView,
    toasts,
    showToast,
    dismissToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
