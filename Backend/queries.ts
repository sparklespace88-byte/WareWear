import { db } from './db.ts';

export interface ProductDTO {
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
  images: Array<{ id: number; imageUrl: string; altText: string; isPrimary: boolean }>;
  sizes: Array<{ id: number; sizeLabel: string; stockQuantity: number }>;
  colors: Array<{ id: number; colorName: string; hexCode: string }>;
  avgRating: number;
  reviewCount: number;
}

interface RawProductRow {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  regular_price_cents: number;
  sale_price_cents: number | null;
  stock_quantity: number;
  gender: 'men' | 'women' | 'unisex';
  is_featured: number;
  is_trending: number;
  is_new_arrival: number;
  is_flash_sale: number;
  popularity_score: number;
  created_at: string;
}

export function hydrateProducts(rows: RawProductRow[]): ProductDTO[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const images = db
    .prepare(
      `SELECT id, product_id, image_url, alt_text, is_primary FROM product_images WHERE product_id IN (${placeholders}) ORDER BY is_primary DESC, sort_order ASC, id ASC`
    )
    .all(...ids) as Array<{
    id: number;
    product_id: number;
    image_url: string;
    alt_text: string;
    is_primary: number;
  }>;

  const sizes = db
    .prepare(
      `SELECT id, product_id, size_label, stock_quantity FROM product_sizes WHERE product_id IN (${placeholders}) ORDER BY id ASC`
    )
    .all(...ids) as Array<{
    id: number;
    product_id: number;
    size_label: string;
    stock_quantity: number;
  }>;

  const colors = db
    .prepare(
      `SELECT id, product_id, color_name, hex_code FROM product_colors WHERE product_id IN (${placeholders}) ORDER BY id ASC`
    )
    .all(...ids) as Array<{
    id: number;
    product_id: number;
    color_name: string;
    hex_code: string;
  }>;

  const ratingStats = db
    .prepare(
      `SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
       FROM reviews
       WHERE product_id IN (${placeholders}) AND status = 'Approved'
       GROUP BY product_id`
    )
    .all(...ids) as Array<{
    product_id: number;
    avg_rating: number;
    review_count: number;
  }>;

  const imgMap = new Map<number, ProductDTO['images']>();
  for (const img of images) {
    const arr = imgMap.get(img.product_id) ?? [];
    arr.push({
      id: img.id,
      imageUrl: img.image_url,
      altText: img.alt_text,
      isPrimary: img.is_primary === 1,
    });
    imgMap.set(img.product_id, arr);
  }

  const sizeMap = new Map<number, ProductDTO['sizes']>();
  for (const s of sizes) {
    const arr = sizeMap.get(s.product_id) ?? [];
    arr.push({
      id: s.id,
      sizeLabel: s.size_label,
      stockQuantity: s.stock_quantity,
    });
    sizeMap.set(s.product_id, arr);
  }

  const colorMap = new Map<number, ProductDTO['colors']>();
  for (const c of colors) {
    const arr = colorMap.get(c.product_id) ?? [];
    arr.push({
      id: c.id,
      colorName: c.color_name,
      hexCode: c.hex_code,
    });
    colorMap.set(c.product_id, arr);
  }

  const ratingMap = new Map<number, { avg: number; count: number }>();
  for (const r of ratingStats) {
    ratingMap.set(r.product_id, {
      avg: Math.round(r.avg_rating * 10) / 10,
      count: r.review_count,
    });
  }

  return rows.map((r) => {
    const effective = r.sale_price_cents !== null && r.sale_price_cents < r.regular_price_cents
      ? r.sale_price_cents
      : r.regular_price_cents;
    const discountPercent =
      r.sale_price_cents !== null && r.regular_price_cents > 0 && r.sale_price_cents < r.regular_price_cents
        ? Math.round(((r.regular_price_cents - r.sale_price_cents) / r.regular_price_cents) * 100)
        : 0;
    const stats = ratingMap.get(r.id) ?? { avg: 0, count: 0 };

    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      slug: r.slug,
      description: r.description,
      brand: r.brand,
      categoryId: r.category_id,
      categoryName: r.category_name,
      categorySlug: r.category_slug,
      regularPriceCents: r.regular_price_cents,
      salePriceCents: r.sale_price_cents,
      effectivePriceCents: effective,
      discountPercent,
      stockQuantity: r.stock_quantity,
      gender: r.gender,
      isFeatured: r.is_featured === 1,
      isTrending: r.is_trending === 1,
      isNewArrival: r.is_new_arrival === 1,
      isFlashSale: r.is_flash_sale === 1,
      popularityScore: r.popularity_score,
      createdAt: r.created_at,
      images: imgMap.get(r.id) ?? [],
      sizes: sizeMap.get(r.id) ?? [],
      colors: colorMap.get(r.id) ?? [],
      avgRating: stats.avg,
      reviewCount: stats.count,
    };
  });
}

export function getStoreSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM store_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const out: Record<string, string> = {};
  for (const row of rows) {
    out[row.key] = row.value;
  }
  return out;
}

export function getCartForUser(userId: number) {
  const rows = db
    .prepare(
      `SELECT ci.id, ci.product_id, ci.selected_size, ci.selected_color, ci.quantity,
              p.name, p.slug, p.brand, p.regular_price_cents, p.sale_price_cents, p.stock_quantity,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as image_url,
              ps.stock_quantity as size_stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_sizes ps ON ps.product_id = p.id AND ps.size_label = ci.selected_size
       WHERE ci.user_id = ?
       ORDER BY ci.created_at DESC`
    )
    .all(userId) as Array<{
    id: number;
    product_id: number;
    selected_size: string;
    selected_color: string;
    quantity: number;
    name: string;
    slug: string;
    brand: string;
    regular_price_cents: number;
    sale_price_cents: number | null;
    stock_quantity: number;
    image_url: string | null;
    size_stock: number | null;
  }>;

  const items = rows.map((r) => {
    const unitPriceCents =
      r.sale_price_cents !== null && r.sale_price_cents < r.regular_price_cents
        ? r.sale_price_cents
        : r.regular_price_cents;
    const availableSizes = db
      .prepare('SELECT id, size_label as sizeLabel, stock_quantity as stockQuantity FROM product_sizes WHERE product_id = ?')
      .all(r.product_id) as Array<{ id: number; sizeLabel: string; stockQuantity: number }>;
    const availableColors = db
      .prepare('SELECT id, color_name as colorName, hex_code as hexCode FROM product_colors WHERE product_id = ?')
      .all(r.product_id) as Array<{ id: number; colorName: string; hexCode: string }>;
    return {
      id: r.id,
      productId: r.product_id,
      name: r.name,
      slug: r.slug,
      brand: r.brand,
      selectedSize: r.selected_size,
      selectedColor: r.selected_color,
      quantity: r.quantity,
      unitPriceCents,
      regularPriceCents: r.regular_price_cents,
      lineTotalCents: unitPriceCents * r.quantity,
      imageUrl: r.image_url ?? '',
      availableStock: r.size_stock !== null ? Math.min(r.size_stock, r.stock_quantity) : r.stock_quantity,
      availableSizes,
      availableColors,
    };
  });

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const settings = getStoreSettings();
  const freeThreshold = Number(settings.free_shipping_threshold_cents || 15000);
  const stdShipping = Number(settings.standard_shipping_cents || 1200);
  const shippingCents = subtotalCents === 0 || subtotalCents >= freeThreshold ? 0 : stdShipping;

  return {
    items,
    subtotalCents,
    shippingCents,
    freeShippingThresholdCents: freeThreshold,
  };
}

export function getOrderWithDetails(orderRow: {
  id: number;
  order_number: string;
  user_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_country: string;
  shipping_city: string;
  shipping_address: string;
  shipping_postal_code: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  coupon_code: string | null;
  status: string;
  tracking_number: string;
  created_at: string;
  updated_at: string;
}) {
  const items = db
    .prepare(
      `SELECT id, product_id, product_name, product_image, selected_size, selected_color, unit_price_cents, quantity, line_total_cents
       FROM order_items WHERE order_id = ?`
    )
    .all(orderRow.id) as Array<{
    id: number;
    product_id: number | null;
    product_name: string;
    product_image: string;
    selected_size: string;
    selected_color: string;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
  }>;

  const payment = db
    .prepare('SELECT method, status, amount_cents, reference_code, created_at FROM payments WHERE order_id = ? LIMIT 1')
    .get(orderRow.id) as
    | {
        method: string;
        status: string;
        amount_cents: number;
        reference_code: string;
        created_at: string;
      }
    | undefined;

  return {
    id: orderRow.id,
    orderNumber: orderRow.order_number,
    userId: orderRow.user_id,
    customerName: orderRow.customer_name,
    customerEmail: orderRow.customer_email,
    customerPhone: orderRow.customer_phone,
    shippingCountry: orderRow.shipping_country,
    shippingCity: orderRow.shipping_city,
    shippingAddress: orderRow.shipping_address,
    shippingPostalCode: orderRow.shipping_postal_code,
    subtotalCents: orderRow.subtotal_cents,
    discountCents: orderRow.discount_cents,
    shippingCents: orderRow.shipping_cents,
    totalCents: orderRow.total_cents,
    couponCode: orderRow.coupon_code,
    status: orderRow.status,
    trackingNumber: orderRow.tracking_number,
    createdAt: orderRow.created_at,
    updatedAt: orderRow.updated_at,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      productImage: i.product_image,
      selectedSize: i.selected_size,
      selectedColor: i.selected_color,
      unitPriceCents: i.unit_price_cents,
      quantity: i.quantity,
      lineTotalCents: i.line_total_cents,
    })),
    payment: payment
      ? {
          method: payment.method,
          status: payment.status,
          amountCents: payment.amount_cents,
          referenceCode: payment.reference_code,
          createdAt: payment.created_at,
        }
      : null,
  };
}
