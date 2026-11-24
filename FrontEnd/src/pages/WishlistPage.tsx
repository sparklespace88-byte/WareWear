import React from 'react';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatPrice } from '../types';
import { SmartImage } from '../components/SmartImage';

export const WishlistPage: React.FC = () => {
  const { user, wishlist, toggleWishlist, addToCart, navigate } = useStore();

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-14 h-14 bg-white border border-black/10 flex items-center justify-center mx-auto mb-5">
          <Heart className="w-6 h-6 text-[#111111]" />
        </div>
        <h1 className="font-display text-2xl font-bold text-[#111111] mb-2">
          Save Your Curated Pieces
        </h1>
        <p className="text-sm text-[#6B6B6B] mb-6">
          Sign in to your WAREWEAR account to preserve your wishlist across sessions and devices.
        </p>
        <button
          type="button"
          onClick={() => navigate('/auth?redirect=/wishlist')}
          className="px-8 py-3.5 bg-[#111111] text-white text-sm font-semibold hover:bg-[#333333] cursor-pointer"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="pb-6 border-b border-black/10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6B6B6B] mb-1">
            Personal Archive
          </p>
          <h1 className="font-display text-3xl font-bold text-[#111111]">
            My Wishlist ({wishlist.length})
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="text-sm font-medium text-[#111111] hover:underline cursor-pointer"
        >
          Continue Shopping
        </button>
      </div>

      {wishlist.length === 0 ? (
        <div className="bg-white p-14 mt-8 text-center border border-black/8">
          <Heart className="w-8 h-8 text-[#111111]/30 mx-auto mb-3" />
          <h2 className="font-display text-xl font-semibold text-[#111111] mb-2">
            Your wishlist is currently empty
          </h2>
          <p className="text-sm text-[#6B6B6B] mb-6">
            Tap the heart icon on any piece to save it here for later.
          </p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-7 py-3 bg-[#111111] text-white text-sm font-semibold cursor-pointer"
          >
            Explore Collection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {wishlist.map((product) => {
            const firstAvailable = product.sizes.find((s) => s.stockQuantity > 0);
            const defaultColor = product.colors[0]?.colorName ?? 'Standard';
            return (
              <div key={product.id} className="bg-white border border-black/8 flex flex-col">
                <button
                  type="button"
                  onClick={() => navigate(`/product/${product.slug}`)}
                  className="aspect-[4/3] w-full bg-[#EFECE6] overflow-hidden cursor-pointer"
                >
                  <SmartImage
                    src={product.images[0]?.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#6B6B6B]">{product.brand}</p>
                    <button
                      type="button"
                      onClick={() => navigate(`/product/${product.slug}`)}
                      className="text-sm font-semibold text-[#111111] hover:underline text-left mt-0.5 line-clamp-1 cursor-pointer"
                    >
                      {product.name}
                    </button>
                    <p className="font-mono-tabular text-sm font-semibold text-[#111111] mt-1">
                      {formatPrice(product.effectivePriceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={!firstAvailable}
                      onClick={async () => {
                        if (!firstAvailable) return;
                        await addToCart(product, firstAvailable.sizeLabel, defaultColor, 1);
                        await toggleWishlist(product);
                      }}
                      className="flex-1 py-2.5 bg-[#111111] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:bg-[#333333] disabled:opacity-40 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{firstAvailable ? `Move (${firstAvailable.sizeLabel})` : 'Sold Out'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleWishlist(product)}
                      aria-label={`Remove ${product.name}`}
                      className="p-2.5 border border-black/15 text-[#6B6B6B] hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
