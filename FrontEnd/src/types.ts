export interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin';
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
  productCount?: number;
}

export interface ProductImage {
  id: number;
  imageUrl: string;
  altText: string;
  isPrimary: boolean;
}

export interface ProductSize {
  id: number;
  sizeLabel: string;
  stockQuantity: number;
}

export interface ProductColor {
  id: number;
  colorName: string;
  hexCode: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  regularPriceCents: number;
  salePriceCents: number | null;
  effectivePriceCents: number;
  discountPercent: number;
  stockQuantity: number;
  gender: 'men' | 'women' | 'unisex';
  isFeatured: boolean;
  isTrending: boolean;
  isNewArrival: boolean;
  isFlashSale: boolean;
  popularityScore: number;
  createdAt: string;
  images: ProductImage[];
  sizes: ProductSize[];
  colors: ProductColor[];
  avgRating: number;
  reviewCount: number;
}

export interface CartItem {
  id: number | string;
  productId: number;
  name: string;
  slug: string;
  brand: string;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
  unitPriceCents: number;
  regularPriceCents: number;
  lineTotalCents: number;
  imageUrl: string;
  availableStock: number;
  availableSizes?: ProductSize[];
  availableColors?: ProductColor[];
}

export interface Review {
  id: number;
  reviewerName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  productId?: number;
  productName?: string;
  status?: string;
}

export interface Address {
  id: number;
  label: string;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  streetAddress: string;
  postalCode: string;
  isDefault: boolean;
}

export interface OrderItem {
  id: number;
  productId: number | null;
  productName: string;
  productImage: string;
  selectedSize: string;
  selectedColor: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingCountry: string;
  shippingCity: string;
  shippingAddress: string;
  shippingPostalCode: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  couponCode: string | null;
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  trackingNumber: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payment: {
    method: string;
    status: string;
    amountCents: number;
    referenceCode: string;
    createdAt: string;
  } | null;
}

export interface Coupon {
  id: number;
  code: string;
  discountPercent: number;
  minOrderCents: number;
  expiresAt: string;
  isActive: boolean;
}

export type StoreSettings = Record<string, string>;

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
