import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { Product } from '../types';
import { ProductCard } from '../components/ProductCard';

export const ShopPage: React.FC = () => {
  const { currentPath, navigate, categories, recentlyViewed } = useStore();

  const urlParams = new URLSearchParams(currentPath.split('?')[1] ?? '');
  const [searchTerm, setSearchTerm] = useState(urlParams.get('q') ?? '');
  const [category, setCategory] = useState(urlParams.get('category') ?? 'all');
  const [gender, setGender] = useState(urlParams.get('gender') ?? '');
  const [saleOnly, setSaleOnly] = useState(urlParams.get('sale') === 'true');
  const [newOnly, setNewOnly] = useState(urlParams.get('newArrival') === 'true');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [availableColors, setAvailableColors] = useState<Array<{ name: string; hex: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Sync URL query params when top navigation changes
  useEffect(() => {
    const p = new URLSearchParams(currentPath.split('?')[1] ?? '');
    setSearchTerm(p.get('q') ?? '');
    setCategory(p.get('category') ?? 'all');
    setGender(p.get('gender') ?? '');
    setSaleOnly(p.get('sale') === 'true');
    setNewOnly(p.get('newArrival') === 'true');
  }, [currentPath]);

  useEffect(() => {
    const query = new URLSearchParams();
    if (searchTerm.trim()) query.set('q', searchTerm.trim());
    if (category && category !== 'all') query.set('category', category);
    if (gender) query.set('gender', gender);
    if (saleOnly) query.set('sale', 'true');
    if (newOnly) query.set('newArrival', 'true');
    if (selectedSize) query.set('size', selectedSize);
    if (selectedColor) query.set('color', selectedColor);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    query.set('sort', sort);
    query.set('limit', '60');

    setLoading(true);
    apiFetch<{
      products: Product[];
      total: number;
      facets: { sizes: string[]; colors: Array<{ name: string; hex: string }> };
    }>(`/api/products?${query.toString()}`)
      .then((res) => {
        setProducts(res.products);
        setTotal(res.total);
        setAvailableSizes(res.facets.sizes);
        setAvailableColors(res.facets.colors);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [searchTerm, category, gender, saleOnly, newOnly, selectedSize, selectedColor, minPrice, maxPrice, sort]);

  const resetFilters = () => {
    setSearchTerm('');
    setCategory('all');
    setGender('');
    setSaleOnly(false);
    setNewOnly(false);
    setSelectedSize('');
    setSelectedColor('');
    setMinPrice('');
    setMaxPrice('');
    setSort('newest');
    navigate('/shop');
  };

  const pageHeading = saleOnly
    ? 'Archive Sale'
    : newOnly
    ? 'New Arrivals'
    : gender === 'men'
    ? "Men's Collection"
    : gender === 'women'
    ? "Women's Collection"
    : gender === 'unisex'
    ? 'Unisex Core'
    : 'Full Collection';

  const filterPanel = (
    <div className="space-y-7">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111111] mb-3">
          Gender / Line
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: '', label: 'All' },
            { value: 'men', label: 'Men' },
            { value: 'women', label: 'Women' },
            { value: 'unisex', label: 'Unisex' },
          ].map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => setGender(g.value)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                gender === g.value
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#333333] border-black/15 hover:border-[#111111]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111111] mb-3">
          Category
        </h3>
        <ul className="space-y-1.5 text-sm">
          <li>
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`w-full text-left py-1 transition-colors cursor-pointer ${
                category === 'all' ? 'font-semibold text-[#111111]' : 'text-[#555555] hover:text-[#111111]'
              }`}
            >
              All Categories
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setCategory(c.slug)}
                className={`w-full text-left py-1 flex items-center justify-between transition-colors cursor-pointer ${
                  category === c.slug
                    ? 'font-semibold text-[#111111]'
                    : 'text-[#555555] hover:text-[#111111]'
                }`}
              >
                <span>{c.name}</span>
                {typeof c.productCount === 'number' && (
                  <span className="font-mono-tabular text-xs text-[#888888]">{c.productCount}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111111] mb-3">
          Price Range ($)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min"
            className="w-full bg-white border border-black/15 px-3 py-2 text-xs font-mono-tabular focus:outline-none focus:border-[#111111]"
          />
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max"
            className="w-full bg-white border border-black/15 px-3 py-2 text-xs font-mono-tabular focus:outline-none focus:border-[#111111]"
          />
        </div>
      </div>

      {availableSizes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111111] mb-3">
            Size
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {availableSizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSize(selectedSize === s ? '' : s)}
                className={`min-w-[38px] px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                  selectedSize === s
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-white text-[#333333] border-black/15 hover:border-[#111111]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {availableColors.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111111] mb-3">
            Color
          </h3>
          <div className="flex flex-wrap gap-2">
            {availableColors.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => setSelectedColor(selectedColor === c.name ? '' : c.name)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors cursor-pointer ${
                  selectedColor === c.name
                    ? 'border-[#111111] bg-[#111111] text-white'
                    : 'border-black/15 bg-white text-[#333333] hover:border-[#111111]'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-black/10">
        <label className="flex items-center gap-2 text-sm text-[#333333] cursor-pointer">
          <input
            type="checkbox"
            checked={saleOnly}
            onChange={(e) => setSaleOnly(e.target.checked)}
            className="accent-[#111111]"
          />
          <span>On Sale Only</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-[#333333] cursor-pointer">
          <input
            type="checkbox"
            checked={newOnly}
            onChange={(e) => setNewOnly(e.target.checked)}
            className="accent-[#111111]"
          />
          <span>New Arrivals Only</span>
        </label>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full py-2.5 border border-black/20 text-xs font-medium text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
      >
        Reset All Filters
      </button>
    </div>
  );

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-black/10">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6B6B6B] mb-1">
            WAREWEAR Catalog · {total} Pieces
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#111111]">
            {pageHeading}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by keyword..."
              className="w-full bg-white border border-black/15 pl-9 pr-3 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
            />
          </div>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-white border border-black/15 px-3 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
          >
            <option value="newest">Sort: Newest</option>
            <option value="popularity">Sort: Popularity</option>
            <option value="rating">Sort: Top Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-black/15 text-sm font-medium text-[#111111]"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      <div className="pt-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10 items-start">
        <aside className="hidden lg:block sticky top-28">{filterPanel}</aside>

        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="bg-white animate-pulse">
                  <div className="aspect-[4/3] bg-black/8" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-24 bg-black/8" />
                    <div className="h-4 w-3/4 bg-black/10" />
                    <div className="h-4 w-16 bg-black/8" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white p-12 text-center border border-black/8">
              <h2 className="font-display text-xl font-semibold text-[#111111] mb-2">
                No pieces match your current selection
              </h2>
              <p className="text-sm text-[#6B6B6B] max-w-md mx-auto mb-6">
                Adjust your price range, size, or category filter to explore the complete WAREWEAR wardrobe.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-6 py-3 bg-[#111111] text-white text-sm font-medium hover:bg-[#333333] cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {recentlyViewed.length > 0 && (
        <section className="mt-20 pt-10 border-t border-black/10">
          <h2 className="font-display text-xl font-semibold text-[#111111] mb-6">
            Recently Viewed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentlyViewed.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile Filter Sheet */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <aside className="relative w-80 max-w-[85vw] bg-white h-full overflow-y-auto p-6 z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-black/10">
              <h2 className="font-display text-lg font-semibold text-[#111111]">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="p-1.5 text-[#111111]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {filterPanel}
          </aside>
        </div>
      )}
    </div>
  );
};
