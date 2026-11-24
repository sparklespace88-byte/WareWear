import React, { useEffect, useState } from 'react';
import { Banknote, Building2, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatPrice, type Address, type Order } from '../types';
import { SmartImage } from '../components/SmartImage';

export const CheckoutPage: React.FC = () => {
  const {
    user,
    cartItems,
    subtotalCents,
    shippingCents,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    clearLocalCartAfterOrder,
    navigate,
    showToast,
  } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [country, setCountry] = useState('United States');
  const [city, setCity] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState<'Cash on Delivery' | 'Bank Transfer'>(
    'Cash on Delivery'
  );
  const [couponInput, setCouponInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || user.fullName);
      setEmail((prev) => prev || user.email);
      setPhone((prev) => prev || user.phone);
      apiFetch<{ addresses: Address[] }>('/api/account/addresses')
        .then((res) => {
          setSavedAddresses(res.addresses);
          const def = res.addresses.find((a) => a.isDefault) ?? res.addresses[0];
          if (def) {
            setCountry(def.country);
            setCity(def.city);
            setStreetAddress(def.streetAddress);
            setPostalCode(def.postalCode);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const discountCents = appliedCoupon?.discountCents ?? 0;
  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  if (cartItems.length === 0 && step !== 4) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-[#111111] mb-2">
          Your shopping bag is empty
        </h1>
        <p className="text-sm text-[#6B6B6B] mb-6">
          Add pieces from the WAREWEAR collection before proceeding to checkout.
        </p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-7 py-3.5 bg-[#111111] text-white text-sm font-semibold cursor-pointer"
        >
          Browse Collection
        </button>
      </div>
    );
  }

  const validateStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (fullName.trim().length < 2 || !email.includes('@') || phone.replace(/[^0-9]/g, '').length < 7) {
      setError('Please enter a valid full name, email address, and phone number.');
      return;
    }
    setStep(2);
  };

  const validateStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!country.trim() || !city.trim() || streetAddress.trim().length < 5 || !postalCode.trim()) {
      setError('Please complete all shipping address fields.');
      return;
    }
    setStep(3);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        customerName: fullName.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        shippingCountry: country.trim(),
        shippingCity: city.trim(),
        shippingAddress: streetAddress.trim(),
        shippingPostalCode: postalCode.trim(),
        paymentMethod,
        couponCode: appliedCoupon?.code ?? '',
        saveAddress: Boolean(user && saveAddress),
        items: cartItems.map((i) => ({
          productId: i.productId,
          selectedSize: i.selectedSize,
          selectedColor: i.selectedColor,
          quantity: i.quantity,
        })),
      };
      const res = await apiFetch<{ order: Order; receiptToken: string }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setConfirmedOrder(res.order);
      clearLocalCartAfterOrder();
      setStep(4);
      showToast(`Order ${res.order.orderNumber} confirmed.`, 'success');
    } catch (err: any) {
      setError(err.message || 'Could not complete order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="mb-8 pb-6 border-b border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6B6B6B] mb-1">
            WAREWEAR Checkout
          </p>
          <h1 className="font-display text-3xl font-bold text-[#111111]">
            {step === 4 ? 'Order Confirmed' : 'Complete Your Order'}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          {[
            { n: 1, label: 'Customer' },
            { n: 2, label: 'Shipping' },
            { n: 3, label: 'Payment' },
            { n: 4, label: 'Confirmation' },
          ].map((s, idx) => (
            <React.Fragment key={s.n}>
              <span
                className={`px-2.5 py-1 ${
                  step === s.n
                    ? 'bg-[#111111] text-white'
                    : step > s.n
                    ? 'bg-[#D6C3A5]/45 text-[#111111]'
                    : 'text-[#888888]'
                }`}
              >
                {s.n}. {s.label}
              </span>
              {idx < 3 && <span className="text-[#CCCCCC]">/</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {step === 4 && confirmedOrder ? (
        <div className="max-w-3xl mx-auto bg-white border border-black/10 p-8 sm:p-10 space-y-6">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wider text-[#6B6B6B]">
                Order #{confirmedOrder.orderNumber} · {confirmedOrder.status}
              </p>
              <h2 className="font-display text-2xl font-bold text-[#111111] mt-1">
                Thank you, {confirmedOrder.customerName}
              </h2>
              <p className="text-sm text-[#555555] mt-1">
                Tracking Reference:{' '}
                <span className="font-mono-tabular font-semibold text-[#111111]">
                  {confirmedOrder.trackingNumber}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5 border-y border-black/10 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#6B6B6B] mb-1">Shipping To</p>
              <p className="font-medium text-[#111111]">{confirmedOrder.customerName}</p>
              <p className="text-[#555555]">{confirmedOrder.shippingAddress}</p>
              <p className="text-[#555555]">
                {confirmedOrder.shippingCity}, {confirmedOrder.shippingPostalCode},{' '}
                {confirmedOrder.shippingCountry}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[#6B6B6B] mb-1">Payment</p>
              <p className="font-medium text-[#111111]">{confirmedOrder.payment?.method}</p>
              <p className="text-[#555555]">
                Reference:{' '}
                <span className="font-mono-tabular">{confirmedOrder.payment?.referenceCode}</span>
              </p>
              <p className="text-[#555555]">
                Total:{' '}
                <span className="font-mono-tabular font-semibold text-[#111111]">
                  {formatPrice(confirmedOrder.totalCents)}
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
              Order Summary
            </h3>
            {confirmedOrder.items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 py-2">
                <SmartImage
                  src={item.productImage}
                  alt={item.productName}
                  className="w-14 h-14 object-cover bg-[#F7F7F7]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111111] truncate">{item.productName}</p>
                  <p className="text-xs text-[#6B6B6B]">
                    Size {item.selectedSize} · {item.selectedColor} · Qty {item.quantity}
                  </p>
                </div>
                <span className="font-mono-tabular text-sm font-medium text-[#111111]">
                  {formatPrice(item.lineTotalCents)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-6 py-3 bg-[#111111] text-white text-sm font-semibold cursor-pointer"
            >
              Continue Shopping
            </button>
            {user && (
              <button
                type="button"
                onClick={() => navigate('/account')}
                className="px-6 py-3 border border-black/20 text-[#111111] text-sm font-medium cursor-pointer"
              >
                Track in My Orders
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 bg-white border border-black/10 p-6 sm:p-8">
            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 text-xs text-red-800">
                {error}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={validateStep1} className="space-y-4">
                <h2 className="font-display text-xl font-semibold text-[#111111] mb-2">
                  Step 1: Customer Information
                </h2>
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#333333] mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#333333] mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-7 py-3.5 bg-[#111111] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#333333] cursor-pointer"
                  >
                    <span>Continue to Shipping</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={validateStep2} className="space-y-4">
                <h2 className="font-display text-xl font-semibold text-[#111111] mb-2">
                  Step 2: Shipping Address
                </h2>

                {savedAddresses.length > 0 && (
                  <div className="pb-3 border-b border-black/8">
                    <p className="text-xs font-medium text-[#6B6B6B] mb-2">Use Saved Address</p>
                    <div className="flex flex-wrap gap-2">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => {
                            setCountry(addr.country);
                            setCity(addr.city);
                            setStreetAddress(addr.streetAddress);
                            setPostalCode(addr.postalCode);
                          }}
                          className="px-3 py-1.5 text-xs border border-black/15 hover:border-[#111111] bg-[#F7F7F7] cursor-pointer"
                        >
                          {addr.label}: {addr.city}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#333333] mb-1">Country</label>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#333333] mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1">
                    Complete Street Address
                  </label>
                  <input
                    type="text"
                    required
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="Street, apartment, suite"
                    className="w-full border border-black/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full border border-black/20 px-3.5 py-2.5 text-sm font-mono-tabular focus:outline-none focus:border-[#111111]"
                  />
                </div>

                {user && (
                  <label className="flex items-center gap-2 text-xs text-[#555555] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="accent-[#111111]"
                    />
                    <span>Save this shipping address to my account</span>
                  </label>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-3 border border-black/20 text-sm font-medium cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-7 py-3 bg-[#111111] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span>Continue to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handlePlaceOrder} className="space-y-5">
                <h2 className="font-display text-xl font-semibold text-[#111111]">
                  Step 3: Payment Method
                </h2>

                <div className="space-y-3">
                  <label
                    className={`flex items-start gap-3.5 p-4 border cursor-pointer transition-colors ${
                      paymentMethod === 'Cash on Delivery'
                        ? 'border-[#111111] bg-[#F7F7F7]'
                        : 'border-black/15'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'Cash on Delivery'}
                      onChange={() => setPaymentMethod('Cash on Delivery')}
                      className="mt-1 accent-[#111111]"
                    />
                    <Banknote className="w-5 h-5 text-[#111111] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">Cash on Delivery</p>
                      <p className="text-xs text-[#6B6B6B] mt-0.5">
                        Pay securely in cash upon doorstep courier inspection and delivery.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3.5 p-4 border cursor-pointer transition-colors ${
                      paymentMethod === 'Bank Transfer'
                        ? 'border-[#111111] bg-[#F7F7F7]'
                        : 'border-black/15'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'Bank Transfer'}
                      onChange={() => setPaymentMethod('Bank Transfer')}
                      className="mt-1 accent-[#111111]"
                    />
                    <Building2 className="w-5 h-5 text-[#111111] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">Bank Transfer</p>
                      <p className="text-xs text-[#6B6B6B] mt-0.5">
                        Direct IBAN / wire settlement. Your unique transfer reference is issued upon confirmation.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-3.5 border border-black/20 text-sm font-medium cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3.5 bg-[#111111] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#333333] disabled:opacity-50 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Confirming Order...'
                        : `Place Order (${formatPrice(totalCents)})`}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <aside className="lg:col-span-5 bg-white border border-black/10 p-6 sm:p-7 space-y-5">
            <h2 className="font-display text-lg font-semibold text-[#111111]">
              Bag Summary ({cartItems.reduce((s, i) => s + i.quantity, 0)})
            </h2>
            <ul className="divide-y divide-black/8 max-h-72 overflow-y-auto">
              {cartItems.map((item) => (
                <li key={item.id} className="py-3 flex items-center gap-3">
                  <SmartImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-14 h-14 object-cover bg-[#F7F7F7] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111111] truncate">{item.name}</p>
                    <p className="text-xs text-[#6B6B6B]">
                      {item.selectedSize} · {item.selectedColor} · x{item.quantity}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-sm font-medium text-[#111111]">
                    {formatPrice(item.lineTotalCents)}
                  </span>
                </li>
              ))}
            </ul>

            {!appliedCoupon ? (
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Promo code (e.g. WARE15)"
                  className="flex-1 border border-black/15 px-3 py-2 text-xs focus:outline-none focus:border-[#111111]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (couponInput.trim()) {
                      applyCoupon(couponInput.trim()).catch((err) =>
                        showToast(err.message, 'error')
                      );
                    }
                  }}
                  className="px-4 py-2 bg-[#111111] text-white text-xs font-medium cursor-pointer"
                >
                  Apply
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs bg-[#F7F7F7] px-3 py-2">
                <span>
                  Applied: <strong className="font-mono-tabular">{appliedCoupon.code}</strong>
                </span>
                <button type="button" onClick={removeCoupon} className="underline cursor-pointer">
                  Remove
                </button>
              </div>
            )}

            <div className="space-y-2 text-sm pt-3 border-t border-black/10">
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
              <div className="flex justify-between text-base font-bold text-[#111111] pt-2 border-t border-black/10">
                <span>Total</span>
                <span className="font-mono-tabular">{formatPrice(totalCents)}</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
