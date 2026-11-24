import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'Backend', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'warewear.db');
export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
`);

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      remember_me INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT 'WAREWEAR STUDIO',
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      regular_price_cents INTEGER NOT NULL CHECK (regular_price_cents >= 0),
      sale_price_cents INTEGER CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0),
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      gender TEXT NOT NULL DEFAULT 'unisex' CHECK (gender IN ('men', 'women', 'unisex')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_trending INTEGER NOT NULL DEFAULT 0,
      is_new_arrival INTEGER NOT NULL DEFAULT 0,
      is_flash_sale INTEGER NOT NULL DEFAULT 0,
      popularity_score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size_label TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      UNIQUE (product_id, size_label)
    );

    CREATE TABLE IF NOT EXISTS product_colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      color_name TEXT NOT NULL,
      hex_code TEXT NOT NULL DEFAULT '#111111',
      UNIQUE (product_id, color_name)
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      selected_size TEXT NOT NULL,
      selected_color TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, product_id, selected_size, selected_color)
    );

    CREATE TABLE IF NOT EXISTS wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT 'Home',
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      country TEXT NOT NULL,
      city TEXT NOT NULL,
      street_address TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_country TEXT NOT NULL,
      shipping_city TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      shipping_postal_code TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
      discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
      shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      coupon_code TEXT,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
      tracking_number TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      product_image TEXT NOT NULL DEFAULT '',
      selected_size TEXT NOT NULL,
      selected_color TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      method TEXT NOT NULL CHECK (method IN ('Cash on Delivery', 'Bank Transfer')),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Authorized', 'Paid', 'Refunded', 'Failed')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      reference_code TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
      min_order_cents INTEGER NOT NULL DEFAULT 0 CHECK (min_order_cents >= 0),
      expires_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      title TEXT NOT NULL DEFAULT '',
      comment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Approved' CHECK (status IN ('Approved', 'Pending', 'Hidden')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      subscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
    CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_wishlist_items_user ON wishlist_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  // Roles
  const roleInsert = db.prepare('INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)');
  roleInsert.run('customer', 'Standard WareWear shopper account');
  roleInsert.run('admin', 'Full WareWear store administrator');

  // Store Settings
  const defaultSettings: Array<[string, string]> = [
    ['store_name', 'WAREWEAR'],
    ['tagline', 'YOUR STYLE. YOUR IDENTITY.'],
    ['announcement_text', 'Complimentary express shipping on orders over $150 · Seasonal Archive Edit up to 30% off'],
    ['hero_heading', 'DEFINE YOUR EVERYDAY STYLE'],
    ['hero_subtitle', 'Discover fashion that speaks your personality.'],
    ['hero_image', '/src/assets/images/hero_warewear_editorial_1795446485318.jpg'],
    ['offer_banner_title', 'THE ARCHITECTURAL CAPSULE'],
    ['offer_banner_subtitle', 'Heavyweight organic cottons, Italian wool blends, and structured outerwear. Use code WARE15 for 15% off orders over $120.'],
    ['offer_banner_image', '/src/assets/images/prod_leather_sneakers_1795446485032.jpg'],
    ['support_email', 'concierge@warewear.com'],
    ['support_phone', '+1 (212) 555-0194'],
    ['free_shipping_threshold_cents', '15000'],
    ['standard_shipping_cents', '1200'],
  ];

  const settingInsert = db.prepare('INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of defaultSettings) {
    settingInsert.run(k, v);
  }

  const categoryCount = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
  if (categoryCount.c === 0) {
    const categories: Array<[string, string, string, string, number]> = [
      ["Men's Clothing", 'mens-clothing', 'Structured tailoring and architectural everyday menswear.', '/src/assets/images/prod_mens_blazer_1795446485870.jpg', 1],
      ["Women's Clothing", 'womens-clothing', 'Fluid silhouettes, draped coats, and elevated essentials.', '/src/assets/images/prod_womens_trench_1795446486205.jpg', 2],
      ['T-Shirts', 't-shirts', 'Heavyweight organic cotton jersey tees with refined collars.', '/src/assets/images/prod_minimal_tee_1795446485007.jpg', 3],
      ['Hoodies', 'hoodies', '500gsm brushed loopback fleece hoodies in boxy silhouettes.', '/src/assets/images/prod_boxy_hoodie_1795446485915.jpg', 4],
      ['Sweatshirts', 'sweatshirts', 'Structured crewnecks crafted from combed French terry.', '/src/assets/images/prod_boxy_hoodie_1795446485915.jpg', 5],
      ['Jeans', 'jeans', 'Raw Japanese selvedge and rinsed indigo denim.', '/src/assets/images/prod_selvedge_denim_1795446486075.jpg', 6],
      ['Trousers', 'trousers', 'Double-pleated wide-leg wool and tailored cotton trousers.', '/src/assets/images/prod_pleated_trousers_1795446486259.jpg', 7],
      ['Jackets', 'jackets', 'Weather-ready field jackets, trenches, and tailored outerwear.', '/src/assets/images/prod_technical_jacket_1795446485329.jpg', 8],
      ['Shoes', 'shoes', 'Minimalist Italian calfskin court sneakers and leather footwear.', '/src/assets/images/prod_leather_sneakers_1795446485032.jpg', 9],
      ['Accessories', 'accessories', 'Full-grain leather goods and architectural everyday carry.', '/src/assets/images/prod_leather_crossbody_1795446486007.jpg', 10],
    ];
    const insertCat = db.prepare(
      'INSERT INTO categories (name, slug, description, image_url, display_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (const cat of categories) {
      insertCat.run(...cat);
    }
  }

  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
  if (productCount.c === 0) {
    const getCatId = (slug: string): number => {
      const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as { id: number };
      return row.id;
    };

    interface SeedProduct {
      sku: string;
      name: string;
      slug: string;
      description: string;
      brand: string;
      categorySlug: string;
      regularPriceCents: number;
      salePriceCents: number | null;
      gender: 'men' | 'women' | 'unisex';
      isFeatured: number;
      isTrending: number;
      isNewArrival: number;
      isFlashSale: number;
      popularityScore: number;
      images: string[];
      sizes: Array<{ label: string; stock: number }>;
      colors: Array<{ name: string; hex: string }>;
      reviews: Array<{ name: string; rating: number; title: string; comment: string }>;
    }

    const seedProducts: SeedProduct[] = [
      {
        sku: 'WW-OUT-001',
        name: 'Monolith Wool Single-Breasted Suit Blazer',
        slug: 'monolith-wool-single-breasted-blazer',
        description: 'Cut from breathable 100% Virgin Italian wool with a structured shoulder, horn buttons, and full cupro lining. Designed for effortless architectural poise from studio to evening.',
        brand: 'WAREWEAR ATELIER',
        categorySlug: 'mens-clothing',
        regularPriceCents: 32000,
        salePriceCents: 26500,
        gender: 'men',
        isFeatured: 1,
        isTrending: 1,
        isNewArrival: 1,
        isFlashSale: 0,
        popularityScore: 98,
        images: [
          '/src/assets/images/prod_mens_blazer_1795446485870.jpg',
          '/src/assets/images/hero_warewear_editorial_1795446485318.jpg',
        ],
        sizes: [
          { label: 'S', stock: 8 },
          { label: 'M', stock: 14 },
          { label: 'L', stock: 11 },
          { label: 'XL', stock: 5 },
        ],
        colors: [
          { name: 'Obsidian Black', hex: '#111111' },
          { name: 'Slate Charcoal', hex: '#3A3A3C' },
        ],
        reviews: [
          { name: 'Daniel Vance', rating: 5, title: 'Immaculate drape', comment: 'The shoulder line and fabric weight rival heritage European tailoring houses.' },
          { name: 'Julian Mercer', rating: 5, title: 'True to size', comment: 'Clean silhouette that pairs just as well over a heavyweight tee as a crisp poplin shirt.' },
        ],
      },
      {
        sku: 'WW-WMN-002',
        name: 'Atelier Gabardine Belted Trench Coat',
        slug: 'atelier-gabardine-belted-trench-coat',
        description: 'Double-breasted longline trench crafted from water-repellent combed cotton gabardine. Features storm flaps, tortoiseshell-finish hardware, and a removable waist belt.',
        brand: 'WAREWEAR ATELIER',
        categorySlug: 'womens-clothing',
        regularPriceCents: 29500,
        salePriceCents: null,
        gender: 'women',
        isFeatured: 1,
        isTrending: 1,
        isNewArrival: 1,
        isFlashSale: 0,
        popularityScore: 96,
        images: [
          '/src/assets/images/prod_womens_trench_1795446486205.jpg',
          '/src/assets/images/prod_pleated_trousers_1795446486259.jpg',
        ],
        sizes: [
          { label: 'XS', stock: 6 },
          { label: 'S', stock: 12 },
          { label: 'M', stock: 15 },
          { label: 'L', stock: 7 },
        ],
        colors: [
          { name: 'Warm Travertine', hex: '#D6C3A5' },
          { name: 'Obsidian Black', hex: '#111111' },
        ],
        reviews: [
          { name: 'Elena Rostova', rating: 5, title: 'Timeless wardrobe anchor', comment: 'The warm sand tone is remarkably versatile and the cotton twill feels substantial.' },
        ],
      },
      {
        sku: 'WW-HD-003',
        name: 'Heavyweight 500gsm Boxy Hoodie',
        slug: 'heavyweight-500gsm-boxy-hoodie',
        description: 'Engineered from 500gsm organic ring-spun cotton fleece with a double-layered structured hood, dropped shoulders, and zero-twist ribbed cuffs.',
        brand: 'WAREWEAR CORE',
        categorySlug: 'hoodies',
        regularPriceCents: 13500,
        salePriceCents: 10800,
        gender: 'unisex',
        isFeatured: 1,
        isTrending: 1,
        isNewArrival: 1,
        isFlashSale: 1,
        popularityScore: 120,
        images: [
          '/src/assets/images/prod_boxy_hoodie_1795446485915.jpg',
          '/src/assets/images/hero_warewear_editorial_1795446485318.jpg',
        ],
        sizes: [
          { label: 'XS', stock: 9 },
          { label: 'S', stock: 18 },
          { label: 'M', stock: 22 },
          { label: 'L', stock: 16 },
          { label: 'XL', stock: 10 },
        ],
        colors: [
          { name: 'Matte Charcoal', hex: '#1E1E1E' },
          { name: 'Warm Sand', hex: '#D6C3A5' },
          { name: 'Chalk White', hex: '#F3F2EE' },
        ],
        reviews: [
          { name: 'Marcus Chen', rating: 5, title: 'Best heavyweight fleece', comment: 'Hood sits upright cleanly and the cropped boxy hem hits right at the belt.' },
          { name: 'Sora Takahashi', rating: 4, title: 'Super dense cotton', comment: 'Warm, structured, and holds its shape after multiple washes.' },
        ],
      },
      {
        sku: 'WW-TEE-004',
        name: 'Architectural 280gsm Crewneck T-Shirt',
        slug: 'architectural-280gsm-crewneck-tee',
        description: 'Knit from long-staple organic cotton jersey with a high-density 1x1 mock rib collar that never loses tension. Relaxed boxy fit.',
        brand: 'WAREWEAR CORE',
        categorySlug: 't-shirts',
        regularPriceCents: 6500,
        salePriceCents: 5200,
        gender: 'unisex',
        isFeatured: 1,
        isTrending: 1,
        isNewArrival: 1,
        isFlashSale: 1,
        popularityScore: 135,
        images: [
          '/src/assets/images/prod_minimal_tee_1795446485007.jpg',
        ],
        sizes: [
          { label: 'XS', stock: 15 },
          { label: 'S', stock: 28 },
          { label: 'M', stock: 34 },
          { label: 'L', stock: 25 },
          { label: 'XL', stock: 12 },
        ],
        colors: [
          { name: 'Bone Cream', hex: '#F4F1EA' },
          { name: 'Stone Grey', hex: '#9A9B9E' },
          { name: 'Obsidian Black', hex: '#111111' },
        ],
        reviews: [
          { name: 'Claire Beaumont', rating: 5, title: 'Opaque and crisp', comment: 'Finally a white tee that is completely opaque and keeps a sharp collar.' },
        ],
      },
      {
        sku: 'WW-DNM-005',
        name: '14oz Japanese Selvedge Straight Jeans',
        slug: '14oz-japanese-selvedge-straight-jeans',
        description: 'Woven on vintage shuttle looms in Okayama from 14oz unwashed indigo selvedge denim. Classic mid-rise straight leg with matte black tack buttons.',
        brand: 'WAREWEAR DENIM',
        categorySlug: 'jeans',
        regularPriceCents: 18500,
        salePriceCents: 14900,
        gender: 'unisex',
        isFeatured: 1,
        isTrending: 1,
        isNewArrival: 0,
        isFlashSale: 1,
        popularityScore: 110,
        images: [
          '/src/assets/images/prod_selvedge_denim_1795446486075.jpg',
        ],
        sizes: [
          { label: '28', stock: 6 },
          { label: '30', stock: 12 },
          { label: '32', stock: 16 },
          { label: '34', stock: 11 },
          { label: '36', stock: 4 },
        ],
        colors: [
          { name: 'Raw Indigo', hex: '#1D293D' },
          { name: 'Washed Ink', hex: '#2A2D34' },
        ],
        reviews: [
          { name: 'Theo Lindqvist', rating: 5, title: 'Authentic selvedge character', comment: 'Stiff out of the box as raw denim should be, breaks in cleanly after a week.' },
        ],
      },
      {
        sku: 'WW-JKT-006',
        name: 'Field Cropped Technical Wool Jacket',
        slug: 'field-cropped-technical-wool-jacket',
        description: 'Boxy cropped silhouette cut from bonded merino-technical twill. Features concealed snap storm placket, dual bellows pockets, and articulated sleeves.',
        brand: 'WAREWEAR STUDIO',
        categorySlug: 'jackets',
        regularPriceCents: 26000,
        salePriceCents: 21500,
        gender: 'men',
        isFeatured: 1,
        isTrending: 1,
        isNewArrival: 1,
        isFlashSale: 0,
        popularityScore: 105,
        images: [
          '/src/assets/images/prod_technical_jacket_1795446485329.jpg',
        ],
        sizes: [
          { label: 'S', stock: 5 },
          { label: 'M', stock: 10 },
          { label: 'L', stock: 8 },
          { label: 'XL', stock: 3 },
        ],
        colors: [
          { name: 'Obsidian Black', hex: '#111111' },
          { name: 'Olive Slate', hex: '#3D423A' },
        ],
        reviews: [
          { name: 'Liam OConnor', rating: 5, title: 'Sharp minimalist outerwear', comment: 'Blocks wind effortlessly and the stand collar frames cleanly.' },
        ],
      },
      {
        sku: 'WW-SHO-007',
        name: 'Calfskin Low-Top Court Sneakers',
        slug: 'calfskin-low-top-court-sneakers',
        description: 'Hand-lasted in Portugal from full-grain Italian calfskin with suede toe panelling, leather-lined footbed, and Margom-grade natural gum cupsole.',
        brand: 'WAREWEAR FOOTWEAR',
        categorySlug: 'shoes',
        regularPriceCents: 22000,
        salePriceCents: null,
        gender: 'unisex',
        isFeatured: 1,
        isTrending: 1,
        isNewArrival: 1,
        isFlashSale: 0,
        popularityScore: 99,
        images: [
          '/src/assets/images/prod_leather_sneakers_1795446485032.jpg',
        ],
        sizes: [
          { label: '39', stock: 5 },
          { label: '40', stock: 9 },
          { label: '41', stock: 11 },
          { label: '42', stock: 12 },
          { label: '43', stock: 7 },
          { label: '44', stock: 4 },
        ],
        colors: [
          { name: 'Chalk / Sand', hex: '#EAE5DA' },
          { name: 'Triple Black', hex: '#141414' },
        ],
        reviews: [
          { name: 'Noah Bennett', rating: 5, title: 'Zero break-in time', comment: 'Supple leather lining and clean proportions with wide trousers.' },
        ],
      },
      {
        sku: 'WW-TRS-008',
        name: 'Double-Pleated Wide Wool Trousers',
        slug: 'double-pleated-wide-wool-trousers',
        description: 'Fluid wide-leg trousers tailored from brushed worsted wool blend with deep forward pleats, horn waist tab, and blind-stitched cuffs.',
        brand: 'WAREWEAR ATELIER',
        categorySlug: 'trousers',
        regularPriceCents: 17500,
        salePriceCents: 14500,
        gender: 'women',
        isFeatured: 1,
        isTrending: 0,
        isNewArrival: 1,
        isFlashSale: 0,
        popularityScore: 88,
        images: [
          '/src/assets/images/prod_pleated_trousers_1795446486259.jpg',
        ],
        sizes: [
          { label: 'XS', stock: 7 },
          { label: 'S', stock: 13 },
          { label: 'M', stock: 11 },
          { label: 'L', stock: 6 },
        ],
        colors: [
          { name: 'Warm Sand', hex: '#C8B294' },
          { name: 'Obsidian Black', hex: '#111111' },
        ],
        reviews: [
          { name: 'Aria Sterling', rating: 5, title: 'Architectural drape', comment: 'Sits cleanly at the high waist and moves fluidly.' },
        ],
      },
      {
        sku: 'WW-ACC-009',
        name: 'Structured Full-Grain Leather Crossbody',
        slug: 'structured-full-grain-leather-crossbody',
        description: 'Architectural everyday crossbody constructed from vegetable-tanned pebble calfskin with brushed steel push-lock clasp and adjustable bridle strap.',
        brand: 'WAREWEAR OBJECTS',
        categorySlug: 'accessories',
        regularPriceCents: 24500,
        salePriceCents: 19800,
        gender: 'unisex',
        isFeatured: 1,
        isTrending: 1,
        isNewArrival: 0,
        isFlashSale: 1,
        popularityScore: 94,
        images: [
          '/src/assets/images/prod_leather_crossbody_1795446486007.jpg',
        ],
        sizes: [
          { label: 'ONE SIZE', stock: 14 },
        ],
        colors: [
          { name: 'Obsidian Black', hex: '#111111' },
          { name: 'Espresso', hex: '#3B2B23' },
        ],
        reviews: [
          { name: 'Maya Lin', rating: 5, title: 'Elevated hardware', comment: 'Brushed clasp feels substantial and fits daily essentials effortlessly.' },
        ],
      },
      {
        sku: 'WW-SWT-010',
        name: 'Brushed Loopback Studio Sweatshirt',
        slug: 'brushed-loopback-studio-sweatshirt',
        description: 'Minimalist raglan crewneck sweatshirt in 440gsm organic French terry with tonal cover-stitching and relaxed architectural sleeve volume.',
        brand: 'WAREWEAR CORE',
        categorySlug: 'sweatshirts',
        regularPriceCents: 11500,
        salePriceCents: null,
        gender: 'unisex',
        isFeatured: 0,
        isTrending: 1,
        isNewArrival: 1,
        isFlashSale: 0,
        popularityScore: 84,
        images: [
          '/src/assets/images/prod_boxy_hoodie_1795446485915.jpg',
          '/src/assets/images/prod_minimal_tee_1795446485007.jpg',
        ],
        sizes: [
          { label: 'S', stock: 11 },
          { label: 'M', stock: 16 },
          { label: 'L', stock: 14 },
          { label: 'XL', stock: 6 },
        ],
        colors: [
          { name: 'Stone Grey', hex: '#8A8B8E' },
          { name: 'Obsidian Black', hex: '#111111' },
        ],
        reviews: [
          { name: 'Devon Brooks', rating: 4, title: 'Clean daily crewneck', comment: 'Soft interior loop with crisp outer structure.' },
        ],
      },
      {
        sku: 'WW-TRS-011',
        name: 'Tailored Charcoal Pleated Suit Trousers',
        slug: 'tailored-charcoal-pleated-suit-trousers',
        description: 'Full-length tailored trousers woven in 100% Virgin wool with single front pleat and side waist adjusters for a beltless minimalist profile.',
        brand: 'WAREWEAR ATELIER',
        categorySlug: 'trousers',
        regularPriceCents: 19000,
        salePriceCents: 15500,
        gender: 'men',
        isFeatured: 0,
        isTrending: 1,
        isNewArrival: 0,
        isFlashSale: 0,
        popularityScore: 81,
        images: [
          '/src/assets/images/prod_mens_blazer_1795446485870.jpg',
          '/src/assets/images/prod_pleated_trousers_1795446486259.jpg',
        ],
        sizes: [
          { label: '30', stock: 9 },
          { label: '32', stock: 12 },
          { label: '34', stock: 8 },
          { label: '36', stock: 4 },
        ],
        colors: [
          { name: 'Obsidian Black', hex: '#111111' },
          { name: 'Warm Sand', hex: '#D6C3A5' },
        ],
        reviews: [],
      },
      {
        sku: 'WW-WMN-012',
        name: 'Sculpted Merino Mock-Neck Knit',
        slug: 'sculpted-merino-mock-neck-knit',
        description: 'Fine-gauge extra-fine merino wool sweater featuring seamless tubular ribbing and an elongated sleeve cuff for effortless layering.',
        brand: 'WAREWEAR ATELIER',
        categorySlug: 'womens-clothing',
        regularPriceCents: 14500,
        salePriceCents: 11800,
        gender: 'women',
        isFeatured: 0,
        isTrending: 0,
        isNewArrival: 1,
        isFlashSale: 1,
        popularityScore: 79,
        images: [
          '/src/assets/images/prod_minimal_tee_1795446485007.jpg',
          '/src/assets/images/prod_womens_trench_1795446486205.jpg',
        ],
        sizes: [
          { label: 'XS', stock: 8 },
          { label: 'S', stock: 12 },
          { label: 'M', stock: 10 },
          { label: 'L', stock: 5 },
        ],
        colors: [
          { name: 'Cream Ivory', hex: '#F5F2EB' },
          { name: 'Obsidian Black', hex: '#111111' },
        ],
        reviews: [],
      },
    ];

    const insertProd = db.prepare(`
      INSERT INTO products (
        sku, name, slug, description, brand, category_id,
        regular_price_cents, sale_price_cents, stock_quantity, gender,
        is_featured, is_trending, is_new_arrival, is_flash_sale, popularity_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertImg = db.prepare(
      'INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    const insertSize = db.prepare(
      'INSERT INTO product_sizes (product_id, size_label, stock_quantity) VALUES (?, ?, ?)'
    );
    const insertColor = db.prepare(
      'INSERT INTO product_colors (product_id, color_name, hex_code) VALUES (?, ?, ?)'
    );
    const insertReview = db.prepare(
      'INSERT INTO reviews (product_id, reviewer_name, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (const p of seedProducts) {
      const totalStock = p.sizes.reduce((acc, s) => acc + s.stock, 0);
      const catId = getCatId(p.categorySlug);
      const res = insertProd.run(
        p.sku,
        p.name,
        p.slug,
        p.description,
        p.brand,
        catId,
        p.regularPriceCents,
        p.salePriceCents,
        totalStock,
        p.gender,
        p.isFeatured,
        p.isTrending,
        p.isNewArrival,
        p.isFlashSale,
        p.popularityScore
      );
      const productId = Number(res.lastInsertRowid);
      p.images.forEach((url, idx) => {
        insertImg.run(productId, url, `${p.name} view ${idx + 1}`, idx === 0 ? 1 : 0, idx);
      });
      for (const s of p.sizes) {
        insertSize.run(productId, s.label, s.stock);
      }
      for (const c of p.colors) {
        insertColor.run(productId, c.name, c.hex);
      }
      for (const r of p.reviews) {
        insertReview.run(productId, r.name, r.rating, r.title, r.comment, 'Approved');
      }
    }
  }

  // Seed Coupons
  const couponInsert = db.prepare(
    'INSERT OR IGNORE INTO coupons (code, discount_percent, min_order_cents, expires_at, is_active) VALUES (?, ?, ?, ?, ?)'
  );
  couponInsert.run('WARE15', 15, 12000, '2027-12-31T23:59:59Z', 1);
  couponInsert.run('WELCOME10', 10, 0, '2027-12-31T23:59:59Z', 1);
  couponInsert.run('ARCHIVE25', 25, 25000, '2027-06-30T23:59:59Z', 1);
}
