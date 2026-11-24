import React, { useState } from 'react';
import { Heart, Plus, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatPrice, type Product } from '../types';
import { SmartImage } from './SmartImage';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { navigate, addToCart, isInWishlist, toggleWishlist } = useStore();
  const [hovered, setHovered] = useState(false);
  const [quickSizesOpen, setQuickSizesOpen] = useState(false);

  const primaryImg = product.images[0]?.imageUrl;
  const secondaryImg = product.images[1]?.imageUrl;
  const displayImg = hovered && secondaryImg ? secondaryImg : primaryImg;
  const inWishlist = isInWishlist(product.id);
  const inStockSizes = product.sizes.filter((s) => s.stockQuantity > 0);
  const defaultColor = product.colors[0]?.colorName ?? 'Standard';

  const subtleTag =
    product.discountPercent > 0
      ? `Save ${product.discountPercent}%`
      : product.isNewArrival
      ? 'New Arrival'
      : null;

  return (
    <article
      className="group bg-white flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setQuickSizesOpen(false);
      }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EFECE6]">
        <button
          type="button"
          onClick={() => navigate(`/product/${product.slug}`)}
          className="w-full h-full block cursor-pointer"
          aria-label={`View ${product.name}`}
        >
          <SmartImage
            src={displayImg}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </button>

        {subtleTag && (
          <span className="absolute top-3 left-3 bg-white/92 backdrop-blur-xs px-2.5 py-1 text-[11px] font-medium tracking-wide text-[#111111]">
            {subtleTag}
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void toggleWishlist(product);
          }}
          aria-label={inWishlist ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="absolute top-3 right-3 w-9 h-9 bg-white/92 backdrop-blur-xs flex items-center justify-center text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
        >
          <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} />
        </button>

        {/* Quick Add Size Selector */}
        {inStockSizes.length > 0 && (
          <div className="absolute inset-x-3 bottom-3">
            {quickSizesOpen ? (
              <div className="bg-white/96 backdrop-blur-md p-2 border border-black/10 shadow-lg">
                <p className="text-[11px] font-medium text-[#6B6B6B] mb-1.5 text-center">
                  Select Size
                </p>
                <div className="flex flex-wrap justify-center gap-1">
                  {product.sizes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={s.stockQuantity < 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickSizesOpen(false);
                        void addToCart(product, s.sizeLabel, defaultColor, 1);
                      }}
                      className="min-w-[34px] h-8 px-2 text-xs font-medium border border-black/15 text-[#111111] hover:bg-[#111111] hover:text-white disabled:opacity-30 disabled:line-through transition-colors cursor-pointer"
                    >
                      {s.sizeLabel}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (inStockSizes.length === 1) {
                    void addToCart(product, inStockSizes[0].sizeLabel, defaultColor, 1);
                  } else {
                    setQuickSizesOpen(true);
                  }
                }}
                className="w-full py-2.5 bg-[#111111]/92 text-white text-xs font-medium tracking-wide flex items-center justify-center gap-1.5 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 hover:bg-[#111111] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Quick Add</span>
              </button>
            )}
          </div>
        )}

        {inStockSizes.length === 0 && (
          <div className="absolute inset-x-3 bottom-3 py-2 bg-white/90 text-center text-xs font-medium text-[#6B6B6B]">
            Sold Out
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-2">
        <div>
          <p className="text-xs text-[#6B6B6B] truncate">
            {product.brand} · {product.categoryName}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/product/${product.slug}`)}
            className="mt-1 text-left text-[15px] font-semibold text-[#111111] hover:underline line-clamp-1 block w-full cursor-pointer"
          >
            {product.name}
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono-tabular text-[15px] font-semibold text-[#111111]">
              {formatPrice(product.effectivePriceCents)}
            </span>
            {product.discountPercent > 0 && (
              <span className="font-mono-tabular text-xs text-[#888888] line-through">
                {formatPrice(product.regularPriceCents)}
              </span>
            )}
          </div>

          {product.reviewCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-[#555555]">
              <Star className="w-3.5 h-3.5 fill-[#111111] text-[#111111]" />
              <span className="font-mono-tabular font-medium">{product.avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
