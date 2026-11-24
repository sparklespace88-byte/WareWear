# WAREWEAR — Your Style. Your Identity.

A full-stack minimalist fashion e-commerce platform built with React, TypeScript, Tailwind CSS v4, Express, and SQLite (`node:sqlite`).

## Features

- **Editorial Storefront**: Announcement bar, 3-zone navigation bar, full-width campaign hero, featured categories, curated collections (New Arrivals, Best Sellers, Trending, Special Offers), and newsletter dispatch.
- **Full Product Catalog**: Live search suggestions, category/gender/price/size/color filtering, multi-criteria sorting, skeleton loading, and recently viewed items.
- **Product Details**: Multi-image studio gallery with zoom, size/color selectors with live per-size inventory validation, Buy Now / Add to Bag / Wishlist actions, verified customer reviews, and complementary pieces.
- **Shopping Bag & Multi-Step Checkout**: Persistent DB-backed cart (plus seamless guest cart merge upon sign-in), inline size/color editing, coupon validation, complimentary shipping progress, Cash on Delivery & Bank Transfer support, and atomic order placement.
- **Authentication & Customer Portal**: `scrypt` password hashing, HMAC-signed HTTP-only session cookies + memory Bearer tokens, verified password reset, profile & saved addresses management, and live order tracking timelines.
- **Admin Control Center**: Role-protected dashboard for revenue/inventory KPIs, full product & category CRUD with image uploads, order fulfillment & tracking updates, customer management, coupon creation, review moderation, and storefront banner settings.

## Project Structure

- `Backend/` — All backend application files:
  - `Backend/server.ts` — Express server entry point (port 3000) serving REST APIs and Vite/static assets
  - `Backend/db.ts` — Relational SQLite schema (19 tables with foreign keys and indexes) and catalog seeder
  - `Backend/security.ts` — Password hashing (`scrypt`), session tokens, CSRF verification, and RBAC middleware
  - `Backend/queries.ts` — Product, cart, and order hydration queries
  - `Backend/routes.ts` — Storefront, auth, cart, wishlist, checkout, account, and admin endpoints
  - `Backend/data/` — SQLite database directory (`warewear.db`)
  - `Backend/uploads/` — Uploaded product and banner image storage
- `FrontEnd/` — All frontend application files:
  - `FrontEnd/index.html` — HTML entry point
  - `FrontEnd/src/` — React + TypeScript + Tailwind CSS v4 frontend (`pages/`, `components/`, `context/`, `lib/`, `assets/`)

## Database & Local Setup

The relational SQLite database (`Backend/data/warewear.db`) initializes and seeds automatically on server startup with `PRAGMA foreign_keys = ON`.

```bash
# 1. Install dependencies
npm install

# 2. Configure optional environment variables (see .env.example)
cp .env.example .env

# 3. Start development server on port 3000
npm run dev

# 4. Type-check and build for production
npm run lint
npm run build
npm start
```

### First-Run Admin Setup

Visit `/admin` or `/auth` on first launch to claim the primary administrator account using your chosen email and password (or configure `ADMIN_PASSCODE` in your environment).
