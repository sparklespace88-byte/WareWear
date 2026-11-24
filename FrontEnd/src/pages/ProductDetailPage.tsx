import React, { useEffect, useState } from 'react';
import { Check, Heart, Minus, Plus, ShieldCheck, Star, Truck, ZoomIn } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatPrice, type Product, type Review } from '../types';
import { ProductCard } from '../components/ProductCard';
import { SmartImage } from '../components/SmartImage';

interface ProductDetailPageProps {
  slug: string;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ slug }) => {
  const {
    navigate,
    user,
    addToCart,
    setIsCartOpen,
    isInWishlist,
    toggleWishlist,
    recordProductView,
    recentlyViewed,
    showToast,
  } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setActiveImageIdx(0);
    setQuantity(1);
    apiFetch<{ product: Product; reviews: Review[]; relatedProducts: Product[] }>(
      `/api/products/${encodeURIComponent(slug)}`
    )
      .then((res) => {
        setProduct(res.product);
        setReviews(res.reviews);
        setRelated(res.relatedProducts);
        const firstInStock = res.product.sizes.find((s) => s.stockQuantity > 0);
        setSelectedSize(firstInStock?.sizeLabel ?? res.product.sizes[0]?.sizeLabel ?? '');
        setSelectedColor(res.product.colors[0]?.colorName ?? 'Standard');
        recordProductView(res.product);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, recordProductView]);

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12 animate-pulse">
        <div className="aspect-[4/3] bg-black/8" />
        <div className="space-y-4">
          <div className="h-4 w-40 bg-black/8" />
          <div className="h-9 w-3/4 bg-black/10" />
          <div className="h-6 w-32 bg-black/8" />
          <div className="h-24 w-full bg-black/8" />
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-[#111111] mb-3">Piece Not Found</h1>
        <p className="text-sm text-[#6B6B6B] mb-6">
          This garment may have moved or sold out from our current seasonal edit.
        </p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-7 py-3.5 bg-[#111111] text-white text-sm font-medium cursor-pointer"
        >
          Return to Catalog
        </button>
      </div>
    );
  }

  const activeSizeObj = product.sizes.find((s) => s.sizeLabel === selectedSize);
  const maxAvailable = activeSizeObj ? activeSizeObj.stockQuantity : 0;
  const isOutOfStock = product.stockQuantity <= 0 || maxAvailable <= 0;
  const inWishlist = isInWishlist(product.id);
  const currentImg = product.images[activeImageIdx]?.imageUrl ?? product.images[0]?.imageUrl;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin({ x, y });
  };

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    await addToCart(product, selectedSize, selectedColor, quantity);
  };

  const handleBuyNow = async () => {
    if (isOutOfStock) return;
    await addToCart(product, selectedSize, selectedColor, quantity);
    setIsCartOpen(false);
    navigate('/checkout');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate(`/auth?redirect=/product/${product.slug}`);
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await apiFetch<{ review: Review }>(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating: reviewRating,
          title: reviewTitle.trim(),
          comment: reviewComment.trim(),
        }),
      });
      setReviews((prev) => [res.review, ...prev]);
      setReviewTitle('');
      setReviewComment('');
      showToast('Thank you for your review.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not submit review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24 lg:pb-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-[#6B6B6B] flex items-center gap-2 mb-8">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#111111] cursor-pointer">
          Home
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => navigate(`/shop?category=${encodeURIComponent(product.categorySlug)}`)}
          className="hover:text-[#111111] cursor-pointer"
        >
          {product.categoryName}
        </button>
        <span>/</span>
        <span className="text-[#111111] font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Split: Sticky Gallery + Sticky Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-28">
          <div
            onClick={() => setZoomActive((z) => !z)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setZoomActive(false)}
            className="relative aspect-[4/3] w-full bg-[#EFECE6] overflow-hidden cursor-zoom-in"
          >
            <div
              className="w-full h-full transition-transform duration-200"
              style={
                zoomActive
                  ? {
                      transform: 'scale(1.85)',
                      transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                    }
                  : undefined
              }
            >
              <SmartImage
                src={currentImg}
                alt={product.name}
                loading="eager"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-3 right-3 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-[#111111] flex items-center gap-1 pointer-events-none">
              <ZoomIn className="w-3.5 h-3.5" />
              <span>{zoomActive ? 'Zoom Active' : 'Click to Zoom'}</span>
            </div>
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`aspect-[4/3] bg-[#EFECE6] overflow-hidden border transition-colors cursor-pointer ${
                    idx === activeImageIdx ? 'border-[#111111]' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <SmartImage src={img.imageUrl} alt={img.altText || product.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Module */}
        <div className="lg:col-span-5 space-y-6 bg-white p-6 sm:p-8 border border-black/8">
          <div>
            <p className="text-xs text-[#6B6B6B] uppercase tracking-[0.14em]">
              {product.brand} · {product.categoryName} · {product.sku}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111111] mt-2 text-balance">
              {product.name}
            </h1>

            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono-tabular text-2xl font-semibold text-[#111111]">
                  {formatPrice(product.effectivePriceCents)}
                </span>
                {product.discountPercent > 0 && (
                  <>
                    <span className="font-mono-tabular text-sm text-[#888888] line-through">
                      {formatPrice(product.regularPriceCents)}
                    </span>
                    <span className="text-xs font-semibold text-[#111111] bg-[#D6C3A5]/45 px-2 py-0.5">
                      -{product.discountPercent}%
                    </span>
                  </>
                )}
              </div>
              {reviews.length > 0 && (
                <a href="#reviews" className="ml-auto flex items-center gap-1 text-xs text-[#333333] hover:underline">
                  <Star className="w-3.5 h-3.5 fill-[#111111] text-[#111111]" />
                  <span className="font-mono-tabular font-semibold">{product.avgRating.toFixed(1)}</span>
                  <span className="text-[#6B6B6B]">({reviews.length})</span>
                </a>
              )}
            </div>
          </div>

          <p className="text-sm text-[#444444] leading-relaxed border-t border-black/8 pt-5">
            {product.description}
          </p>

          {/* Color Selector */}
          {product.colors.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="font-semibold uppercase tracking-wider text-[#111111]">Color</span>
                <span className="text-[#555555]">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {product.colors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedColor(c.colorName)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs border transition-colors cursor-pointer ${
                      selectedColor === c.colorName
                        ? 'border-[#111111] bg-[#F7F7F7] font-semibold text-[#111111]'
                        : 'border-black/15 text-[#555555] hover:border-[#111111]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: c.hexCode }}
                    />
                    <span>{c.colorName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selector */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="font-semibold uppercase tracking-wider text-[#111111]">Size</span>
              <span className="font-mono-tabular text-[#555555]">
                {maxAvailable > 0
                  ? maxAvailable <= 5
                    ? `Low stock (${maxAvailable} remaining)`
                    : `In stock (${maxAvailable} available)`
                  : 'Out of stock'}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {product.sizes.map((s) => {
                const disabled = s.stockQuantity < 1;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setSelectedSize(s.sizeLabel);
                      setQuantity(1);
                    }}
                    className={`py-2.5 text-xs font-medium border transition-colors cursor-pointer ${
                      selectedSize === s.sizeLabel
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-[#111111] border-black/15 hover:border-[#111111]'
                    } disabled:opacity-30 disabled:line-through disabled:cursor-not-allowed`}
                  >
                    {s.sizeLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity & Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-black/20 h-12">
                <button
                  type="button"
                  disabled={isOutOfStock || quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-11 h-full flex items-center justify-center text-[#111111] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-mono-tabular text-sm font-semibold text-[#111111]">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={isOutOfStock || quantity >= maxAvailable}
                  onClick={() => setQuantity((q) => Math.min(maxAvailable, q + 1))}
                  aria-label="Increase quantity"
                  className="w-11 h-full flex items-center justify-center text-[#111111] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAddToCart}
                className="flex-1 h-12 bg-[#111111] text-white text-sm font-semibold tracking-wide hover:bg-[#333333] disabled:bg-black/25 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isOutOfStock ? 'Out of Stock' : 'Add to Bag'}
              </button>

              <button
                type="button"
                onClick={() => void toggleWishlist(product)}
                aria-label="Toggle wishlist"
                className="w-12 h-12 border border-black/20 flex items-center justify-center text-[#111111] hover:border-[#111111] transition-colors cursor-pointer"
              >
                <Heart className={`w-5 h-5 ${inWishlist ? 'fill-[#111111]' : ''}`} />
              </button>
            </div>

            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleBuyNow}
              className="w-full h-12 bg-[#D6C3A5] text-[#111111] text-sm font-semibold tracking-wide hover:bg-[#cab38f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Buy Now
            </button>
          </div>

          <div className="pt-4 border-t border-black/8 space-y-2.5 text-xs text-[#555555]">
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-[#111111] shrink-0" />
              <span>Complimentary express shipping on orders over $150.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#111111] shrink-0" />
              <span>30-day architectural fit guarantee &amp; effortless returns.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#111111] shrink-0" />
              <span>Cash on Delivery &amp; Bank Transfer verified checkout.</span>
            </div>
          </div>

        </div>
      </div>

      {/* Customer Reviews */}
      <section id="reviews" className="mt-20 pt-12 border-t border-black/10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6B6B6B] mb-1">
              Verified Feedback
            </p>
            <h2 className="font-display text-2xl font-bold text-[#111111]">
              Customer Reviews ({reviews.length})
            </h2>
          </div>

          <form onSubmit={handleReviewSubmit} className="bg-white p-6 border border-black/8 space-y-4">
            <h3 className="text-sm font-semibold text-[#111111]">Write a Review</h3>
            <div>
              <label className="block text-xs text-[#555555] mb-1.5">Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 cursor-pointer"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= reviewRating ? 'fill-[#111111] text-[#111111]' : 'text-black/20'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#555555] mb-1">Headline</label>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Summarize your impression"
                className="w-full border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#555555] mb-1">Review</label>
              <textarea
                rows={3}
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={
                  user
                    ? 'Share fit, fabric weight, and craftsmanship details...'
                    : 'Sign in to publish a verified review.'
                }
                className="w-full border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold hover:bg-[#333333] cursor-pointer"
            >
              {user ? (submittingReview ? 'Submitting...' : 'Submit Review') : 'Sign In to Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {reviews.length === 0 ? (
            <div className="bg-white p-8 border border-black/8 text-sm text-[#6B6B6B]">
              No reviews yet for this piece. Be the first to share your experience.
            </div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="bg-white p-6 border border-black/8">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < r.rating ? 'fill-[#111111] text-[#111111]' : 'text-black/15'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-[#888888] font-mono-tabular">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.title && <h4 className="text-sm font-semibold text-[#111111] mt-2">{r.title}</h4>}
                <p className="text-sm text-[#444444] mt-1.5 leading-relaxed">{r.comment}</p>
                <p className="text-xs text-[#6B6B6B] mt-3 font-medium">{r.reviewerName}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="mt-20 pt-12 border-t border-black/10">
          <h2 className="font-display text-2xl font-bold text-[#111111] mb-6">
            Complementary Pieces
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {recentlyViewed.filter((p) => p.id !== product.id).length > 0 && (
        <section className="mt-16 pt-12 border-t border-black/10">
          <h2 className="font-display text-xl font-semibold text-[#111111] mb-6">
            Recently Viewed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentlyViewed
              .filter((p) => p.id !== product.id)
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      )}

      {/* Sticky Mobile Purchase Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white border-t border-black/15 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[#6B6B6B] truncate max-w-[140px]">{product.name}</p>
          <p className="font-mono-tabular text-sm font-bold text-[#111111]">
            {formatPrice(product.effectivePriceCents)}
          </p>
        </div>
        <button
          type="button"
          disabled={isOutOfStock}
          onClick={handleAddToCart}
          className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold disabled:opacity-40"
        >
          {isOutOfStock ? 'Out of Stock' : `Add (${selectedSize})`}
        </button>
      </div>
    </div>
  );
};
