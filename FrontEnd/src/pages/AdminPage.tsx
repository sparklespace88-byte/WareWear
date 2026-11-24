import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  Edit3,
  ExternalLink,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import {
  formatPrice,
  type Category,
  type Coupon,
  type Order,
  type Product,
  type Review,
  type StoreSettings,
} from '../types';
import { SmartImage } from '../components/SmartImage';

type AdminSection =
  | 'overview'
  | 'products'
  | 'orders'
  | 'customers'
  | 'coupons'
  | 'reviews'
  | 'subscribers'
  | 'settings';

interface AdminStats {
  totalRevenueCents: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  pendingOrders: number;
  lowStockProducts: number;
  newsletterSubscribers: number;
}

interface CategoryRevenue {
  categoryName: string;
  revenueCents: number;
  unitsSold: number;
}

interface AdminCustomer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin';
  isActive: boolean;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
}

interface NewsletterSubscriber {
  id: number;
  email: string;
  subscribedAt: string;
}

export const AdminPage: React.FC = () => {
  const {
    user,
    hasAdmin,
    authLoading,
    login,
    logout,
    claimAdmin,
    navigate,
    categories,
    refreshStorefront,
    showToast,
  } = useStore();

  const [section, setSection] = useState<AdminSection>('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [revenueByCategory, setRevenueByCategory] = useState<CategoryRevenue[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockList, setLowStockList] = useState<
    Array<{ id: number; name: string; sku: string; stock_quantity: number; category_name: string }>
  >([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [settingsForm, setSettingsForm] = useState<StoreSettings>({});

  // Search & Filter states
  const [productQuery, setProductQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<number, string>>({});
  const [customerQuery, setCustomerQuery] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('all');
  const [subscriberQuery, setSubscriberQuery] = useState('');

  // Dedicated Admin login form
  const [adminLoginEmail, setAdminLoginEmail] = useState('');
  const [adminLoginPassword, setAdminLoginPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [loggingInAdmin, setLoggingInAdmin] = useState(false);

  // First-run admin claim form (only when zero admins exist in DB)
  const [claimName, setClaimName] = useState('WAREWEAR Administrator');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimPasscode, setClaimPasscode] = useState('');
  const [claiming, setClaiming] = useState(false);

  // Product editor drawer state
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pBrand, setPBrand] = useState('WAREWEAR STUDIO');
  const [pCategoryId, setPCategoryId] = useState<number>(1);
  const [pRegularPrice, setPRegularPrice] = useState('');
  const [pSalePrice, setPSalePrice] = useState('');
  const [pGender, setPGender] = useState<'men' | 'women' | 'unisex'>('unisex');
  const [pDescription, setPDescription] = useState('');
  const [pImages, setPImages] = useState<string[]>([]);
  const [pImageUrlInput, setPImageUrlInput] = useState('');
  const [pSizesText, setPSizesText] = useState('S:10, M:15, L:12, XL:6');
  const [pColorsText, setPColorsText] = useState('Obsidian Black:#111111, Warm Sand:#D6C3A5');
  const [pFeatured, setPFeatured] = useState(true);
  const [pTrending, setPTrending] = useState(false);
  const [pNewArrival, setPNewArrival] = useState(true);
  const [pFlashSale, setPFlashSale] = useState(false);

  // Category create & inline edit state
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatImg, setNewCatImg] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatImg, setEditCatImg] = useState('');

  // New Coupon
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPct, setNewCouponPct] = useState('15');
  const [newCouponMin, setNewCouponMin] = useState('100');
  const [newCouponExpiry, setNewCouponExpiry] = useState('2027-12-31');

  const loadAdminData = async () => {
    try {
      const [statsRes, prodRes, ordRes, custRes, coupRes, revRes, newsRes, setRes] =
        await Promise.all([
          apiFetch<{
            stats: AdminStats;
            recentOrders: Order[];
            lowStockList: any[];
            revenueByCategory: CategoryRevenue[];
          }>('/api/admin/stats'),
          apiFetch<{ products: Product[] }>('/api/admin/products'),
          apiFetch<{ orders: Order[] }>('/api/admin/orders'),
          apiFetch<{ customers: AdminCustomer[] }>('/api/admin/customers'),
          apiFetch<{ coupons: Coupon[] }>('/api/admin/coupons'),
          apiFetch<{ reviews: Review[] }>('/api/admin/reviews'),
          apiFetch<{ subscribers: NewsletterSubscriber[] }>('/api/admin/newsletter'),
          apiFetch<{ settings: StoreSettings }>('/api/admin/settings'),
        ]);
      setStats(statsRes.stats);
      setRevenueByCategory(statsRes.revenueByCategory || []);
      setRecentOrders(statsRes.recentOrders);
      setLowStockList(statsRes.lowStockList);
      setProducts(prodRes.products);
      setOrders(ordRes.orders);
      setTrackingDrafts(
        Object.fromEntries(ordRes.orders.map((o) => [o.id, o.trackingNumber || '']))
      );
      setCustomers(custRes.customers);
      setCoupons(coupRes.coupons);
      setReviews(revRes.reviews);
      setSubscribers(newsRes.subscribers);
      setSettingsForm(setRes.settings);
    } catch {
      // handled by role check
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadAdminData();
    }
  }, [user]);

  useEffect(() => {
    if (categories.length > 0 && !pCategoryId) {
      setPCategoryId(categories[0].id);
    }
  }, [categories, pCategoryId]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat =
        productCategoryFilter === 'all' || String(p.categoryId) === productCategoryFilter;
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [products, productQuery, productCategoryFilter]);

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
      const matchesQ =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q);
      return matchesStatus && matchesQ;
    });
  }, [orders, orderQuery, orderStatusFilter]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return customers.filter(
      (c) =>
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, customerQuery]);

  const filteredReviews = useMemo(() => {
    if (reviewStatusFilter === 'all') return reviews;
    return reviews.filter((r) => r.status === reviewStatusFilter);
  }, [reviews, reviewStatusFilter]);

  const filteredSubscribers = useMemo(() => {
    const q = subscriberQuery.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter((s) => s.email.toLowerCase().includes(q));
  }, [subscribers, subscriberQuery]);

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-sm text-[#6B6B6B]">
        Loading control center...
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    if (!hasAdmin) {
      return (
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="bg-white border border-black/10 p-8 space-y-5">
            <div className="flex items-center gap-2.5 text-[#111111]">
              <ShieldCheck className="w-6 h-6" />
              <h1 className="font-display text-2xl font-bold">Administrator Initialization</h1>
            </div>
            <p className="text-sm text-[#555555]">
              Initialize the primary WAREWEAR administrator account to unlock store backend operations.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setClaiming(true);
                try {
                  await claimAdmin({
                    fullName: claimName,
                    email: claimEmail,
                    phone: '+1 212 555 0100',
                    password: claimPassword,
                    adminPasscode: claimPasscode,
                  });
                  showToast('Backend Dashboard unlocked.', 'success');
                } catch (err: any) {
                  showToast(err.message, 'error');
                } finally {
                  setClaiming(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder="admin@warewear.com"
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">
                  Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={claimPassword}
                  onChange={(e) => setClaimPassword(e.target.value)}
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">
                  Admin Passcode (if configured in server .env)
                </label>
                <input
                  type="password"
                  value={claimPasscode}
                  onChange={(e) => setClaimPasscode(e.target.value)}
                  placeholder="Optional unless ADMIN_PASSCODE is set"
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={claiming}
                className="w-full py-3.5 bg-[#111111] text-white text-sm font-semibold hover:bg-[#333333] transition-colors cursor-pointer"
              >
                {claiming ? 'Activating...' : 'Activate Admin Account'}
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-black/10 p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-[#111111]">
            <ShieldCheck className="w-6 h-6" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B6B6B]">WAREWEAR</p>
              <h1 className="font-display text-2xl font-bold">Admin Backend Login</h1>
            </div>
          </div>
          <p className="text-xs text-[#6B6B6B]">
            Sign in with your administrator credentials. Customer accounts cannot access this portal.
          </p>
          {adminLoginError && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">
              {adminLoginError}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAdminLoginError('');
              setLoggingInAdmin(true);
              try {
                await login(adminLoginEmail, adminLoginPassword, true, true);
                showToast('Welcome to WAREWEAR Backend.', 'success');
              } catch (err: any) {
                setAdminLoginError(err.message || 'Administrator sign in failed.');
              } finally {
                setLoggingInAdmin(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">
                Administrator Email
              </label>
              <input
                type="email"
                required
                value={adminLoginEmail}
                onChange={(e) => setAdminLoginEmail(e.target.value)}
                placeholder="admin@warewear.com"
                className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#333333] mb-1">Password</label>
              <input
                type="password"
                required
                value={adminLoginPassword}
                onChange={(e) => setAdminLoginPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
            <button
              type="submit"
              disabled={loggingInAdmin}
              className="w-full py-3.5 bg-[#111111] text-white text-sm font-semibold hover:bg-[#333333] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loggingInAdmin ? 'Verifying...' : 'Sign In to Backend'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const openNewProductForm = () => {
    setEditingProductId(null);
    setPName('');
    setPSku(`WW-${Date.now().toString().slice(-4)}`);
    setPBrand('WAREWEAR STUDIO');
    setPCategoryId(categories[0]?.id ?? 1);
    setPRegularPrice('145');
    setPSalePrice('');
    setPGender('unisex');
    setPDescription('');
    setPImages(['/src/assets/images/prod_minimal_tee_1795446485007.jpg']);
    setPSizesText('S:10, M:15, L:12, XL:6');
    setPColorsText('Obsidian Black:#111111, Warm Sand:#D6C3A5');
    setPFeatured(true);
    setPTrending(false);
    setPNewArrival(true);
    setPFlashSale(false);
    setShowProductForm(true);
  };

  const openEditProductForm = (p: Product) => {
    setEditingProductId(p.id);
    setPName(p.name);
    setPSku(p.sku);
    setPBrand(p.brand);
    setPCategoryId(p.categoryId);
    setPRegularPrice((p.regularPriceCents / 100).toFixed(2));
    setPSalePrice(p.salePriceCents ? (p.salePriceCents / 100).toFixed(2) : '');
    setPGender(p.gender);
    setPDescription(p.description);
    setPImages(p.images.map((i) => i.imageUrl));
    setPSizesText(p.sizes.map((s) => `${s.sizeLabel}:${s.stockQuantity}`).join(', '));
    setPColorsText(p.colors.map((c) => `${c.colorName}:${c.hexCode}`).join(', '));
    setPFeatured(p.isFeatured);
    setPTrending(p.isTrending);
    setPNewArrival(p.isNewArrival);
    setPFlashSale(p.isFlashSale);
    setShowProductForm(true);
  };

  const uploadSingleImage = (file: File, onSuccess: (url: string) => void) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch<{ url: string }>('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: reader.result }),
        });
        onSuccess(res.url);
        showToast('Image uploaded and synced.', 'success');
      } catch (err: any) {
        showToast(err.message || 'Upload failed.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadSingleImage(file, (url) => setPImages((prev) => [...prev, url]));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const sizes = pSizesText
      .split(',')
      .map((chunk) => {
        const [label, qty] = chunk.split(':').map((s) => s.trim());
        return label ? { sizeLabel: label, stockQuantity: Math.max(0, Number(qty ?? 10)) } : null;
      })
      .filter(Boolean);

    const colors = pColorsText
      .split(',')
      .map((chunk) => {
        const [name, hex] = chunk.split(':').map((s) => s.trim());
        return name ? { colorName: name, hexCode: hex || '#111111' } : null;
      })
      .filter(Boolean);

    const payload = {
      name: pName,
      sku: pSku,
      brand: pBrand,
      categoryId: Number(pCategoryId),
      regularPrice: Number(pRegularPrice),
      salePrice: pSalePrice ? Number(pSalePrice) : null,
      gender: pGender,
      description: pDescription,
      images: pImages,
      sizes,
      colors,
      isFeatured: pFeatured,
      isTrending: pTrending,
      isNewArrival: pNewArrival,
      isFlashSale: pFlashSale,
    };

    try {
      if (editingProductId) {
        await apiFetch(`/api/admin/products/${editingProductId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Product updated and synced to storefront.', 'success');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Product created and live on storefront.', 'success');
      }
      setShowProductForm(false);
      await Promise.all([loadAdminData(), refreshStorefront()]);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleQuickFlagToggle = async (
    product: Product,
    field: 'isFeatured' | 'isTrending' | 'isNewArrival' | 'isFlashSale'
  ) => {
    try {
      const res = await apiFetch<{ product: Product }>(`/api/admin/products/${product.id}/quick`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: !product[field] }),
      });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? res.product : p)));
      showToast(`${product.name} updated.`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleQuickRestock = async (productId: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod || prod.sizes.length === 0) return;
    try {
      const updatedSizes = prod.sizes.map((s) => ({
        sizeLabel: s.sizeLabel,
        stockQuantity: s.stockQuantity + 10,
      }));
      await apiFetch(`/api/admin/products/${productId}/quick`, {
        method: 'PATCH',
        body: JSON.stringify({ sizes: updatedSizes }),
      });
      showToast(`Restocked +10 units per size for ${prod.name}.`, 'success');
      await loadAdminData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    showToast('Product removed from catalog.', 'info');
    await Promise.all([loadAdminData(), refreshStorefront()]);
  };

  const handleOrderUpdate = async (
    orderId: number,
    updates: { status?: string; trackingNumber?: string; paymentStatus?: string }
  ) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    try {
      const res = await apiFetch<{ order: Order }>(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: updates.status ?? target.status,
          trackingNumber: updates.trackingNumber ?? trackingDrafts[orderId] ?? target.trackingNumber,
          paymentStatus: updates.paymentStatus,
        }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      showToast(`Order ${res.order.orderNumber} synced.`, 'success');
      await loadAdminData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleCustomerActive = async (cust: AdminCustomer) => {
    try {
      await apiFetch(`/api/admin/customers/${cust.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !cust.isActive }),
      });
      showToast(`Account ${cust.isActive ? 'suspended' : 'activated'}.`, 'info');
      await loadAdminData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleChangeCustomerRole = async (cust: AdminCustomer, role: 'customer' | 'admin') => {
    try {
      await apiFetch(`/api/admin/customers/${cust.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      showToast(`${cust.fullName} role updated to ${role}.`, 'success');
      await loadAdminData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: newCouponCode,
          discountPercent: Number(newCouponPct),
          minOrder: Number(newCouponMin),
          expiresAt: `${newCouponExpiry}T23:59:59Z`,
        }),
      });
      setNewCouponCode('');
      showToast('Coupon created.', 'success');
      await loadAdminData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: settingsForm }),
      });
      await refreshStorefront();
      showToast('Storefront settings saved and synced live.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const maxCatRevenue = Math.max(1, ...revenueByCategory.map((c) => c.revenueCents));

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[235px_1fr] gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="bg-white border border-black/10 p-2.5 flex lg:flex-col gap-1 overflow-x-auto">
          {[
            { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
            { id: 'products' as const, label: 'Products & Categories', icon: Package },
            { id: 'orders' as const, label: 'Orders', icon: ShoppingCart, badge: stats?.pendingOrders },
            { id: 'customers' as const, label: 'Customers', icon: Users },
            { id: 'coupons' as const, label: 'Coupons', icon: Tag },
            { id: 'reviews' as const, label: 'Reviews', icon: MessageSquare },
            { id: 'subscribers' as const, label: 'Subscribers', icon: Mail, badge: subscribers.length },
            { id: 'settings' as const, label: 'Storefront Settings', icon: Settings },
          ].map((nav) => {
            const Icon = nav.icon;
            const active = section === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => setSection(nav.id)}
                className={`shrink-0 lg:w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-medium text-left transition-colors cursor-pointer ${
                  active ? 'bg-[#111111] text-white' : 'text-[#333333] hover:bg-[#F7F7F7]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{nav.label}</span>
                </span>
                {typeof nav.badge === 'number' && nav.badge > 0 && (
                  <span
                    className={`font-mono-tabular text-[11px] ${
                      active ? 'text-[#D6C3A5]' : 'text-[#6B6B6B]'
                    }`}
                  >
                    {nav.badge}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/admin');
            }}
            className="shrink-0 lg:w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-left text-red-700 hover:bg-red-50 transition-colors cursor-pointer lg:mt-2 lg:border-t lg:border-black/10 lg:pt-3"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </aside>

        <div className="space-y-8 min-w-0">
          {/* OVERVIEW */}
          {section === 'overview' && stats && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-4">
                {[
                  { label: 'Revenue', val: formatPrice(stats.totalRevenueCents) },
                  { label: 'Orders', val: String(stats.totalOrders) },
                  { label: 'Products', val: String(stats.totalProducts) },
                  { label: 'Customers', val: String(stats.totalCustomers) },
                  { label: 'Pending', val: String(stats.pendingOrders) },
                  { label: 'Low Stock', val: String(stats.lowStockProducts) },
                  { label: 'Subscribers', val: String(stats.newsletterSubscribers) },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white border border-black/10 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-[#6B6B6B]">{kpi.label}</p>
                    <p className="font-mono-tabular text-xl sm:text-2xl font-bold text-[#111111] mt-2">
                      {kpi.val}
                    </p>
                  </div>
                ))}
              </div>

              {/* Revenue by Category */}
              <div className="bg-white border border-black/10 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-[#111111]">
                      Revenue by Category
                    </h2>
                    <p className="text-xs text-[#6B6B6B]">
                      Calculated live from confirmed and completed storefront orders.
                    </p>
                  </div>
                </div>
                <div className="space-y-3.5">
                  {revenueByCategory.map((cat) => {
                    const pct = Math.max(4, Math.round((cat.revenueCents / maxCatRevenue) * 100));
                    return (
                      <div key={cat.categoryName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#111111]">{cat.categoryName}</span>
                          <span className="font-mono-tabular text-[#555555]">
                            {formatPrice(cat.revenueCents)} · {cat.unitsSold} sold
                          </span>
                        </div>
                        <div className="h-2 bg-[#F7F7F7] w-full overflow-hidden">
                          <div
                            className="h-full bg-[#111111] transition-all duration-500"
                            style={{ width: `${cat.revenueCents > 0 ? pct : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white border border-black/10 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-lg font-semibold text-[#111111]">
                      Recent Orders
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSection('orders')}
                      className="text-xs font-medium text-[#111111] underline cursor-pointer"
                    >
                      Manage All
                    </button>
                  </div>
                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-[#6B6B6B]">No orders recorded yet.</p>
                  ) : (
                    <div className="divide-y divide-black/8 text-sm">
                      {recentOrders.map((o) => (
                        <div key={o.id} className="py-3 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-mono-tabular font-semibold text-[#111111]">
                              {o.orderNumber}
                            </p>
                            <p className="text-xs text-[#6B6B6B]">
                              {o.customerName} · {o.status}
                            </p>
                          </div>
                          <span className="font-mono-tabular font-semibold text-[#111111]">
                            {formatPrice(o.totalCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-black/10 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-lg font-semibold text-[#111111]">
                      Low Stock Monitor
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSection('products')}
                      className="text-xs font-medium text-[#111111] underline cursor-pointer"
                    >
                      View Inventory
                    </button>
                  </div>
                  {lowStockList.length === 0 ? (
                    <p className="text-sm text-[#6B6B6B]">All products are comfortably stocked.</p>
                  ) : (
                    <div className="divide-y divide-black/8 text-sm">
                      {lowStockList.map((item) => (
                        <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-[#111111]">{item.name}</p>
                            <p className="text-xs text-[#6B6B6B]">
                              {item.sku} · {item.category_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono-tabular text-xs font-semibold text-amber-800">
                              {item.stock_quantity} left
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleQuickRestock(item.id)}
                              className="px-2.5 py-1 border border-black/20 text-[11px] font-semibold text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
                            >
                              +10 Restock
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* PRODUCTS & CATEGORIES */}
          {section === 'products' && (
            <div className="space-y-6">
              <div className="bg-white border border-black/10 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#111111]">
                      Catalog Inventory ({filteredProducts.length})
                    </h2>
                    <p className="text-xs text-[#6B6B6B]">
                      Toggle merchandising flags or edit pieces directly — synced live to storefront.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openNewProductForm}
                    className="px-5 py-2.5 bg-[#111111] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#333333] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </button>
                </div>

                {/* Search & Category Filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Search by product name, SKU, or category..."
                      className="w-full border border-black/20 pl-9 pr-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="border border-black/20 px-3 py-2 text-sm bg-white"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {showProductForm && (
                  <form
                    onSubmit={handleSaveProduct}
                    className="mb-8 p-6 bg-[#F7F7F7] border border-black/15 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold">
                        {editingProductId ? 'Edit Product' : 'New Product'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowProductForm(false)}
                        className="text-xs underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <input
                        type="text"
                        required
                        placeholder="Product Name"
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        className="bg-white border border-black/20 px-3 py-2 text-sm sm:col-span-2"
                      />
                      <input
                        type="text"
                        required
                        placeholder="SKU"
                        value={pSku}
                        onChange={(e) => setPSku(e.target.value)}
                        className="bg-white border border-black/20 px-3 py-2 text-sm font-mono-tabular"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <select
                        value={pCategoryId}
                        onChange={(e) => setPCategoryId(Number(e.target.value))}
                        className="bg-white border border-black/20 px-3 py-2 text-sm"
                      >
                        {categories.map((c: Category) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={pGender}
                        onChange={(e) => setPGender(e.target.value as any)}
                        className="bg-white border border-black/20 px-3 py-2 text-sm"
                      >
                        <option value="unisex">Unisex</option>
                        <option value="men">Men</option>
                        <option value="women">Women</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Regular Price ($)"
                        value={pRegularPrice}
                        onChange={(e) => setPRegularPrice(e.target.value)}
                        className="bg-white border border-black/20 px-3 py-2 text-sm font-mono-tabular"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Sale Price ($ optional)"
                        value={pSalePrice}
                        onChange={(e) => setPSalePrice(e.target.value)}
                        className="bg-white border border-black/20 px-3 py-2 text-sm font-mono-tabular"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Brand Line"
                        value={pBrand}
                        onChange={(e) => setPBrand(e.target.value)}
                        className="bg-white border border-black/20 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Sizes & Stock (e.g. S:10, M:15, L:8)"
                        value={pSizesText}
                        onChange={(e) => setPSizesText(e.target.value)}
                        className="bg-white border border-black/20 px-3 py-2 text-sm font-mono-tabular"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Colors (e.g. Obsidian Black:#111111, Warm Sand:#D6C3A5)"
                      value={pColorsText}
                      onChange={(e) => setPColorsText(e.target.value)}
                      className="w-full bg-white border border-black/20 px-3 py-2 text-sm"
                    />

                    <textarea
                      rows={2}
                      placeholder="Product description..."
                      value={pDescription}
                      onChange={(e) => setPDescription(e.target.value)}
                      className="w-full bg-white border border-black/20 px-3 py-2 text-sm"
                    />

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-[#111111]">
                        Product Images ({pImages.length})
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {pImages.map((url, idx) => (
                          <div key={idx} className="relative w-16 h-16 border border-black/15 bg-white">
                            <SmartImage src={url} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setPImages((prev) => prev.filter((_, i) => i !== idx))}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#111111] text-white text-[10px] rounded-full cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3.5 py-2 bg-white border border-black/20 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Image File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileUpload}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="text"
                          value={pImageUrlInput}
                          onChange={(e) => setPImageUrlInput(e.target.value)}
                          placeholder="Or paste image URL (/src/assets/images/...)"
                          className="flex-1 bg-white border border-black/20 px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (pImageUrlInput.trim()) {
                              setPImages((prev) => [...prev, pImageUrlInput.trim()]);
                              setPImageUrlInput('');
                            }
                          }}
                          className="px-3 py-2 bg-[#111111] text-white text-xs cursor-pointer"
                        >
                          Add URL
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pFeatured}
                          onChange={(e) => setPFeatured(e.target.checked)}
                        />
                        <span>Featured</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pTrending}
                          onChange={(e) => setPTrending(e.target.checked)}
                        />
                        <span>Trending</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pNewArrival}
                          onChange={(e) => setPNewArrival(e.target.checked)}
                        />
                        <span>New Arrival</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pFlashSale}
                          onChange={(e) => setPFlashSale(e.target.checked)}
                        />
                        <span>Flash Sale</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
                    >
                      {editingProductId ? 'Save Product Changes' : 'Create Product'}
                    </button>
                  </form>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-xs uppercase text-[#6B6B6B]">
                        <th className="py-3 pr-4">Piece</th>
                        <th className="py-3 pr-4">Category</th>
                        <th className="py-3 pr-4">Price</th>
                        <th className="py-3 pr-4">Stock</th>
                        <th className="py-3 pr-4">Live Storefront Flags</th>
                        <th className="py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/8">
                      {filteredProducts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <SmartImage
                                src={p.images[0]?.imageUrl}
                                alt={p.name}
                                className="w-11 h-11 object-cover bg-[#F7F7F7] shrink-0"
                              />
                              <div>
                                <p className="font-medium text-[#111111]">{p.name}</p>
                                <p className="text-xs font-mono-tabular text-[#6B6B6B]">{p.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-xs text-[#555555]">{p.categoryName}</td>
                          <td className="py-3 pr-4 font-mono-tabular whitespace-nowrap">
                            <span>{formatPrice(p.effectivePriceCents)}</span>
                            {p.salePriceCents && p.salePriceCents < p.regularPriceCents && (
                              <span className="ml-1.5 text-[11px] text-[#8E8E8E] line-through">
                                {formatPrice(p.regularPriceCents)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 font-mono-tabular">{p.stockQuantity}</td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {(
                                [
                                  { key: 'isNewArrival', label: 'New' },
                                  { key: 'isTrending', label: 'Trend' },
                                  { key: 'isFlashSale', label: 'Sale' },
                                  { key: 'isFeatured', label: 'Feat' },
                                ] as const
                              ).map((flag) => {
                                const on = p[flag.key];
                                return (
                                  <button
                                    key={flag.key}
                                    type="button"
                                    onClick={() => void handleQuickFlagToggle(p, flag.key)}
                                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border cursor-pointer transition-colors ${
                                      on
                                        ? 'bg-[#111111] text-white border-[#111111]'
                                        : 'bg-white text-[#6B6B6B] border-black/15 hover:border-black/40'
                                    }`}
                                  >
                                    {flag.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/product/${p.slug}`)}
                              aria-label={`View ${p.name} on storefront`}
                              title="View on storefront"
                              className="p-2 text-[#555555] hover:bg-black/5 cursor-pointer"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditProductForm(p)}
                              aria-label={`Edit ${p.name}`}
                              className="p-2 text-[#111111] hover:bg-black/5 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteProduct(p.id)}
                              aria-label={`Delete ${p.name}`}
                              className="p-2 text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Management */}
              <div className="bg-white border border-black/10 p-6 space-y-5">
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#111111]">
                    Categories ({categories.length})
                  </h3>
                  <p className="text-xs text-[#6B6B6B]">
                    Featured categories on the homepage and shop filters pull directly from these rows.
                  </p>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newCatName.trim()) return;
                    try {
                      await apiFetch('/api/admin/categories', {
                        method: 'POST',
                        body: JSON.stringify({
                          name: newCatName.trim(),
                          description: newCatDesc.trim(),
                          imageUrl: newCatImg.trim(),
                        }),
                      });
                      setNewCatName('');
                      setNewCatDesc('');
                      setNewCatImg('');
                      await refreshStorefront();
                      showToast('Category added and synced.', 'success');
                    } catch (err: any) {
                      showToast(err.message, 'error');
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-2"
                >
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New category name"
                    className="border border-black/20 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Short description (optional)"
                    className="border border-black/20 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={newCatImg}
                    onChange={(e) => setNewCatImg(e.target.value)}
                    placeholder="Image URL (optional)"
                    className="border border-black/20 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
                  >
                    Add Category
                  </button>
                </form>

                <div className="divide-y divide-black/8">
                  {categories.map((c) => {
                    const isEditing = editingCatId === c.id;
                    return (
                      <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                        {isEditing ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                              className="border border-black/20 px-2.5 py-1.5 text-xs"
                              placeholder="Name"
                            />
                            <input
                              type="text"
                              value={editCatDesc}
                              onChange={(e) => setEditCatDesc(e.target.value)}
                              className="border border-black/20 px-2.5 py-1.5 text-xs"
                              placeholder="Description"
                            />
                            <input
                              type="text"
                              value={editCatImg}
                              onChange={(e) => setEditCatImg(e.target.value)}
                              className="border border-black/20 px-2.5 py-1.5 text-xs"
                              placeholder="Image URL"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            {c.imageUrl && (
                              <SmartImage
                                src={c.imageUrl}
                                alt={c.name}
                                className="w-9 h-9 object-cover bg-[#F7F7F7] shrink-0"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium text-[#111111]">
                                {c.name}{' '}
                                <span className="font-mono-tabular text-xs text-[#6B6B6B]">
                                  ({c.productCount ?? 0} SKUs)
                                </span>
                              </p>
                              {c.description && (
                                <p className="text-xs text-[#6B6B6B]">{c.description}</p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/admin/categories/${c.id}`, {
                                      method: 'PUT',
                                      body: JSON.stringify({
                                        name: editCatName.trim(),
                                        description: editCatDesc.trim(),
                                        imageUrl: editCatImg.trim(),
                                      }),
                                    });
                                    setEditingCatId(null);
                                    await Promise.all([refreshStorefront(), loadAdminData()]);
                                    showToast('Category updated.', 'success');
                                  } catch (err: any) {
                                    showToast(err.message, 'error');
                                  }
                                }}
                                className="p-1.5 bg-[#111111] text-white cursor-pointer"
                                aria-label="Save category"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCatId(null)}
                                className="p-1.5 border border-black/20 text-[#333333] cursor-pointer"
                                aria-label="Cancel category edit"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(c.id);
                                  setEditCatName(c.name);
                                  setEditCatDesc(c.description || '');
                                  setEditCatImg(c.imageUrl || '');
                                }}
                                className="p-1.5 text-[#333333] hover:bg-black/5 cursor-pointer"
                                aria-label={`Edit ${c.name}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/admin/categories/${c.id}`, {
                                      method: 'DELETE',
                                    });
                                    await Promise.all([refreshStorefront(), loadAdminData()]);
                                    showToast('Category deleted.', 'info');
                                  } catch (err: any) {
                                    showToast(err.message, 'error');
                                  }
                                }}
                                className="p-1.5 text-red-700 hover:bg-red-50 cursor-pointer"
                                aria-label={`Delete ${c.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {section === 'orders' && (
            <div className="bg-white border border-black/10 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-xl font-semibold text-[#111111]">
                  Order Fulfillment ({filteredOrders.length})
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={orderQuery}
                      onChange={(e) => setOrderQuery(e.target.value)}
                      placeholder="Order # or customer..."
                      className="border border-black/20 pl-8 pr-3 py-1.5 text-xs bg-white"
                    />
                  </div>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="border border-black/20 px-3 py-1.5 text-xs bg-white"
                  >
                    <option value="all">All Statuses</option>
                    {['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(
                      (st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <p className="text-sm text-[#6B6B6B]">No orders matching your filter.</p>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    return (
                      <div key={order.id} className="p-4 border border-black/12 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="font-mono-tabular text-sm font-bold text-[#111111]">
                              {order.orderNumber} · {formatPrice(order.totalCents)}
                            </p>
                            <p className="text-xs text-[#6B6B6B]">
                              {order.customerName} ({order.customerEmail}) · {order.shippingCity},{' '}
                              {order.shippingCountry}
                            </p>
                            <p className="text-xs font-mono-tabular text-[#555555] mt-0.5">
                              {new Date(order.createdAt).toLocaleString()} · {order.payment?.method} (
                              {order.payment?.status ?? 'Pending'})
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={order.status}
                              onChange={(e) =>
                                void handleOrderUpdate(order.id, { status: e.target.value })
                              }
                              aria-label={`Order status for ${order.orderNumber}`}
                              className="border border-black/20 px-2.5 py-1.5 text-xs font-medium bg-white"
                            >
                              {[
                                'Pending',
                                'Confirmed',
                                'Processing',
                                'Shipped',
                                'Delivered',
                                'Cancelled',
                              ].map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>

                            <select
                              value={order.payment?.status ?? 'Pending'}
                              onChange={(e) =>
                                void handleOrderUpdate(order.id, { paymentStatus: e.target.value })
                              }
                              aria-label={`Payment status for ${order.orderNumber}`}
                              className="border border-black/20 px-2.5 py-1.5 text-xs bg-white"
                            >
                              {['Pending', 'Authorized', 'Paid', 'Refunded', 'Failed'].map((ps) => (
                                <option key={ps} value={ps}>
                                  Pay: {ps}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                              className="px-2.5 py-1.5 border border-black/20 text-xs text-[#111111] hover:bg-[#F7F7F7] cursor-pointer"
                            >
                              {isExpanded ? 'Hide Details' : 'Details'}
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-[#555555] flex flex-wrap gap-3 pt-2 border-t border-black/8">
                          {order.items.map((item) => (
                            <span key={item.id}>
                              {item.productName} ({item.selectedSize} · {item.selectedColor}) ×
                              {item.quantity}
                            </span>
                          ))}
                        </div>

                        {isExpanded && (
                          <div className="pt-3 border-t border-black/8 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-[#F7F7F7] p-3">
                            <div>
                              <p className="font-semibold text-[#111111] mb-1">Shipping Address</p>
                              <p className="text-[#555555]">{order.customerPhone}</p>
                              <p className="text-[#555555]">{order.shippingAddress}</p>
                              <p className="text-[#555555]">
                                {order.shippingCity}, {order.shippingPostalCode},{' '}
                                {order.shippingCountry}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="font-semibold text-[#111111]">Tracking Number</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={trackingDrafts[order.id] ?? ''}
                                  onChange={(e) =>
                                    setTrackingDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: e.target.value,
                                    }))
                                  }
                                  className="flex-1 border border-black/20 bg-white px-2.5 py-1.5 font-mono-tabular text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleOrderUpdate(order.id, {
                                      trackingNumber: trackingDrafts[order.id],
                                    })
                                  }
                                  className="px-3 py-1.5 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
                                >
                                  Save Tracking
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CUSTOMERS */}
          {section === 'customers' && (
            <div className="bg-white border border-black/10 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-xl font-semibold text-[#111111]">
                  Registered Accounts ({filteredCustomers.length})
                </h2>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Search accounts..."
                    className="border border-black/20 pl-8 pr-3 py-1.5 text-xs bg-white"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-xs uppercase text-[#6B6B6B]">
                      <th className="py-3 pr-4">Customer</th>
                      <th className="py-3 pr-4">Role</th>
                      <th className="py-3 pr-4">Orders</th>
                      <th className="py-3 pr-4">Spent</th>
                      <th className="py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/8">
                    {filteredCustomers.map((c) => (
                      <tr key={c.id}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-[#111111]">{c.fullName}</p>
                          <p className="text-xs text-[#6B6B6B]">
                            {c.email} · {c.phone}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          {c.id === user.id ? (
                            <span className="text-xs uppercase font-semibold text-[#111111]">
                              {c.role} (You)
                            </span>
                          ) : (
                            <select
                              value={c.role}
                              onChange={(e) =>
                                void handleChangeCustomerRole(
                                  c,
                                  e.target.value as 'customer' | 'admin'
                                )
                              }
                              className="border border-black/20 px-2 py-1 text-xs uppercase bg-white"
                            >
                              <option value="customer">customer</option>
                              <option value="admin">admin</option>
                            </select>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-mono-tabular">{c.orderCount}</td>
                        <td className="py-3 pr-4 font-mono-tabular">
                          {formatPrice(c.totalSpentCents)}
                        </td>
                        <td className="py-3 text-right">
                          {c.id !== user.id && (
                            <button
                              type="button"
                              onClick={() => void handleToggleCustomerActive(c)}
                              className={`px-3 py-1 text-xs border cursor-pointer ${
                                c.isActive
                                  ? 'border-black/20 text-[#111111]'
                                  : 'border-red-300 text-red-700'
                              }`}
                            >
                              {c.isActive ? 'Active (Suspend)' : 'Suspended (Activate)'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COUPONS */}
          {section === 'coupons' && (
            <div className="bg-white border border-black/10 p-6 space-y-6">
              <h2 className="font-display text-xl font-semibold text-[#111111]">
                Promotional Coupons
              </h2>
              <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Code (e.g. WINTER20)"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value)}
                  className="border border-black/20 px-3 py-2 text-sm uppercase font-mono-tabular"
                />
                <input
                  type="number"
                  min="1"
                  max="90"
                  required
                  placeholder="Discount %"
                  value={newCouponPct}
                  onChange={(e) => setNewCouponPct(e.target.value)}
                  className="border border-black/20 px-3 py-2 text-sm font-mono-tabular"
                />
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="Min Order ($)"
                  value={newCouponMin}
                  onChange={(e) => setNewCouponMin(e.target.value)}
                  className="border border-black/20 px-3 py-2 text-sm font-mono-tabular"
                />
                <input
                  type="date"
                  required
                  value={newCouponExpiry}
                  onChange={(e) => setNewCouponExpiry(e.target.value)}
                  className="border border-black/20 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="bg-[#111111] text-white text-xs font-semibold py-2 px-4 cursor-pointer"
                >
                  Create Coupon
                </button>
              </form>

              <div className="divide-y divide-black/8 text-sm">
                {coupons.map((c) => (
                  <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="font-mono-tabular font-bold text-[#111111]">{c.code}</span>
                      <span className="text-xs text-[#6B6B6B] ml-3">
                        {c.discountPercent}% off · Min {formatPrice(c.minOrderCents)} · Expires{' '}
                        {new Date(c.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/coupons/${c.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ isActive: !c.isActive }),
                          });
                          await loadAdminData();
                        }}
                        className={`px-3 py-1 text-xs border cursor-pointer ${
                          c.isActive
                            ? 'border-[#111111] bg-[#111111] text-white'
                            : 'border-black/20 text-[#6B6B6B]'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/coupons/${c.id}`, { method: 'DELETE' });
                          await loadAdminData();
                        }}
                        className="p-1.5 text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REVIEWS */}
          {section === 'reviews' && (
            <div className="bg-white border border-black/10 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-xl font-semibold text-[#111111]">
                  Review Moderation ({filteredReviews.length})
                </h2>
                <select
                  value={reviewStatusFilter}
                  onChange={(e) => setReviewStatusFilter(e.target.value)}
                  className="border border-black/20 px-3 py-1.5 text-xs bg-white"
                >
                  <option value="all">All Reviews</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Hidden">Hidden</option>
                </select>
              </div>
              <div className="divide-y divide-black/8">
                {filteredReviews.map((r) => (
                  <div
                    key={r.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">
                        {r.productName} · <span className="font-mono-tabular">{r.rating}/5</span> by{' '}
                        {r.reviewerName}
                      </p>
                      <p className="text-xs text-[#555555] mt-1">{r.comment}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={r.status}
                        onChange={async (e) => {
                          await apiFetch(`/api/admin/reviews/${r.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ status: e.target.value }),
                          });
                          await loadAdminData();
                        }}
                        className="border border-black/20 px-2.5 py-1 text-xs bg-white"
                      >
                        <option value="Approved">Approved</option>
                        <option value="Pending">Pending</option>
                        <option value="Hidden">Hidden</option>
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/reviews/${r.id}`, { method: 'DELETE' });
                          await loadAdminData();
                        }}
                        className="p-1.5 text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NEWSLETTER SUBSCRIBERS */}
          {section === 'subscribers' && (
            <div className="bg-white border border-black/10 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#111111]">
                    Newsletter Subscribers ({filteredSubscribers.length})
                  </h2>
                  <p className="text-xs text-[#6B6B6B]">
                    Emails captured live from the homepage and footer newsletter forms.
                  </p>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={subscriberQuery}
                    onChange={(e) => setSubscriberQuery(e.target.value)}
                    placeholder="Filter subscriber email..."
                    className="border border-black/20 pl-8 pr-3 py-1.5 text-xs bg-white"
                  />
                </div>
              </div>
              {filteredSubscribers.length === 0 ? (
                <p className="text-sm text-[#6B6B6B]">No subscribers recorded yet.</p>
              ) : (
                <div className="divide-y divide-black/8 text-sm">
                  {filteredSubscribers.map((sub) => (
                    <div key={sub.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-[#111111]">{sub.email}</p>
                        <p className="text-xs font-mono-tabular text-[#6B6B6B]">
                          Subscribed {new Date(sub.subscribedAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/newsletter/${sub.id}`, { method: 'DELETE' });
                          showToast('Subscriber removed.', 'info');
                          await loadAdminData();
                        }}
                        className="p-1.5 text-red-700 hover:bg-red-50 cursor-pointer"
                        aria-label={`Remove ${sub.email}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STOREFRONT SETTINGS */}
          {section === 'settings' && (
            <form onSubmit={handleSaveSettings} className="bg-white border border-black/10 p-6 space-y-5">
              <div>
                <h2 className="font-display text-xl font-semibold text-[#111111]">
                  Storefront Banners &amp; Live Settings
                </h2>
                <p className="text-xs text-[#6B6B6B] mt-1">
                  Updates made here immediately modify the homepage hero, announcement bar, offer banner,
                  footer contact info, and checkout shipping thresholds.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'announcement_text', label: 'Announcement Bar Text', span: true },
                  { key: 'hero_heading', label: 'Hero Heading', span: false },
                  { key: 'hero_subtitle', label: 'Hero Subtitle', span: false },
                  { key: 'offer_banner_title', label: 'Offer Banner Title', span: false },
                  { key: 'offer_banner_subtitle', label: 'Offer Banner Description', span: false },
                  { key: 'support_email', label: 'Support Email', span: false },
                  { key: 'support_phone', label: 'Support Phone', span: false },
                  {
                    key: 'free_shipping_threshold_cents',
                    label: 'Free Shipping Threshold (Cents)',
                    span: false,
                  },
                  {
                    key: 'standard_shipping_cents',
                    label: 'Standard Shipping Fee (Cents)',
                    span: false,
                  },
                ].map((field) => (
                  <div key={field.key} className={field.span ? 'md:col-span-2' : ''}>
                    <label className="block text-xs font-medium text-[#333333] mb-1">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={settingsForm[field.key] ?? ''}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full border border-black/20 px-3.5 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Hero & Offer Banner Image Uploaders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-black/8">
                {(
                  [
                    { key: 'hero_image', label: 'Hero Editorial Banner Image' },
                    { key: 'offer_banner_image', label: 'Special Offer Banner Image' },
                  ] as const
                ).map((imgField) => (
                  <div key={imgField.key} className="space-y-2">
                    <label className="block text-xs font-semibold text-[#111111]">
                      {imgField.label}
                    </label>
                    <div className="aspect-[16/9] bg-[#F7F7F7] border border-black/10 overflow-hidden">
                      <SmartImage
                        src={settingsForm[imgField.key]}
                        alt={imgField.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={settingsForm[imgField.key] ?? ''}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({ ...prev, [imgField.key]: e.target.value }))
                        }
                        className="flex-1 border border-black/20 px-3 py-1.5 text-xs"
                      />
                      <label className="px-3 py-1.5 border border-black/20 bg-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#F7F7F7]">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            uploadSingleImage(file, (url) =>
                              setSettingsForm((prev) => ({ ...prev, [imgField.key]: url }))
                            );
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="px-7 py-3 bg-[#111111] text-white text-xs font-semibold hover:bg-[#333333] transition-colors cursor-pointer"
              >
                Save &amp; Sync Storefront Settings
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
