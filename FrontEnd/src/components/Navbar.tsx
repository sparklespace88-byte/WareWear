import React, { useEffect, useRef, useState } from 'react';
import { Heart, LogOut, Menu, Search, ShoppingBag, User as UserIcon, X, ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatPrice } from '../types';
import { SmartImage } from './SmartImage';

interface SearchSuggestions {
  products: Array<{
    id: number;
    name: string;
    slug: string;
    brand: string;
    categoryName: string;
    effectivePriceCents: number;
    imageUrl: string;
  }>;
  categories: Array<{ id: number; name: string; slug: string }>;
  brands: string[];
}

export const Navbar: React.FC = () => {
  const {
    currentPath,
    navigate,
    user,
    logout,
    settings,
    cartCount,
    setIsCartOpen,
    wishlist,
  } = useStore();

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestions | null>(null);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      window.setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch<SearchSuggestions>(
          `/api/products/suggestions?q=${encodeURIComponent(q)}`
        );
        setSuggestions(res);
      } catch {
        setSuggestions(null);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchOpen(false);
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  };

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Men', to: '/shop?gender=men' },
    { label: 'Women', to: '/shop?gender=women' },
    { label: 'Unisex', to: '/shop?gender=unisex' },
    { label: 'New Arrivals', to: '/shop?newArrival=true' },
    { label: 'Sale', to: '/shop?sale=true' },
  ];

  const announcement =
    settings.announcement_text ||
    'Complimentary express shipping on orders over $150 · Seasonal Archive Edit up to 30% off';

  return (
    <>
      <div className="sticky top-0 z-40 w-full">
        {!bannerDismissed && (
          <div className="bg-[#111111] text-white h-8 px-4 flex items-center justify-center relative text-xs tracking-wide">
            <p className="truncate max-w-[85vw] text-center font-medium">
              {announcement}
            </p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss announcement"
              className="absolute right-3 p-1 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <header className="bg-white/95 backdrop-blur-md border-b border-black/8">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-10 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-8">
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 -ml-2 text-[#111111] hover:bg-black/5 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="font-display text-xl sm:text-2xl font-bold tracking-[0.18em] text-[#111111] whitespace-nowrap shrink-0 cursor-pointer"
              >
                WAREWEAR
              </button>
            </div>

            <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => {
                const isActive =
                  link.to === '/'
                    ? currentPath === '/'
                    : currentPath === link.to;
                return (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => navigate(link.to)}
                    className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive ? 'text-[#111111]' : 'text-[#555555] hover:text-[#111111]'
                    }`}
                  >
                    {link.label}
                    <span
                      className={`absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#111111] transition-transform duration-200 origin-left ${
                        isActive ? 'scale-x-100' : 'scale-x-0'
                      }`}
                    />
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search catalog"
                className="p-2 sm:p-2.5 text-[#111111] hover:bg-black/5 transition-colors cursor-pointer"
              >
                <Search className="w-[18px] h-[18px] stroke-[1.75]" />
              </button>

              <button
                type="button"
                onClick={() => navigate(user ? '/account' : '/auth')}
                aria-label={user ? 'My Account' : 'Sign In'}
                className="p-2 sm:p-2.5 text-[#111111] hover:bg-black/5 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserIcon className="w-[18px] h-[18px] stroke-[1.75]" />
                {user && (
                  <span className="hidden xl:inline text-xs font-medium max-w-[90px] truncate">
                    {user.fullName.split(' ')[0]}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/wishlist')}
                aria-label="Wishlist"
                className="relative p-2 sm:p-2.5 text-[#111111] hover:bg-black/5 transition-colors cursor-pointer"
              >
                <Heart className="w-[18px] h-[18px] stroke-[1.75]" />
                {wishlist.length > 0 && (
                  <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 min-w-[16px] h-4 px-1 bg-[#111111] text-white text-[10px] font-mono-tabular flex items-center justify-center rounded-full">
                    {wishlist.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                aria-label="Shopping Bag"
                className="relative p-2 sm:p-2.5 text-[#111111] hover:bg-black/5 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-[18px] h-[18px] stroke-[1.75]" />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 min-w-[16px] h-4 px-1 bg-[#111111] text-white text-[10px] font-mono-tabular flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>

              {user && (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  aria-label="Logout"
                  title="Logout"
                  className="p-2 sm:p-2.5 text-[#111111] hover:bg-black/5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-[18px] h-[18px] stroke-[1.75]" />
                </button>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed top-0 bottom-0 left-0 w-[84vw] max-w-sm bg-white flex flex-col justify-between p-6 shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-black/10">
                <span className="font-display text-lg font-bold tracking-[0.18em] text-[#111111]">
                  WAREWEAR
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-2 text-[#111111]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="mt-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => {
                      navigate(link.to);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center justify-between py-3.5 text-base font-medium text-[#111111] border-b border-black/6 text-left"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="w-4 h-4 text-[#6B6B6B]" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    navigate('/shop');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between py-3.5 text-base font-medium text-[#111111] border-b border-black/6 text-left"
                >
                  <span>Full Collection</span>
                  <ArrowRight className="w-4 h-4 text-[#6B6B6B]" />
                </button>
              </nav>
            </div>
            <div className="pt-4 border-t border-black/10 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  navigate(user ? '/account' : '/auth');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-3 bg-[#111111] text-white text-sm font-medium tracking-wide"
              >
                {user ? `Account (${user.fullName})` : 'Sign In / Create Account'}
              </button>
              {user && (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setMobileMenuOpen(false);
                    navigate('/');
                  }}
                  className="w-full py-2.5 border border-red-200 text-red-700 text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Live Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4">
          <div className="w-full max-w-2xl bg-white shadow-2xl border border-black/10 overflow-hidden">
            <form onSubmit={handleSearchSubmit} className="flex items-center border-b border-black/10 px-4">
              <Search className="w-5 h-5 text-[#6B6B6B] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search garments, categories, or studio lines..."
                className="w-full py-4 px-3 text-base text-[#111111] placeholder:text-[#888888] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[#6B6B6B] hover:text-[#111111] px-2"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="p-2 text-[#111111]"
              >
                <X className="w-5 h-5" />
              </button>
            </form>

            <div className="max-h-[65vh] overflow-y-auto p-5">
              {!searchQuery.trim() ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#6B6B6B] mb-3">
                    Popular Searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Hoodie', 'Trench', 'Selvedge', 'Blazer', 'Sneakers', 'Crossbody'].map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setSearchQuery(term)}
                        className="px-3 py-1.5 text-sm bg-[#F7F7F7] hover:bg-[#D6C3A5]/35 text-[#111111] transition-colors cursor-pointer"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : searching ? (
                <p className="text-sm text-[#6B6B6B] py-6 text-center">Searching catalog...</p>
              ) : suggestions &&
                (suggestions.products.length > 0 || suggestions.categories.length > 0) ? (
                <div className="space-y-5">
                  {suggestions.categories.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-[#6B6B6B] mb-2">
                        Categories
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.categories.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSearchOpen(false);
                              navigate(`/shop?category=${encodeURIComponent(c.slug)}`);
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-[#F7F7F7] hover:bg-[#111111] hover:text-white transition-colors"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {suggestions.products.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-[#6B6B6B] mb-2">
                        Matching Pieces
                      </p>
                      <div className="divide-y divide-black/6">
                        {suggestions.products.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSearchOpen(false);
                              navigate(`/product/${p.slug}`);
                            }}
                            className="w-full py-2.5 flex items-center gap-3.5 text-left hover:bg-[#F7F7F7] px-2 transition-colors cursor-pointer"
                          >
                            <SmartImage
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-14 h-12 object-cover bg-[#F7F7F7] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#111111] truncate">{p.name}</p>
                              <p className="text-xs text-[#6B6B6B]">
                                {p.brand} · {p.categoryName}
                              </p>
                            </div>
                            <span className="font-mono-tabular text-sm font-medium text-[#111111]">
                              {formatPrice(p.effectivePriceCents)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
                    }}
                    className="w-full py-2.5 bg-[#111111] text-white text-sm font-medium hover:bg-[#333333] transition-colors"
                  >
                    View all results for &ldquo;{searchQuery.trim()}&rdquo;
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <p className="text-base font-medium text-[#111111]">
                    No pieces matched &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                  <p className="text-sm text-[#6B6B6B]">
                    Try searching by garment type like blazer, hoodie, denim, or sneakers.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
