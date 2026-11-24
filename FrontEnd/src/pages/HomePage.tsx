import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { SmartImage } from '../components/SmartImage';

type ShowcaseTab = 'new' | 'bestsellers' | 'trending' | 'flash';

export const HomePage: React.FC = () => {
  const { navigate, settings, categories, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('new');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ products: Product[] }>('/api/products?limit=24&sort=popularity')
      .then((res) => setAllProducts(res.products))
      .catch(() => setAllProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const displayedProducts = React.useMemo(() => {
    if (activeTab === 'new') {
      const list = allProducts.filter((p) => p.isNewArrival);
      return (list.length > 0 ? list : allProducts).slice(0, 8);
    }
    if (activeTab === 'bestsellers') {
      return [...allProducts].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 8);
    }
    if (activeTab === 'trending') {
      const list = allProducts.filter((p) => p.isTrending);
      return (list.length > 0 ? list : allProducts).slice(0, 8);
    }
    const list = allProducts.filter((p) => p.isFlashSale || p.discountPercent > 0);
    return (list.length > 0 ? list : allProducts).slice(0, 8);
  }, [activeTab, allProducts]);

  const featuredCategories = React.useMemo(() => {
    if (categories.length > 0) {
      return categories.slice(0, 7).map((c) => ({
        label: c.name,
        to: `/shop?category=${encodeURIComponent(c.slug)}`,
        image: c.imageUrl || '/src/assets/images/prod_minimal_tee_1795446485007.jpg',
      }));
    }
    return [
      {
        label: "Men's Fashion",
        to: '/shop?gender=men',
        image: '/src/assets/images/prod_mens_blazer_1795446485870.jpg',
      },
      {
        label: "Women's Fashion",
        to: '/shop?gender=women',
        image: '/src/assets/images/prod_womens_trench_1795446486205.jpg',
      },
      {
        label: 'Hoodies',
        to: '/shop?category=hoodies',
        image: '/src/assets/images/prod_boxy_hoodie_1795446485915.jpg',
      },
      {
        label: 'T-Shirts',
        to: '/shop?category=t-shirts',
        image: '/src/assets/images/prod_minimal_tee_1795446485007.jpg',
      },
      {
        label: 'Jeans',
        to: '/shop?category=jeans',
        image: '/src/assets/images/prod_selvedge_denim_1795446486075.jpg',
      },
      {
        label: 'Jackets',
        to: '/shop?category=jackets',
        image: '/src/assets/images/prod_technical_jacket_1795446485329.jpg',
      },
      {
        label: 'Accessories',
        to: '/shop?category=accessories',
        image: '/src/assets/images/prod_leather_crossbody_1795446486007.jpg',
      },
    ];
  }, [categories]);

  const heroImage =
    settings.hero_image || '/src/assets/images/hero_warewear_editorial_1795446485318.jpg';
  const heroHeading = settings.hero_heading || 'DEFINE YOUR EVERYDAY STYLE';
  const heroSubtitle =
    settings.hero_subtitle || 'Discover fashion that speaks your personality.';
  const offerImage =
    settings.offer_banner_image || '/src/assets/images/prod_leather_sneakers_1795446485032.jpg';

  const handleCopyPromo = () => {
    navigator.clipboard?.writeText('WARE15').catch(() => {});
    setCopiedCode(true);
    showToast('Promo code WARE15 copied to clipboard.', 'success');
    window.setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div>
      {/* Hero Banner */}
      <section className="relative w-full h-[520px] sm:h-[580px] md:h-[min(78vh,740px)] md:min-h-[500px] bg-[#111111] overflow-hidden">
        <div className="absolute inset-0 flex justify-end">
          <SmartImage
            src={heroImage}
            alt="WAREWEAR seasonal editorial collection"
            loading="eager"
            className="w-full h-full object-cover object-[76%_top] md:w-auto md:max-w-none md:h-full md:object-contain md:object-right md:[mask-image:linear-gradient(to_right,transparent_0%,black_18%,black_100%)]"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/90 via-[#111111]/40 to-transparent md:bg-gradient-to-r md:from-[#111111] md:via-[#111111]/35 md:to-transparent pointer-events-none" />
        <div className="absolute inset-0 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center">
          <div className="max-w-xl text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-[#D6C3A5] font-medium mb-3">
              WAREWEAR · Autumn / Winter Edit
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.06] tracking-tight text-balance">
              {heroHeading}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-white/85 max-w-md leading-relaxed">
              {heroSubtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="px-7 py-3.5 bg-white text-[#111111] text-sm font-semibold tracking-wide hover:bg-[#D6C3A5] transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Shop Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/shop?newArrival=true')}
                className="px-7 py-3.5 border border-white/45 text-white text-sm font-medium tracking-wide hover:bg-white/10 transition-colors cursor-pointer"
              >
                Explore Collection
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-16 pb-8">
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6B6B6B] mb-1">
              Curated Wardrobe
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111111]">
              Featured Categories
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="text-sm font-medium text-[#111111] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>View All ({categories.length || 10})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
          {featuredCategories.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => navigate(cat.to)}
              className="group text-left bg-white overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#EFECE6]">
                <SmartImage
                  src={cat.image}
                  alt={cat.label}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <p className="text-xs sm:text-sm font-semibold text-[#111111] truncate">
                  {cat.label}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Curated Collections (New Arrivals / Best Sellers / Trending / Flash Edit) */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6B6B6B] mb-1">
              Seasonal Selection
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111111]">
              New Arrivals &amp; Signature Pieces
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Collection filter"
            className="inline-flex items-center gap-1 p-1 bg-white border border-black/10 self-start md:self-auto overflow-x-auto max-w-full"
          >
            {[
              { id: 'new' as const, label: 'New Arrivals' },
              { id: 'bestsellers' as const, label: 'Best Sellers' },
              { id: 'trending' as const, label: 'Trending' },
              { id: 'flash' as const, label: 'Special Offers' },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#111111] text-white'
                    : 'text-[#555555] hover:text-[#111111]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() =>
              navigate(
                activeTab === 'flash'
                  ? '/shop?sale=true'
                  : activeTab === 'new'
                  ? '/shop?newArrival=true'
                  : '/shop'
              )
            }
            className="px-8 py-3.5 border border-[#111111] text-[#111111] text-sm font-semibold hover:bg-[#111111] hover:text-white transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Explore Full Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Special Offer Editorial Split */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 bg-[#111111] text-white items-stretch">
          <div className="p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#D6C3A5] mb-3">
              Limited Archive Offer
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-balance">
              {settings.offer_banner_title || 'THE ARCHITECTURAL CAPSULE'}
            </h2>
            <p className="mt-4 text-sm sm:text-base text-white/75 leading-relaxed max-w-md">
              {settings.offer_banner_subtitle ||
                'Heavyweight organic cottons, Italian wool blends, and structured outerwear. Use code WARE15 for 15% off orders over $120.'}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/shop?sale=true')}
                className="px-7 py-3.5 bg-[#D6C3A5] text-[#111111] text-sm font-semibold hover:bg-white transition-colors cursor-pointer"
              >
                Shop Seasonal Sale
              </button>
              <button
                type="button"
                onClick={handleCopyPromo}
                className="px-5 py-3.5 border border-white/25 text-white text-sm font-mono-tabular inline-flex items-center gap-2 hover:border-[#D6C3A5] transition-colors cursor-pointer"
              >
                <span>CODE: WARE15</span>
                {copiedCode ? <Check className="w-4 h-4 text-[#D6C3A5]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="aspect-[4/3] lg:aspect-auto lg:h-full bg-[#222222] overflow-hidden">
            <SmartImage
              src={offerImage}
              alt="WAREWEAR Architectural Capsule Footwear and Tailoring"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
