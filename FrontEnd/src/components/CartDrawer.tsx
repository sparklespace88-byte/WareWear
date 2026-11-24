import React, { useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2, X, ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatPrice } from '../types';
import { SmartImage } from './SmartImage';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cartItems,
    subtotalCents,
    shippingCents,
    freeShippingThresholdCents,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    updateCartItem,
    removeCartItem,
    navigate,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [applying, setApplying] = useState(false);

  if (!isCartOpen) return null;

  const discountCents = appliedCoupon?.discountCents ?? 0;
  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;
  const remainingForFreeShipping = Math.max(0, freeShippingThresholdCents - Math.max(0, subtotalCents - discountCents));
  const freeShippingProgress = Math.min(
    100,
    Math.round((Math.max(0, subtotalCents - discountCents) / freeShippingThresholdCents) * 100)
  );

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!couponInput.trim()) return;
    setApplying(true);
    try {
      await applyCoupon(couponInput.trim());
      setCouponInput('');
    } catch (err: any) {
      setCouponError(err.message || 'Invalid coupon code.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        onClick={() => setIsCartOpen(false)}
      />
      <aside className="relative w-full max-w-md bg-white h-full flex flex-col shadow-2xl z-10">
        <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#111111]" />
            <h2 className="font-display text-lg font-semibold text-[#111111]">
              Shopping Bag ({cartItems.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="Close shopping bag"
            className="p-2 text-[#111111] hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cartItems.length > 0 && (
          <div className="px-6 py-3 bg-[#F7F7F7] border-b border-black/8">
            <p className="text-xs text-[#333333] mb-1.5">
              {remainingForFreeShipping === 0
                ? 'You have unlocked complimentary express shipping.'
                : `Add ${formatPrice(remainingForFreeShipping)} more for complimentary express shipping.`}
            </p>
            <div className="w-full h-1 bg-black/10 overflow-hidden">
              <div
                className="h-full bg-[#111111] transition-all duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-[#F7F7F7] flex items-center justify-center mb-4">
                <ShoppingBag className="w-7 h-7 text-[#111111]/40 stroke-[1.5]" />
              </div>
              <h3 className="font-display text-lg font-semibold text-[#111111] mb-1">
                Your shopping bag is empty
              </h3>
              <p className="text-sm text-[#6B6B6B] max-w-xs mb-6">
                Explore architectural tailoring, heavyweight jersey essentials, and new seasonal arrivals.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/shop');
                }}
                className="px-6 py-3 bg-[#111111] text-white text-sm font-medium hover:bg-[#333333] transition-colors cursor-pointer"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-black/8">
              {cartItems.map((item) => (
                <li key={item.id} className="py-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      navigate(`/product/${item.slug}`);
                    }}
                    className="w-20 h-24 bg-[#F7F7F7] shrink-0 overflow-hidden cursor-pointer"
                  >
                    <SmartImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCartOpen(false);
                            navigate(`/product/${item.slug}`);
                          }}
                          className="text-sm font-semibold text-[#111111] text-left hover:underline line-clamp-1 cursor-pointer"
                        >
                          {item.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeCartItem(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="p-1 text-[#6B6B6B] hover:text-red-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {item.availableSizes && item.availableSizes.length > 0 ? (
                          <select
                            aria-label={`Change size for ${item.name}`}
                            value={item.selectedSize}
                            onChange={(e) =>
                              void updateCartItem(item.id, { selectedSize: e.target.value })
                            }
                            className="border border-black/15 bg-[#F7F7F7] px-1.5 py-0.5 text-[11px] text-[#111111]"
                          >
                            {item.availableSizes.map((s) => (
                              <option
                                key={s.sizeLabel}
                                value={s.sizeLabel}
                                disabled={s.stockQuantity < 1}
                              >
                                Size {s.sizeLabel}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-[#6B6B6B]">Size {item.selectedSize}</span>
                        )}

                        {item.availableColors && item.availableColors.length > 0 ? (
                          <select
                            aria-label={`Change color for ${item.name}`}
                            value={item.selectedColor}
                            onChange={(e) =>
                              void updateCartItem(item.id, { selectedColor: e.target.value })
                            }
                            className="border border-black/15 bg-[#F7F7F7] px-1.5 py-0.5 text-[11px] text-[#111111]"
                          >
                            {item.availableColors.map((c) => (
                              <option key={c.colorName} value={c.colorName}>
                                {c.colorName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-[#6B6B6B]">{item.selectedColor}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="inline-flex items-center border border-black/15">
                        <button
                          type="button"
                          onClick={() =>
                            void updateCartItem(item.id, { quantity: item.quantity - 1 })
                          }
                          aria-label="Decrease quantity"
                          className="w-8 h-8 flex items-center justify-center text-[#111111] hover:bg-black/5 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-mono-tabular text-xs font-medium text-[#111111]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.availableStock}
                          onClick={() =>
                            void updateCartItem(item.id, { quantity: item.quantity + 1 })
                          }
                          aria-label="Increase quantity"
                          className="w-8 h-8 flex items-center justify-center text-[#111111] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-mono-tabular text-sm font-semibold text-[#111111]">
                        {formatPrice(item.lineTotalCents)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 border-t border-black/10 bg-[#F7F7F7] space-y-4">
            {appliedCoupon ? (
              <div className="flex items-center justify-between text-xs bg-white px-3 py-2 border border-black/10">
                <span className="font-medium text-[#111111]">
                  Code <span className="font-mono-tabular">{appliedCoupon.code}</span> (-
                  {appliedCoupon.discountPercent}%)
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-[#6B6B6B] hover:text-[#111111] underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Promo code (e.g. WARE15)"
                  className="flex-1 bg-white border border-black/15 px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                />
                <button
                  type="submit"
                  disabled={applying}
                  className="px-4 py-2 bg-[#111111] text-white text-xs font-medium hover:bg-[#333333] disabled:opacity-50 cursor-pointer"
                >
                  Apply
                </button>
              </form>
            )}
            {couponError && <p className="text-xs text-red-700">{couponError}</p>}

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#555555]">
                <span>Subtotal</span>
                <span className="font-mono-tabular">{formatPrice(subtotalCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Discount</span>
                  <span className="font-mono-tabular">-{formatPrice(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#555555]">
                <span>Shipping</span>
                <span className="font-mono-tabular">
                  {shippingCents === 0 ? 'Complimentary' : formatPrice(shippingCents)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold text-[#111111] pt-2 border-t border-black/10">
                <span>Total</span>
                <span className="font-mono-tabular">{formatPrice(totalCents)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCartOpen(false);
                navigate('/checkout');
              }}
              className="w-full py-3.5 bg-[#111111] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#333333] transition-colors cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
