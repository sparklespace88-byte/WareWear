import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Response } from 'express';
import { db } from './db.ts';
import {
  getCartForUser,
  getOrderWithDetails,
  getStoreSettings,
  hydrateProducts,
} from './queries.ts';
import {
  type AuthRequest,
  attachAuth,
  clearSessionCookie,
  generateToken,
  hashPassword,
  hashToken,
  isValidEmail,
  isValidPhone,
  requireAdmin,
  requireAuth,
  sanitizeImageUrl,
  setSessionCookie,
  signReceiptToken,
  verifyCsrfIfCookieAuth,
  verifyPassword,
  verifyReceiptToken,
} from './security.ts';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createSessionForUser(
  req: AuthRequest,
  res: Response,
  userId: number,
  rememberMe: boolean
): string {
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const ttlMs = rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 24;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  db.prepare(
    'INSERT INTO sessions (user_id, token_hash, remember_me, expires_at) VALUES (?, ?, ?, ?)'
  ).run(userId, tokenHash, rememberMe ? 1 : 0, expiresAt);
  setSessionCookie(req, res, rawToken, rememberMe);
  return rawToken;
}

function constantTimeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function registerApiRoutes(app: Express): void {
  app.use('/api', verifyCsrfIfCookieAuth);
  app.use('/api', attachAuth);

  // ==================== PUBLIC STOREFRONT ====================

  app.get('/api/storefront', (_req, res) => {
    const settings = getStoreSettings();
    const categories = db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description, c.image_url, c.display_order,
                COUNT(p.id) as product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
         GROUP BY c.id
         ORDER BY c.display_order ASC, c.id ASC`
      )
      .all() as Array<{
      id: number;
      name: string;
      slug: string;
      description: string;
      image_url: string;
      display_order: number;
      product_count: number;
    }>;

    res.json({
      settings,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.image_url,
        displayOrder: c.display_order,
        productCount: c.product_count,
      })),
    });
  });

  app.get('/api/products/suggestions', (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q || q.length < 1) {
      res.json({ products: [], categories: [], brands: [] });
      return;
    }
    const like = `%${q}%`;
    const products = db
      .prepare(
        `SELECT p.id, p.name, p.slug, p.brand, p.regular_price_cents, p.sale_price_cents,
                c.name as category_name,
                (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as image_url
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.name LIKE ? OR p.brand LIKE ? OR c.name LIKE ?
         ORDER BY p.popularity_score DESC
         LIMIT 6`
      )
      .all(like, like, like) as Array<{
      id: number;
      name: string;
      slug: string;
      brand: string;
      regular_price_cents: number;
      sale_price_cents: number | null;
      category_name: string;
      image_url: string | null;
    }>;

    const categories = db
      .prepare('SELECT id, name, slug FROM categories WHERE name LIKE ? LIMIT 4')
      .all(like) as Array<{ id: number; name: string; slug: string }>;

    const brands = db
      .prepare('SELECT DISTINCT brand FROM products WHERE brand LIKE ? LIMIT 4')
      .all(like) as Array<{ brand: string }>;

    res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        categoryName: p.category_name,
        effectivePriceCents:
          p.sale_price_cents !== null && p.sale_price_cents < p.regular_price_cents
            ? p.sale_price_cents
            : p.regular_price_cents,
        imageUrl: p.image_url ?? '',
      })),
      categories,
      brands: brands.map((b) => b.brand),
    });
  });

  app.get('/api/products', (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const category = String(req.query.category ?? '').trim();
    const gender = String(req.query.gender ?? '').trim().toLowerCase();
    const size = String(req.query.size ?? '').trim();
    const color = String(req.query.color ?? '').trim();
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const sale = req.query.sale === 'true';
    const newArrival = req.query.newArrival === 'true';
    const featured = req.query.featured === 'true';
    const trending = req.query.trending === 'true';
    const flashSale = req.query.flashSale === 'true';
    const sort = String(req.query.sort ?? 'newest');
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (q) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ? OR c.name LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (category && category !== 'all') {
      conditions.push('(c.slug = ? OR LOWER(c.name) = LOWER(?))');
      params.push(category, category);
    }
    if (gender && ['men', 'women', 'unisex'].includes(gender)) {
      if (gender === 'unisex') {
        conditions.push("p.gender = 'unisex'");
      } else {
        conditions.push('(p.gender = ? OR p.gender = ?)');
        params.push(gender, 'unisex');
      }
    }
    if (sale) {
      conditions.push('p.sale_price_cents IS NOT NULL AND p.sale_price_cents < p.regular_price_cents');
    }
    if (newArrival) {
      conditions.push('p.is_new_arrival = 1');
    }
    if (featured) {
      conditions.push('p.is_featured = 1');
    }
    if (trending) {
      conditions.push('p.is_trending = 1');
    }
    if (flashSale) {
      conditions.push('p.is_flash_sale = 1');
    }
    if (minPrice !== null && Number.isFinite(minPrice) && minPrice >= 0) {
      conditions.push('COALESCE(p.sale_price_cents, p.regular_price_cents) >= ?');
      params.push(Math.round(minPrice * 100));
    }
    if (maxPrice !== null && Number.isFinite(maxPrice) && maxPrice > 0) {
      conditions.push('COALESCE(p.sale_price_cents, p.regular_price_cents) <= ?');
      params.push(Math.round(maxPrice * 100));
    }
    if (size) {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_sizes ps WHERE ps.product_id = p.id AND UPPER(ps.size_label) = UPPER(?) AND ps.stock_quantity > 0)'
      );
      params.push(size);
    }
    if (color) {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_colors pc WHERE pc.product_id = p.id AND LOWER(pc.color_name) LIKE LOWER(?))'
      );
      params.push(`%${color}%`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderSql = 'ORDER BY p.created_at DESC, p.id DESC';
    if (sort === 'price_asc') {
      orderSql = 'ORDER BY COALESCE(p.sale_price_cents, p.regular_price_cents) ASC';
    } else if (sort === 'price_desc') {
      orderSql = 'ORDER BY COALESCE(p.sale_price_cents, p.regular_price_cents) DESC';
    } else if (sort === 'popularity') {
      orderSql = 'ORDER BY p.popularity_score DESC, p.id DESC';
    } else if (sort === 'rating') {
      orderSql =
        "ORDER BY COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id AND r.status = 'Approved'), 0) DESC, p.popularity_score DESC";
    }

    const totalRow = db
      .prepare(
        `SELECT COUNT(*) as total
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ${whereSql}`
      )
      .get(...params) as { total: number };

    const rows = db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ${whereSql}
         ${orderSql}
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as any[];

    const availableSizes = db
      .prepare('SELECT DISTINCT size_label FROM product_sizes WHERE stock_quantity > 0 ORDER BY size_label ASC')
      .all() as Array<{ size_label: string }>;

    const availableColors = db
      .prepare('SELECT DISTINCT color_name, hex_code FROM product_colors ORDER BY color_name ASC')
      .all() as Array<{ color_name: string; hex_code: string }>;

    res.json({
      products: hydrateProducts(rows),
      total: totalRow.total,
      facets: {
        sizes: availableSizes.map((s) => s.size_label),
        colors: availableColors.map((c) => ({ name: c.color_name, hex: c.hex_code })),
      },
    });
  });

  app.get('/api/products/:slug', (req, res) => {
    const slug = String(req.params.slug ?? '').trim();
    const row = db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.slug = ? OR CAST(p.id AS TEXT) = ?
         LIMIT 1`
      )
      .get(slug, slug) as any;

    if (!row) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const [product] = hydrateProducts([row]);
    const reviews = db
      .prepare(
        `SELECT id, reviewer_name, rating, title, comment, created_at
         FROM reviews
         WHERE product_id = ? AND status = 'Approved'
         ORDER BY created_at DESC`
      )
      .all(product.id) as Array<{
      id: number;
      reviewer_name: string;
      rating: number;
      title: string;
      comment: string;
      created_at: string;
    }>;

    const relatedRows = db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.id != ? AND (p.category_id = ? OR p.gender = ?)
         ORDER BY CASE WHEN p.category_id = ? THEN 0 ELSE 1 END, p.popularity_score DESC
         LIMIT 4`
      )
      .all(product.id, product.categoryId, product.gender, product.categoryId) as any[];

    res.json({
      product,
      reviews: reviews.map((r) => ({
        id: r.id,
        reviewerName: r.reviewer_name,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        createdAt: r.created_at,
      })),
      relatedProducts: hydrateProducts(relatedRows),
    });
  });

  app.post('/api/newsletter', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)').run(email);
    res.json({ ok: true, message: 'Welcome to the WAREWEAR Private Edit.' });
  });

  app.post('/api/coupons/validate', (req, res) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const subtotalCents = Math.max(0, Number(req.body?.subtotalCents ?? 0));
    if (!code) {
      res.status(400).json({ error: 'Enter a coupon code.' });
      return;
    }
    const coupon = db
      .prepare(
        `SELECT code, discount_percent, min_order_cents, expires_at, is_active
         FROM coupons WHERE UPPER(code) = ? LIMIT 1`
      )
      .get(code) as
      | {
          code: string;
          discount_percent: number;
          min_order_cents: number;
          expires_at: string;
          is_active: number;
        }
      | undefined;

    if (!coupon || coupon.is_active !== 1) {
      res.status(404).json({ error: 'Invalid or inactive coupon code.' });
      return;
    }
    if (new Date(coupon.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'This coupon has expired.' });
      return;
    }
    if (subtotalCents < coupon.min_order_cents) {
      res.status(400).json({
        error: `Minimum order of $${(coupon.min_order_cents / 100).toFixed(2)} required for ${coupon.code}.`,
      });
      return;
    }
    const discountCents = Math.round((subtotalCents * coupon.discount_percent) / 100);
    res.json({
      code: coupon.code,
      discountPercent: coupon.discount_percent,
      discountCents,
    });
  });

  // ==================== AUTHENTICATION ====================

  app.get('/api/auth/me', (req: AuthRequest, res) => {
    const adminCount = db
      .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'")
      .get() as { c: number };
    res.json({
      user: req.user ?? null,
      hasAdmin: adminCount.c > 0,
    });
  });

  app.post('/api/auth/register', (req: AuthRequest, res) => {
    const fullName = String(req.body?.fullName ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phone = String(req.body?.phone ?? '').trim();
    const password = String(req.body?.password ?? '');
    const confirmPassword = String(req.body?.confirmPassword ?? '');

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: 'Please provide a valid phone number.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = hashPassword(password);
    let userId = 0;
    try {
      db.exec('BEGIN IMMEDIATE');
      const result = db
        .prepare(
          'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)'
        )
        .run(fullName, email, phone, passwordHash, 'customer');
      userId = Number(result.lastInsertRowid);
      const roleRow = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get() as
        | { id: number }
        | undefined;
      if (roleRow) {
        db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(
          userId,
          roleRow.id
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const token = createSessionForUser(req, res, userId, true);
    res.status(201).json({
      token,
      user: {
        id: userId,
        fullName,
        email,
        phone,
        role: 'customer',
      },
    });
  });

  app.post('/api/auth/login', (req: AuthRequest, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const rememberMe = Boolean(req.body?.rememberMe);
    const adminOnly = Boolean(req.body?.adminOnly);

    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = db
      .prepare(
        'SELECT id, full_name, email, phone, password_hash, role, is_active FROM users WHERE email = ?'
      )
      .get(email) as
      | {
          id: number;
          full_name: string;
          email: string;
          phone: string;
          password_hash: string;
          role: 'customer' | 'admin';
          is_active: number;
        }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (user.is_active !== 1) {
      res.status(403).json({ error: 'This account has been suspended.' });
      return;
    }
    if (adminOnly && user.role !== 'admin') {
      res.status(403).json({
        error: 'Access denied. Only administrator accounts can log into the backend.',
      });
      return;
    }

    const token = createSessionForUser(req, res, user.id, rememberMe);
    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  });

  app.post('/api/auth/logout', (req: AuthRequest, res) => {
    if (req.sessionToken) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(req.sessionToken));
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/claim-admin', (req: AuthRequest, res) => {
    const fullName = String(req.body?.fullName ?? 'Store Administrator').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phone = String(req.body?.phone ?? '0000000000').trim();
    const password = String(req.body?.password ?? '');
    const adminPasscode = String(req.body?.adminPasscode ?? '');

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Valid email is required.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const envPasscode = (process.env.ADMIN_PASSCODE ?? '').trim();
    let userId = 0;

    try {
      db.exec('BEGIN IMMEDIATE');
      const adminCount = db
        .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'")
        .get() as { c: number };

      if (adminCount.c > 0) {
        if (!envPasscode || !constantTimeEquals(adminPasscode, envPasscode)) {
          db.exec('ROLLBACK');
          res.status(403).json({
            error: 'An administrator account already exists. Sign in with your admin credentials.',
          });
          return;
        }
      } else if (envPasscode && !constantTimeEquals(adminPasscode, envPasscode)) {
        db.exec('ROLLBACK');
        res.status(403).json({ error: 'Invalid admin setup passcode.' });
        return;
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
        | { id: number }
        | undefined;
      const passwordHash = hashPassword(password);

      if (existing) {
        userId = existing.id;
        db.prepare(
          "UPDATE users SET full_name = ?, password_hash = ?, role = 'admin', is_active = 1, updated_at = datetime('now') WHERE id = ?"
        ).run(fullName, passwordHash, userId);
      } else {
        const result = db
          .prepare(
            "INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')"
          )
          .run(fullName, email, phone, passwordHash);
        userId = Number(result.lastInsertRowid);
      }

      const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get() as
        | { id: number }
        | undefined;
      if (adminRole) {
        db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(
          userId,
          adminRole.id
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const token = createSessionForUser(req, res, userId, true);
    res.status(201).json({
      token,
      user: {
        id: userId,
        fullName,
        email,
        phone,
        role: 'admin',
      },
    });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phoneLast4 = String(req.body?.phoneLast4 ?? '').replace(/[^0-9]/g, '');

    if (!isValidEmail(email) || phoneLast4.length !== 4) {
      res.status(400).json({
        error: 'Enter your registered email and the last 4 digits of your account phone number.',
      });
      return;
    }

    const user = db
      .prepare('SELECT id, phone FROM users WHERE email = ?')
      .get(email) as { id: number; phone: string } | undefined;

    if (!user) {
      res.status(404).json({ error: 'No matching account found for those details.' });
      return;
    }

    const cleanPhone = user.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone.endsWith(phoneLast4)) {
      res.status(400).json({ error: 'Verification details do not match our records.' });
      return;
    }

    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const tokenHash = hashToken(`${email}:${resetCode}`);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString();

    db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
      user.id,
      tokenHash,
      expiresAt
    );

    res.json({
      ok: true,
      message: 'Verification successful. Enter the 6-character code to set a new password.',
      verificationCodePreview: resetCode,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const resetCode = String(req.body?.code ?? '').trim().toUpperCase();
    const newPassword = String(req.body?.newPassword ?? '');

    if (!isValidEmail(email) || !resetCode || newPassword.length < 8) {
      res.status(400).json({ error: 'Valid email, reset code, and 8+ character password required.' });
      return;
    }

    const tokenHash = hashToken(`${email}:${resetCode}`);
    const resetRow = db
      .prepare(
        `SELECT pr.id, pr.user_id
         FROM password_resets pr
         JOIN users u ON u.id = pr.user_id
         WHERE pr.token_hash = ? AND u.email = ? AND pr.used_at IS NULL AND pr.expires_at > ?
         LIMIT 1`
      )
      .get(tokenHash, email, new Date().toISOString()) as
      | { id: number; user_id: number }
      | undefined;

    if (!resetRow) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }

    const newHash = hashPassword(newPassword);
    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
        newHash,
        resetRow.user_id
      );
      db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").run(resetRow.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(resetRow.user_id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    res.json({ ok: true, message: 'Password updated successfully. Please sign in.' });
  });

  // ==================== CART & WISHLIST ====================

  app.get('/api/cart', requireAuth, (req: AuthRequest, res) => {
    res.json(getCartForUser(req.user!.id));
  });

  app.post('/api/cart', requireAuth, (req: AuthRequest, res) => {
    const productId = Number(req.body?.productId);
    const selectedSize = String(req.body?.selectedSize ?? '').trim();
    const selectedColor = String(req.body?.selectedColor ?? '').trim();
    const quantity = Math.max(1, Math.min(20, Number(req.body?.quantity ?? 1)));

    const product = db.prepare('SELECT id, stock_quantity FROM products WHERE id = ?').get(productId) as
      | { id: number; stock_quantity: number }
      | undefined;
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const sizeRow = db
      .prepare('SELECT stock_quantity FROM product_sizes WHERE product_id = ? AND size_label = ?')
      .get(productId, selectedSize) as { stock_quantity: number } | undefined;

    if (!sizeRow || sizeRow.stock_quantity < 1 || product.stock_quantity < 1) {
      res.status(400).json({ error: 'Selected size is out of stock.' });
      return;
    }

    const existing = db
      .prepare(
        'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND selected_size = ? AND selected_color = ?'
      )
      .get(req.user!.id, productId, selectedSize, selectedColor) as
      | { id: number; quantity: number }
      | undefined;

    const nextQty = Math.min(sizeRow.stock_quantity, (existing?.quantity ?? 0) + quantity);
    if (existing) {
      db.prepare("UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(
        nextQty,
        existing.id
      );
    } else {
      db.prepare(
        'INSERT INTO cart_items (user_id, product_id, selected_size, selected_color, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user!.id, productId, selectedSize, selectedColor, nextQty);
    }

    res.json(getCartForUser(req.user!.id));
  });

  app.put('/api/cart/:id', requireAuth, (req: AuthRequest, res) => {
    const cartItemId = Number(req.params.id);
    const existing = db
      .prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?')
      .get(cartItemId, req.user!.id) as
      | {
          id: number;
          product_id: number;
          selected_size: string;
          selected_color: string;
          quantity: number;
        }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Cart item not found.' });
      return;
    }

    const nextSize = req.body?.selectedSize ? String(req.body.selectedSize) : existing.selected_size;
    const nextColor = req.body?.selectedColor ? String(req.body.selectedColor) : existing.selected_color;
    const nextQuantity = req.body?.quantity !== undefined ? Number(req.body.quantity) : existing.quantity;

    if (nextQuantity <= 0) {
      db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(cartItemId, req.user!.id);
      res.json(getCartForUser(req.user!.id));
      return;
    }

    const sizeRow = db
      .prepare('SELECT stock_quantity FROM product_sizes WHERE product_id = ? AND size_label = ?')
      .get(existing.product_id, nextSize) as { stock_quantity: number } | undefined;

    if (!sizeRow || sizeRow.stock_quantity < 1) {
      res.status(400).json({ error: 'Selected size is out of stock.' });
      return;
    }

    const clampedQty = Math.min(sizeRow.stock_quantity, Math.max(1, nextQuantity));

    if (nextSize !== existing.selected_size || nextColor !== existing.selected_color) {
      const collision = db
        .prepare(
          'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND selected_size = ? AND selected_color = ? AND id != ?'
        )
        .get(req.user!.id, existing.product_id, nextSize, nextColor, cartItemId) as
        | { id: number; quantity: number }
        | undefined;
      if (collision) {
        const mergedQty = Math.min(sizeRow.stock_quantity, collision.quantity + clampedQty);
        db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(mergedQty, collision.id);
        db.prepare('DELETE FROM cart_items WHERE id = ?').run(cartItemId);
        res.json(getCartForUser(req.user!.id));
        return;
      }
    }

    db.prepare(
      "UPDATE cart_items SET selected_size = ?, selected_color = ?, quantity = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).run(nextSize, nextColor, clampedQty, cartItemId, req.user!.id);

    res.json(getCartForUser(req.user!.id));
  });

  app.delete('/api/cart/:id', requireAuth, (req: AuthRequest, res) => {
    const cartItemId = Number(req.params.id);
    db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(cartItemId, req.user!.id);
    res.json(getCartForUser(req.user!.id));
  });

  app.post('/api/cart/merge', requireAuth, (req: AuthRequest, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    for (const item of items) {
      const productId = Number(item?.productId);
      const selectedSize = String(item?.selectedSize ?? '').trim();
      const selectedColor = String(item?.selectedColor ?? '').trim();
      const quantity = Math.max(1, Number(item?.quantity ?? 1));
      if (!productId || !selectedSize) continue;

      const sizeRow = db
        .prepare('SELECT stock_quantity FROM product_sizes WHERE product_id = ? AND size_label = ?')
        .get(productId, selectedSize) as { stock_quantity: number } | undefined;
      if (!sizeRow || sizeRow.stock_quantity < 1) continue;

      const existing = db
        .prepare(
          'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND selected_size = ? AND selected_color = ?'
        )
        .get(req.user!.id, productId, selectedSize, selectedColor) as
        | { id: number; quantity: number }
        | undefined;

      const clamped = Math.min(sizeRow.stock_quantity, (existing?.quantity ?? 0) + quantity);
      if (existing) {
        db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(clamped, existing.id);
      } else {
        db.prepare(
          'INSERT INTO cart_items (user_id, product_id, selected_size, selected_color, quantity) VALUES (?, ?, ?, ?, ?)'
        ).run(req.user!.id, productId, selectedSize, selectedColor, clamped);
      }
    }
    res.json(getCartForUser(req.user!.id));
  });

  app.get('/api/wishlist', requireAuth, (req: AuthRequest, res) => {
    const rows = db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM wishlist_items wi
         JOIN products p ON p.id = wi.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE wi.user_id = ?
         ORDER BY wi.created_at DESC`
      )
      .all(req.user!.id) as any[];
    res.json({ items: hydrateProducts(rows) });
  });

  app.post('/api/wishlist/toggle', requireAuth, (req: AuthRequest, res) => {
    const productId = Number(req.body?.productId);
    const exists = db
      .prepare('SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?')
      .get(req.user!.id, productId) as { id: number } | undefined;

    if (exists) {
      db.prepare('DELETE FROM wishlist_items WHERE id = ?').run(exists.id);
    } else {
      const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      db.prepare('INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)').run(
        req.user!.id,
        productId
      );
    }

    const rows = db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM wishlist_items wi
         JOIN products p ON p.id = wi.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE wi.user_id = ?
         ORDER BY wi.created_at DESC`
      )
      .all(req.user!.id) as any[];
    res.json({ items: hydrateProducts(rows), inWishlist: !exists });
  });

  // ==================== CHECKOUT & ORDERS ====================

  app.post('/api/orders', (req: AuthRequest, res) => {
    const customerName = String(req.body?.customerName ?? '').trim();
    const customerEmail = String(req.body?.customerEmail ?? '').trim().toLowerCase();
    const customerPhone = String(req.body?.customerPhone ?? '').trim();
    const shippingCountry = String(req.body?.shippingCountry ?? '').trim();
    const shippingCity = String(req.body?.shippingCity ?? '').trim();
    const shippingAddress = String(req.body?.shippingAddress ?? '').trim();
    const shippingPostalCode = String(req.body?.shippingPostalCode ?? '').trim();
    const paymentMethod = String(req.body?.paymentMethod ?? '').trim();
    const couponCode = String(req.body?.couponCode ?? '').trim().toUpperCase();
    const saveAddress = Boolean(req.body?.saveAddress);
    const submittedItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }
    if (!isValidEmail(customerEmail)) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    if (!isValidPhone(customerPhone)) {
      res.status(400).json({ error: 'Valid phone number is required.' });
      return;
    }
    if (!shippingCountry || !shippingCity || shippingAddress.length < 5 || !shippingPostalCode) {
      res.status(400).json({ error: 'Complete shipping address is required.' });
      return;
    }
    if (!['Cash on Delivery', 'Bank Transfer'].includes(paymentMethod)) {
      res.status(400).json({ error: 'Please select a valid payment method.' });
      return;
    }

    let orderResult: ReturnType<typeof getOrderWithDetails> | null = null;
    const orderNumber = `WW-${Date.now().toString().slice(-6)}${crypto.randomInt(10, 99)}`;
    const trackingNumber = `TRK-WW-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    try {
      db.exec('BEGIN IMMEDIATE');

      let lineInputs: Array<{
        productId: number;
        selectedSize: string;
        selectedColor: string;
        quantity: number;
      }> = [];

      if (req.user && submittedItems.length === 0) {
        const dbCart = db
          .prepare('SELECT product_id, selected_size, selected_color, quantity FROM cart_items WHERE user_id = ?')
          .all(req.user.id) as Array<{
          product_id: number;
          selected_size: string;
          selected_color: string;
          quantity: number;
        }>;
        lineInputs = dbCart.map((c) => ({
          productId: c.product_id,
          selectedSize: c.selected_size,
          selectedColor: c.selected_color,
          quantity: c.quantity,
        }));
      } else {
        lineInputs = submittedItems.map((i: any) => ({
          productId: Number(i?.productId),
          selectedSize: String(i?.selectedSize ?? '').trim(),
          selectedColor: String(i?.selectedColor ?? 'Standard').trim(),
          quantity: Math.max(1, Math.min(20, Number(i?.quantity ?? 1))),
        }));
      }

      if (lineInputs.length === 0) {
        db.exec('ROLLBACK');
        res.status(400).json({ error: 'Your shopping bag is empty.' });
        return;
      }

      let subtotalCents = 0;
      const verifiedLines: Array<{
        productId: number;
        name: string;
        imageUrl: string;
        selectedSize: string;
        selectedColor: string;
        unitPriceCents: number;
        quantity: number;
        lineTotalCents: number;
      }> = [];

      for (const item of lineInputs) {
        const product = db
          .prepare(
            `SELECT p.id, p.name, p.regular_price_cents, p.sale_price_cents, p.stock_quantity,
                    (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as image_url
             FROM products p WHERE p.id = ?`
          )
          .get(item.productId) as
          | {
              id: number;
              name: string;
              regular_price_cents: number;
              sale_price_cents: number | null;
              stock_quantity: number;
              image_url: string | null;
            }
          | undefined;

        if (!product) {
          db.exec('ROLLBACK');
          res.status(404).json({ error: 'One or more products are no longer available.' });
          return;
        }

        const sizeRow = db
          .prepare('SELECT id, stock_quantity FROM product_sizes WHERE product_id = ? AND size_label = ?')
          .get(item.productId, item.selectedSize) as { id: number; stock_quantity: number } | undefined;

        if (!sizeRow || sizeRow.stock_quantity < item.quantity || product.stock_quantity < item.quantity) {
          db.exec('ROLLBACK');
          res.status(400).json({
            error: `Insufficient stock for ${product.name} (${item.selectedSize}).`,
          });
          return;
        }

        const unitPriceCents =
          product.sale_price_cents !== null && product.sale_price_cents < product.regular_price_cents
            ? product.sale_price_cents
            : product.regular_price_cents;

        const lineTotalCents = unitPriceCents * item.quantity;
        subtotalCents += lineTotalCents;

        db.prepare('UPDATE product_sizes SET stock_quantity = stock_quantity - ? WHERE id = ?').run(
          item.quantity,
          sizeRow.id
        );
        db.prepare(
          "UPDATE products SET stock_quantity = stock_quantity - ?, popularity_score = popularity_score + ?, updated_at = datetime('now') WHERE id = ?"
        ).run(item.quantity, item.quantity * 2, product.id);

        verifiedLines.push({
          productId: product.id,
          name: product.name,
          imageUrl: product.image_url ?? '',
          selectedSize: item.selectedSize,
          selectedColor: item.selectedColor,
          unitPriceCents,
          quantity: item.quantity,
          lineTotalCents,
        });
      }

      let discountCents = 0;
      let appliedCoupon: string | null = null;
      if (couponCode) {
        const coupon = db
          .prepare('SELECT code, discount_percent, min_order_cents, expires_at, is_active FROM coupons WHERE UPPER(code) = ?')
          .get(couponCode) as
          | {
              code: string;
              discount_percent: number;
              min_order_cents: number;
              expires_at: string;
              is_active: number;
            }
          | undefined;
        if (
          coupon &&
          coupon.is_active === 1 &&
          new Date(coupon.expires_at).getTime() >= Date.now() &&
          subtotalCents >= coupon.min_order_cents
        ) {
          discountCents = Math.round((subtotalCents * coupon.discount_percent) / 100);
          appliedCoupon = coupon.code;
        }
      }

      const settings = getStoreSettings();
      const freeThreshold = Number(settings.free_shipping_threshold_cents || 15000);
      const stdShipping = Number(settings.standard_shipping_cents || 1200);
      const discountedSubtotal = Math.max(0, subtotalCents - discountCents);
      const shippingCents = discountedSubtotal >= freeThreshold ? 0 : stdShipping;
      const totalCents = discountedSubtotal + shippingCents;

      const orderInsert = db
        .prepare(
          `INSERT INTO orders (
            order_number, user_id, customer_name, customer_email, customer_phone,
            shipping_country, shipping_city, shipping_address, shipping_postal_code,
            subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code,
            status, tracking_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`
        )
        .run(
          orderNumber,
          req.user?.id ?? null,
          customerName,
          customerEmail,
          customerPhone,
          shippingCountry,
          shippingCity,
          shippingAddress,
          shippingPostalCode,
          subtotalCents,
          discountCents,
          shippingCents,
          totalCents,
          appliedCoupon,
          trackingNumber
        );
      const orderId = Number(orderInsert.lastInsertRowid);

      const itemInsert = db.prepare(
        `INSERT INTO order_items (
          order_id, product_id, product_name, product_image, selected_size, selected_color,
          unit_price_cents, quantity, line_total_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const l of verifiedLines) {
        itemInsert.run(
          orderId,
          l.productId,
          l.name,
          l.imageUrl,
          l.selectedSize,
          l.selectedColor,
          l.unitPriceCents,
          l.quantity,
          l.lineTotalCents
        );
      }

      const refCode =
        paymentMethod === 'Bank Transfer'
          ? `WIRE-${orderNumber}`
          : `COD-${orderNumber}`;
      db.prepare(
        'INSERT INTO payments (order_id, method, status, amount_cents, reference_code) VALUES (?, ?, ?, ?, ?)'
      ).run(orderId, paymentMethod, 'Pending', totalCents, refCode);

      if (req.user) {
        db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
        if (saveAddress) {
          db.prepare(
            `INSERT INTO addresses (user_id, label, full_name, phone, country, city, street_address, postal_code, is_default)
             VALUES (?, 'Shipping', ?, ?, ?, ?, ?, ?, 0)`
          ).run(
            req.user.id,
            customerName,
            customerPhone,
            shippingCountry,
            shippingCity,
            shippingAddress,
            shippingPostalCode
          );
        }
      }

      const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      orderResult = getOrderWithDetails(orderRow);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    res.status(201).json({
      order: orderResult,
      receiptToken: signReceiptToken(orderNumber),
    });
  });

  app.get('/api/orders', requireAuth, (req: AuthRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user!.id) as any[];
    res.json({ orders: rows.map(getOrderWithDetails) });
  });

  app.get('/api/orders/:orderNumber', (req: AuthRequest, res) => {
    const orderNumber = String(req.params.orderNumber ?? '').trim();
    const receiptToken = String(req.query.receiptToken ?? '').trim();
    const lookupEmail = String(req.query.email ?? '').trim().toLowerCase();

    const row = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber) as any;
    if (!row) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const isOwner = req.user && row.user_id === req.user.id;
    const isAdmin = req.user?.role === 'admin';
    const hasReceipt = receiptToken && verifyReceiptToken(orderNumber, receiptToken);
    const hasEmailMatch = lookupEmail && row.customer_email.toLowerCase() === lookupEmail;

    if (!isOwner && !isAdmin && !hasReceipt && !hasEmailMatch) {
      res.status(403).json({ error: 'You are not authorized to view this order.' });
      return;
    }

    res.json({ order: getOrderWithDetails(row) });
  });

  app.post('/api/orders/:orderNumber/cancel', requireAuth, (req: AuthRequest, res) => {
    const orderNumber = String(req.params.orderNumber ?? '').trim();
    const row = db
      .prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?')
      .get(orderNumber, req.user!.id) as any;

    if (!row) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    if (row.status !== 'Pending') {
      res.status(400).json({ error: 'Only pending orders can be cancelled.' });
      return;
    }

    try {
      db.exec('BEGIN IMMEDIATE');
      const items = db
        .prepare('SELECT product_id, selected_size, quantity FROM order_items WHERE order_id = ?')
        .all(row.id) as Array<{ product_id: number | null; selected_size: string; quantity: number }>;

      for (const item of items) {
        if (!item.product_id) continue;
        db.prepare(
          'UPDATE product_sizes SET stock_quantity = stock_quantity + ? WHERE product_id = ? AND size_label = ?'
        ).run(item.quantity, item.product_id, item.selected_size);
        db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(
          item.quantity,
          item.product_id
        );
      }

      db.prepare("UPDATE orders SET status = 'Cancelled', updated_at = datetime('now') WHERE id = ?").run(
        row.id
      );
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(row.id) as any;
    res.json({ order: getOrderWithDetails(updated) });
  });

  // ==================== REVIEWS & CUSTOMER ACCOUNT ====================

  app.post('/api/products/:id/reviews', requireAuth, (req: AuthRequest, res) => {
    const productId = Number(req.params.id);
    const rating = Math.round(Number(req.body?.rating ?? 5));
    const title = String(req.body?.title ?? '').trim();
    const comment = String(req.body?.comment ?? '').trim();

    if (rating < 1 || rating > 5 || comment.length < 4) {
      res.status(400).json({ error: 'Rating (1-5) and review comment are required.' });
      return;
    }

    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const result = db
      .prepare(
        "INSERT INTO reviews (product_id, user_id, reviewer_name, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?, 'Approved')"
      )
      .run(productId, req.user!.id, req.user!.fullName, rating, title, comment);

    res.status(201).json({
      review: {
        id: Number(result.lastInsertRowid),
        reviewerName: req.user!.fullName,
        rating,
        title,
        comment,
        createdAt: new Date().toISOString(),
      },
    });
  });

  app.get('/api/account/profile', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  app.put('/api/account/profile', requireAuth, (req: AuthRequest, res) => {
    const fullName = String(req.body?.fullName ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    if (fullName.length < 2 || !isValidPhone(phone)) {
      res.status(400).json({ error: 'Valid full name and phone number are required.' });
      return;
    }
    db.prepare("UPDATE users SET full_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?").run(
      fullName,
      phone,
      req.user!.id
    );
    res.json({
      user: {
        ...req.user!,
        fullName,
        phone,
      },
    });
  });

  app.put('/api/account/password', requireAuth, (req: AuthRequest, res) => {
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as
      | { password_hash: string }
      | undefined;

    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      hashPassword(newPassword),
      req.user!.id
    );
    res.json({ ok: true, message: 'Password updated successfully.' });
  });

  app.get('/api/account/addresses', requireAuth, (req: AuthRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC')
      .all(req.user!.id) as any[];
    res.json({
      addresses: rows.map((a) => ({
        id: a.id,
        label: a.label,
        fullName: a.full_name,
        phone: a.phone,
        country: a.country,
        city: a.city,
        streetAddress: a.street_address,
        postalCode: a.postal_code,
        isDefault: a.is_default === 1,
      })),
    });
  });

  app.post('/api/account/addresses', requireAuth, (req: AuthRequest, res) => {
    const label = String(req.body?.label ?? 'Home').trim();
    const fullName = String(req.body?.fullName ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    const country = String(req.body?.country ?? '').trim();
    const city = String(req.body?.city ?? '').trim();
    const streetAddress = String(req.body?.streetAddress ?? '').trim();
    const postalCode = String(req.body?.postalCode ?? '').trim();
    const isDefault = Boolean(req.body?.isDefault);

    if (!fullName || !isValidPhone(phone) || !country || !city || !streetAddress || !postalCode) {
      res.status(400).json({ error: 'All address fields are required.' });
      return;
    }

    if (isDefault) {
      db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user!.id);
    }

    const result = db
      .prepare(
        `INSERT INTO addresses (user_id, label, full_name, phone, country, city, street_address, postal_code, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user!.id,
        label,
        fullName,
        phone,
        country,
        city,
        streetAddress,
        postalCode,
        isDefault ? 1 : 0
      );

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.delete('/api/account/addresses/:id', requireAuth, (req: AuthRequest, res) => {
    db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(
      Number(req.params.id),
      req.user!.id
    );
    res.json({ ok: true });
  });

  // ==================== ADMIN CONTROL CENTER ====================

  app.get('/api/admin/stats', requireAuth, requireAdmin, (_req, res) => {
    const revenue = db
      .prepare("SELECT COALESCE(SUM(total_cents), 0) as v FROM orders WHERE status != 'Cancelled'")
      .get() as { v: number };
    const ordersCount = db.prepare('SELECT COUNT(*) as v FROM orders').get() as { v: number };
    const productsCount = db.prepare('SELECT COUNT(*) as v FROM products').get() as { v: number };
    const customersCount = db
      .prepare("SELECT COUNT(*) as v FROM users WHERE role = 'customer'")
      .get() as { v: number };
    const pendingOrders = db
      .prepare("SELECT COUNT(*) as v FROM orders WHERE status = 'Pending'")
      .get() as { v: number };
    const lowStock = db
      .prepare('SELECT COUNT(*) as v FROM products WHERE stock_quantity <= 15')
      .get() as { v: number };

    const recentOrders = db
      .prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 6')
      .all() as any[];

    const lowStockProducts = db
      .prepare(
        `SELECT p.id, p.name, p.sku, p.stock_quantity, c.name as category_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.stock_quantity <= 15
         ORDER BY p.stock_quantity ASC
         LIMIT 8`
      )
      .all() as any[];

    const newsletterCount = db
      .prepare('SELECT COUNT(*) as v FROM newsletter_subscribers')
      .get() as { v: number };

    const revenueByCategory = db
      .prepare(
        `SELECT c.name as category_name, COALESCE(SUM(oi.line_total_cents), 0) as revenue_cents, COALESCE(SUM(oi.quantity), 0) as units_sold
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
         LEFT JOIN order_items oi ON oi.product_id = p.id
         LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'Cancelled'
         GROUP BY c.id
         ORDER BY revenue_cents DESC, c.display_order ASC
         LIMIT 6`
      )
      .all() as Array<{ category_name: string; revenue_cents: number; units_sold: number }>;

    res.json({
      stats: {
        totalRevenueCents: revenue.v,
        totalOrders: ordersCount.v,
        totalProducts: productsCount.v,
        totalCustomers: customersCount.v,
        pendingOrders: pendingOrders.v,
        lowStockProducts: lowStock.v,
        newsletterSubscribers: newsletterCount.v,
      },
      recentOrders: recentOrders.map(getOrderWithDetails),
      lowStockList: lowStockProducts,
      revenueByCategory: revenueByCategory.map((r) => ({
        categoryName: r.category_name,
        revenueCents: r.revenue_cents,
        unitsSold: r.units_sold,
      })),
    });
  });

  app.post('/api/admin/upload', requireAuth, requireAdmin, (req, res) => {
    const dataUrl = String(req.body?.dataUrl ?? '');
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Only PNG, JPEG, or WEBP images are supported.' });
      return;
    }
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Image must be smaller than 2MB.' });
      return;
    }

    const uploadsDir = path.resolve(process.cwd(), 'Backend', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const fileName = `ww_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const targetPath = path.resolve(uploadsDir, fileName);
    if (!targetPath.startsWith(uploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid upload path.' });
      return;
    }
    fs.writeFileSync(targetPath, buffer);
    res.json({ url: `/uploads/${fileName}` });
  });

  app.get('/api/admin/products', requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ORDER BY p.id DESC`
      )
      .all() as any[];
    res.json({ products: hydrateProducts(rows) });
  });

  app.post('/api/admin/products', requireAuth, requireAdmin, (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const sku = String(req.body?.sku ?? `WW-${Date.now().toString().slice(-5)}`).trim().toUpperCase();
    const description = String(req.body?.description ?? '').trim();
    const brand = String(req.body?.brand ?? 'WAREWEAR STUDIO').trim();
    const categoryId = Number(req.body?.categoryId);
    const regularPriceCents = Math.round(Number(req.body?.regularPrice ?? 0) * 100);
    const salePriceRaw = req.body?.salePrice;
    const salePriceCents =
      salePriceRaw !== null && salePriceRaw !== '' && Number(salePriceRaw) > 0
        ? Math.round(Number(salePriceRaw) * 100)
        : null;
    const gender = ['men', 'women', 'unisex'].includes(String(req.body?.gender))
      ? String(req.body.gender)
      : 'unisex';
    const isFeatured = req.body?.isFeatured ? 1 : 0;
    const isTrending = req.body?.isTrending ? 1 : 0;
    const isNewArrival = req.body?.isNewArrival ? 1 : 0;
    const isFlashSale = req.body?.isFlashSale ? 1 : 0;

    const images: string[] = Array.isArray(req.body?.images)
      ? req.body.images
          .map((u: unknown) => sanitizeImageUrl(String(u ?? '')))
          .filter((u: string | null): u is string => Boolean(u))
      : [];
    const sizes: Array<{ sizeLabel: string; stockQuantity: number }> = Array.isArray(req.body?.sizes)
      ? req.body.sizes
          .filter((s: any) => s?.sizeLabel)
          .map((s: any) => ({
            sizeLabel: String(s.sizeLabel).trim(),
            stockQuantity: Math.max(0, Number(s.stockQuantity ?? 0)),
          }))
      : [{ sizeLabel: 'M', stockQuantity: 10 }];
    const colors: Array<{ colorName: string; hexCode: string }> = Array.isArray(req.body?.colors)
      ? req.body.colors
          .filter((c: any) => c?.colorName)
          .map((c: any) => ({
            colorName: String(c.colorName).trim(),
            hexCode: /^#[0-9A-Fa-f]{6}$/.test(String(c.hexCode ?? '')) ? String(c.hexCode) : '#111111',
          }))
      : [{ colorName: 'Obsidian Black', hexCode: '#111111' }];

    if (!name || !categoryId || regularPriceCents <= 0) {
      res.status(400).json({ error: 'Name, category, and positive price are required.' });
      return;
    }

    const totalStock = sizes.reduce((acc, s) => acc + s.stockQuantity, 0);
    const baseSlug = slugify(name) || `product-${Date.now()}`;
    const existingSlug = db.prepare('SELECT id FROM products WHERE slug = ?').get(baseSlug);
    const finalSlug = existingSlug ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

    let productId = 0;
    try {
      db.exec('BEGIN IMMEDIATE');
      const result = db
        .prepare(
          `INSERT INTO products (
            sku, name, slug, description, brand, category_id, regular_price_cents,
            sale_price_cents, stock_quantity, gender, is_featured, is_trending, is_new_arrival, is_flash_sale
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          sku,
          name,
          finalSlug,
          description || `${name} crafted by ${brand}.`,
          brand,
          categoryId,
          regularPriceCents,
          salePriceCents,
          totalStock,
          gender,
          isFeatured,
          isTrending,
          isNewArrival,
          isFlashSale
        );
      productId = Number(result.lastInsertRowid);

      const finalImages =
        images.length > 0 ? images : ['/src/assets/images/prod_minimal_tee_1795446485007.jpg'];
      finalImages.forEach((url, idx) => {
        db.prepare(
          'INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).run(productId, url, name, idx === 0 ? 1 : 0, idx);
      });

      for (const s of sizes) {
        db.prepare(
          'INSERT OR REPLACE INTO product_sizes (product_id, size_label, stock_quantity) VALUES (?, ?, ?)'
        ).run(productId, s.sizeLabel, s.stockQuantity);
      }
      for (const c of colors) {
        db.prepare(
          'INSERT OR REPLACE INTO product_colors (product_id, color_name, hex_code) VALUES (?, ?, ?)'
        ).run(productId, c.colorName, c.hexCode);
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const row = db
      .prepare(
        'SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?'
      )
      .get(productId) as any;
    res.status(201).json({ product: hydrateProducts([row])[0] });
  });

  app.put('/api/admin/products/:id', requireAuth, requireAdmin, (req, res) => {
    const productId = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const brand = String(req.body?.brand ?? 'WAREWEAR STUDIO').trim();
    const categoryId = Number(req.body?.categoryId);
    const regularPriceCents = Math.round(Number(req.body?.regularPrice ?? 0) * 100);
    const salePriceRaw = req.body?.salePrice;
    const salePriceCents =
      salePriceRaw !== null && salePriceRaw !== '' && Number(salePriceRaw) > 0
        ? Math.round(Number(salePriceRaw) * 100)
        : null;
    const gender = ['men', 'women', 'unisex'].includes(String(req.body?.gender))
      ? String(req.body.gender)
      : 'unisex';
    const isFeatured = req.body?.isFeatured ? 1 : 0;
    const isTrending = req.body?.isTrending ? 1 : 0;
    const isNewArrival = req.body?.isNewArrival ? 1 : 0;
    const isFlashSale = req.body?.isFlashSale ? 1 : 0;

    const images: string[] = Array.isArray(req.body?.images)
      ? req.body.images
          .map((u: unknown) => sanitizeImageUrl(String(u ?? '')))
          .filter((u: string | null): u is string => Boolean(u))
      : [];
    const sizes: Array<{ sizeLabel: string; stockQuantity: number }> = Array.isArray(req.body?.sizes)
      ? req.body.sizes
          .filter((s: any) => s?.sizeLabel)
          .map((s: any) => ({
            sizeLabel: String(s.sizeLabel).trim(),
            stockQuantity: Math.max(0, Number(s.stockQuantity ?? 0)),
          }))
      : [];
    const colors: Array<{ colorName: string; hexCode: string }> = Array.isArray(req.body?.colors)
      ? req.body.colors
          .filter((c: any) => c?.colorName)
          .map((c: any) => ({
            colorName: String(c.colorName).trim(),
            hexCode: /^#[0-9A-Fa-f]{6}$/.test(String(c.hexCode ?? '')) ? String(c.hexCode) : '#111111',
          }))
      : [];

    if (!name || !categoryId || regularPriceCents <= 0) {
      res.status(400).json({ error: 'Name, category, and positive price are required.' });
      return;
    }

    const totalStock = sizes.reduce((acc, s) => acc + s.stockQuantity, 0);

    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare(
        `UPDATE products SET
          name = ?, description = ?, brand = ?, category_id = ?,
          regular_price_cents = ?, sale_price_cents = ?, stock_quantity = ?,
          gender = ?, is_featured = ?, is_trending = ?, is_new_arrival = ?, is_flash_sale = ?,
          updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        name,
        description,
        brand,
        categoryId,
        regularPriceCents,
        salePriceCents,
        totalStock,
        gender,
        isFeatured,
        isTrending,
        isNewArrival,
        isFlashSale,
        productId
      );

      if (images.length > 0) {
        db.prepare('DELETE FROM product_images WHERE product_id = ?').run(productId);
        images.forEach((url, idx) => {
          db.prepare(
            'INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)'
          ).run(productId, url, name, idx === 0 ? 1 : 0, idx);
        });
      }

      if (sizes.length > 0) {
        db.prepare('DELETE FROM product_sizes WHERE product_id = ?').run(productId);
        for (const s of sizes) {
          db.prepare(
            'INSERT INTO product_sizes (product_id, size_label, stock_quantity) VALUES (?, ?, ?)'
          ).run(productId, s.sizeLabel, s.stockQuantity);
        }
      }

      if (colors.length > 0) {
        db.prepare('DELETE FROM product_colors WHERE product_id = ?').run(productId);
        for (const c of colors) {
          db.prepare(
            'INSERT INTO product_colors (product_id, color_name, hex_code) VALUES (?, ?, ?)'
          ).run(productId, c.colorName, c.hexCode);
        }
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const row = db
      .prepare(
        'SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?'
      )
      .get(productId) as any;
    res.json({ product: hydrateProducts([row])[0] });
  });

  app.patch('/api/admin/products/:id/quick', requireAuth, requireAdmin, (req, res) => {
    const productId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const regularPriceCents =
      req.body?.regularPrice !== undefined
        ? Math.max(100, Math.round(Number(req.body.regularPrice) * 100))
        : existing.regular_price_cents;
    const salePriceCents =
      req.body?.salePrice !== undefined
        ? req.body.salePrice !== null && req.body.salePrice !== '' && Number(req.body.salePrice) > 0
          ? Math.round(Number(req.body.salePrice) * 100)
          : null
        : existing.sale_price_cents;

    const isFeatured = req.body?.isFeatured !== undefined ? (req.body.isFeatured ? 1 : 0) : existing.is_featured;
    const isTrending = req.body?.isTrending !== undefined ? (req.body.isTrending ? 1 : 0) : existing.is_trending;
    const isNewArrival = req.body?.isNewArrival !== undefined ? (req.body.isNewArrival ? 1 : 0) : existing.is_new_arrival;
    const isFlashSale = req.body?.isFlashSale !== undefined ? (req.body.isFlashSale ? 1 : 0) : existing.is_flash_sale;

    try {
      db.exec('BEGIN IMMEDIATE');
      if (Array.isArray(req.body?.sizes)) {
        for (const s of req.body.sizes) {
          if (!s?.sizeLabel) continue;
          db.prepare(
            'UPDATE product_sizes SET stock_quantity = ? WHERE product_id = ? AND size_label = ?'
          ).run(Math.max(0, Number(s.stockQuantity ?? 0)), productId, String(s.sizeLabel));
        }
      }
      const sumRow = db
        .prepare('SELECT COALESCE(SUM(stock_quantity), 0) as total FROM product_sizes WHERE product_id = ?')
        .get(productId) as { total: number };

      db.prepare(
        `UPDATE products SET
          regular_price_cents = ?, sale_price_cents = ?, stock_quantity = ?,
          is_featured = ?, is_trending = ?, is_new_arrival = ?, is_flash_sale = ?,
          updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        regularPriceCents,
        salePriceCents,
        sumRow.total,
        isFeatured,
        isTrending,
        isNewArrival,
        isFlashSale,
        productId
      );
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const row = db
      .prepare(
        'SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?'
      )
      .get(productId) as any;
    res.json({ product: hydrateProducts([row])[0] });
  });

  app.delete('/api/admin/products/:id', requireAuth, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/admin/categories', requireAuth, requireAdmin, (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const imageUrl = sanitizeImageUrl(String(req.body?.imageUrl ?? '')) ?? '';
    if (!name) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const slug = slugify(name);
    const result = db
      .prepare(
        'INSERT INTO categories (name, slug, description, image_url, display_order) VALUES (?, ?, ?, ?, 99)'
      )
      .run(name, slug, description, imageUrl);
    res.status(201).json({ id: Number(result.lastInsertRowid), name, slug });
  });

  app.put('/api/admin/categories/:id', requireAuth, requireAdmin, (req, res) => {
    const catId = Number(req.params.id);
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const imageUrl = sanitizeImageUrl(String(req.body?.imageUrl ?? ''));
    if (!name) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    db.prepare(
      'UPDATE categories SET name = ?, description = ?, image_url = COALESCE(?, image_url) WHERE id = ?'
    ).run(name, description, imageUrl, catId);
    res.json({ ok: true });
  });

  app.delete('/api/admin/categories/:id', requireAuth, requireAdmin, (req, res) => {
    const catId = Number(req.params.id);
    const count = db
      .prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?')
      .get(catId) as { c: number };
    if (count.c > 0) {
      res.status(400).json({ error: 'Cannot delete a category that still has products.' });
      return;
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
    res.json({ ok: true });
  });

  app.get('/api/admin/orders', requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as any[];
    res.json({ orders: rows.map(getOrderWithDetails) });
  });

  app.put('/api/admin/orders/:id/status', requireAuth, requireAdmin, (req, res) => {
    const orderId = Number(req.params.id);
    const status = String(req.body?.status ?? '');
    const trackingNumber = String(req.body?.trackingNumber ?? '').trim();
    const paymentStatus = String(req.body?.paymentStatus ?? '').trim();
    const allowed = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    const allowedPayment = ['Pending', 'Authorized', 'Paid', 'Refunded', 'Failed'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    try {
      db.exec('BEGIN IMMEDIATE');
      if (status === 'Cancelled' && existing.status !== 'Cancelled') {
        const items = db
          .prepare('SELECT product_id, selected_size, quantity FROM order_items WHERE order_id = ?')
          .all(orderId) as Array<{ product_id: number | null; selected_size: string; quantity: number }>;
        for (const item of items) {
          if (!item.product_id) continue;
          db.prepare(
            'UPDATE product_sizes SET stock_quantity = stock_quantity + ? WHERE product_id = ? AND size_label = ?'
          ).run(item.quantity, item.product_id, item.selected_size);
          db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(
            item.quantity,
            item.product_id
          );
        }
      }

      db.prepare(
        "UPDATE orders SET status = ?, tracking_number = COALESCE(NULLIF(?, ''), tracking_number), updated_at = datetime('now') WHERE id = ?"
      ).run(status, trackingNumber, orderId);

      if (paymentStatus && allowedPayment.includes(paymentStatus)) {
        db.prepare('UPDATE payments SET status = ? WHERE order_id = ?').run(paymentStatus, orderId);
      } else if (status === 'Delivered') {
        db.prepare("UPDATE payments SET status = 'Paid' WHERE order_id = ?").run(orderId);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    res.json({ order: getOrderWithDetails(updated) });
  });

  app.get('/api/admin/customers', requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
                COUNT(o.id) as order_count,
                COALESCE(SUM(CASE WHEN o.status != 'Cancelled' THEN o.total_cents ELSE 0 END), 0) as total_spent_cents
         FROM users u
         LEFT JOIN orders o ON o.user_id = u.id
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      )
      .all() as any[];

    res.json({
      customers: rows.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.is_active === 1,
        createdAt: u.created_at,
        orderCount: u.order_count,
        totalSpentCents: u.total_spent_cents,
      })),
    });
  });

  app.put('/api/admin/customers/:id', requireAuth, requireAdmin, (req: AuthRequest, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.user!.id) {
      res.status(400).json({ error: 'Cannot modify your own active admin status.' });
      return;
    }
    const isActive = req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : null;
    const role = req.body?.role && ['customer', 'admin'].includes(req.body.role) ? req.body.role : null;

    if (isActive !== null) {
      db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive, targetId);
      if (isActive === 0) {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
      }
    }
    if (role !== null) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/coupons', requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() as any[];
    res.json({
      coupons: rows.map((c) => ({
        id: c.id,
        code: c.code,
        discountPercent: c.discount_percent,
        minOrderCents: c.min_order_cents,
        expiresAt: c.expires_at,
        isActive: c.is_active === 1,
      })),
    });
  });

  app.post('/api/admin/coupons', requireAuth, requireAdmin, (req, res) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const discountPercent = Math.round(Number(req.body?.discountPercent ?? 0));
    const minOrderCents = Math.round(Math.max(0, Number(req.body?.minOrder ?? 0)) * 100);
    const expiresAt = String(req.body?.expiresAt ?? '').trim();

    if (!code || discountPercent < 1 || discountPercent > 90 || !expiresAt) {
      res.status(400).json({ error: 'Valid code, discount (1-90%), and expiry date required.' });
      return;
    }
    const result = db
      .prepare(
        'INSERT INTO coupons (code, discount_percent, min_order_cents, expires_at, is_active) VALUES (?, ?, ?, ?, 1)'
      )
      .run(code, discountPercent, minOrderCents, expiresAt);
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.put('/api/admin/coupons/:id', requireAuth, requireAdmin, (req, res) => {
    const isActive = req.body?.isActive ? 1 : 0;
    db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').run(isActive, Number(req.params.id));
    res.json({ ok: true });
  });

  app.delete('/api/admin/coupons/:id', requireAuth, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.get('/api/admin/reviews', requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT r.*, p.name as product_name
         FROM reviews r
         JOIN products p ON p.id = r.product_id
         ORDER BY r.created_at DESC`
      )
      .all() as any[];
    res.json({
      reviews: rows.map((r) => ({
        id: r.id,
        productId: r.product_id,
        productName: r.product_name,
        reviewerName: r.reviewer_name,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  });

  app.put('/api/admin/reviews/:id', requireAuth, requireAdmin, (req, res) => {
    const status = String(req.body?.status ?? '');
    if (!['Approved', 'Pending', 'Hidden'].includes(status)) {
      res.status(400).json({ error: 'Invalid status.' });
      return;
    }
    db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, Number(req.params.id));
    res.json({ ok: true });
  });

  app.delete('/api/admin/reviews/:id', requireAuth, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.get('/api/admin/newsletter', requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare('SELECT id, email, subscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC')
      .all() as Array<{ id: number; email: string; subscribed_at: string }>;
    res.json({
      subscribers: rows.map((r) => ({
        id: r.id,
        email: r.email,
        subscribedAt: r.subscribed_at,
      })),
    });
  });

  app.delete('/api/admin/newsletter/:id', requireAuth, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.get('/api/admin/settings', requireAuth, requireAdmin, (_req, res) => {
    res.json({ settings: getStoreSettings() });
  });

  app.put('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
    const entries = req.body?.settings;
    if (!entries || typeof entries !== 'object') {
      res.status(400).json({ error: 'Invalid settings payload.' });
      return;
    }
    const allowedKeys = new Set([
      'store_name',
      'tagline',
      'announcement_text',
      'hero_heading',
      'hero_subtitle',
      'hero_image',
      'offer_banner_title',
      'offer_banner_subtitle',
      'offer_banner_image',
      'support_email',
      'support_phone',
      'free_shipping_threshold_cents',
      'standard_shipping_cents',
    ]);
    const upsert = db.prepare(
      "INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
    );
    for (const [key, val] of Object.entries(entries)) {
      if (!allowedKeys.has(key)) continue;
      const strVal = String(val ?? '');
      if (key === 'hero_image' || key === 'offer_banner_image') {
        const safe = sanitizeImageUrl(strVal);
        if (!safe) continue;
        upsert.run(key, safe);
      } else {
        upsert.run(key, strVal);
      }
    }
    res.json({ settings: getStoreSettings() });
  });
}
