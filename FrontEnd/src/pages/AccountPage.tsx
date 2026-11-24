import React, { useEffect, useState } from 'react';
import { Heart, KeyRound, LogOut, MapPin, Package, User as UserIcon, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatPrice, type Address, type Order } from '../types';
import { SmartImage } from '../components/SmartImage';

type AccountTab = 'profile' | 'orders' | 'wishlist' | 'addresses' | 'password';

const ORDER_STAGES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'] as const;

export const AccountPage: React.FC = () => {
  const { user, authLoading, navigate, logout, refreshAuth, wishlist, showToast } = useStore();
  const [tab, setTab] = useState<AccountTab>('orders');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [newAddr, setNewAddr] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    country: 'United States',
    city: '',
    streetAddress: '',
    postalCode: '',
    isDefault: true,
  });

  const [currPass, setCurrPass] = useState('');
  const [nextPass, setNextPass] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone);
      setNewAddr((prev) => ({ ...prev, fullName: user.fullName, phone: user.phone }));
      apiFetch<{ orders: Order[] }>('/api/orders')
        .then((res) => setOrders(res.orders))
        .catch(() => {});
      apiFetch<{ addresses: Address[] }>('/api/account/addresses')
        .then((res) => setAddresses(res.addresses))
        .catch(() => {});
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-sm text-[#6B6B6B]">
        Loading account...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-[#111111] mb-2">
          Sign In to Your Account
        </h1>
        <p className="text-sm text-[#6B6B6B] mb-6">
          Access your orders, tracking updates, saved addresses, and personal wishlist.
        </p>
        <button
          type="button"
          onClick={() => navigate('/auth?redirect=/account')}
          className="px-8 py-3.5 bg-[#111111] text-white text-sm font-semibold cursor-pointer"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, phone }),
      });
      await refreshAuth();
      showToast('Profile updated.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/addresses', {
        method: 'POST',
        body: JSON.stringify(newAddr),
      });
      const res = await apiFetch<{ addresses: Address[] }>('/api/account/addresses');
      setAddresses(res.addresses);
      setNewAddr({
        label: 'Office',
        fullName: user.fullName,
        phone: user.phone,
        country: 'United States',
        city: '',
        streetAddress: '',
        postalCode: '',
        isDefault: false,
      });
      showToast('Address saved.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAddress = async (id: number) => {
    await apiFetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    showToast('Address removed.', 'info');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: currPass, newPassword: nextPass }),
      });
      setCurrPass('');
      setNextPass('');
      showToast('Password updated.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCancelOrder = async (orderNumber: string) => {
    try {
      const res = await apiFetch<{ order: Order }>(`/api/orders/${orderNumber}/cancel`, {
        method: 'POST',
      });
      setOrders((prev) => prev.map((o) => (o.orderNumber === orderNumber ? res.order : o)));
      setSelectedOrder(res.order);
      showToast(`Order ${orderNumber} cancelled.`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="pb-6 border-b border-black/10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6B6B6B] mb-1">
            Customer Portal
          </p>
          <h1 className="font-display text-3xl font-bold text-[#111111]">
            Welcome, {user.fullName}
          </h1>
        </div>
      </div>

      <div className="pt-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 items-start">
        <aside className="bg-white border border-black/8 p-3 space-y-1">
          {[
            { id: 'orders' as const, label: 'My Orders & Tracking', icon: Package },
            { id: 'profile' as const, label: 'My Profile', icon: UserIcon },
            { id: 'wishlist' as const, label: `My Wishlist (${wishlist.length})`, icon: Heart },
            { id: 'addresses' as const, label: 'Saved Addresses', icon: MapPin },
            { id: 'password' as const, label: 'Change Password', icon: KeyRound },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setSelectedOrder(null);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-left transition-colors cursor-pointer ${
                  tab === item.id
                    ? 'bg-[#111111] text-white'
                    : 'text-[#333333] hover:bg-[#F7F7F7]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-left text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </aside>

        <div className="bg-white border border-black/8 p-6 sm:p-8">
          {tab === 'orders' && !selectedOrder && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-[#111111]">Order History</h2>
              {orders.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-[#6B6B6B] mb-4">You have not placed any orders yet.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/shop')}
                    className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
                  >
                    Explore Collection
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-black/10">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-mono-tabular text-sm font-semibold text-[#111111]">
                          {order.orderNumber}
                        </p>
                        <p className="text-xs text-[#6B6B6B] mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item(s) ·{' '}
                          <span className="font-medium text-[#111111]">{order.status}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono-tabular text-sm font-semibold text-[#111111]">
                          {formatPrice(order.totalCents)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="px-4 py-2 border border-black/20 text-xs font-medium text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
                        >
                          Details &amp; Track
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'orders' && selectedOrder && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-black/10 pb-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="text-xs text-[#6B6B6B] hover:text-[#111111] underline mb-1 cursor-pointer"
                  >
                    &larr; Back to Orders
                  </button>
                  <h2 className="font-display text-xl font-bold text-[#111111]">
                    Order {selectedOrder.orderNumber}
                  </h2>
                </div>
                {selectedOrder.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => void handleCancelOrder(selectedOrder.orderNumber)}
                    className="px-4 py-2 border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50 cursor-pointer"
                  >
                    Cancel Order
                  </button>
                )}
              </div>

              {/* Order Tracking Timeline */}
              <div>
                <p className="text-xs uppercase tracking-wider text-[#6B6B6B] mb-3">
                  Tracking Number:{' '}
                  <span className="font-mono-tabular text-[#111111] font-semibold">
                    {selectedOrder.trackingNumber}
                  </span>
                </p>
                {selectedOrder.status === 'Cancelled' ? (
                  <div className="p-4 bg-red-50 border border-red-200 text-sm text-red-800 font-medium">
                    This order has been cancelled and stock has been restored.
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {ORDER_STAGES.map((stage, idx) => {
                      const currentIdx = ORDER_STAGES.indexOf(selectedOrder.status as any);
                      const reached = idx <= currentIdx;
                      return (
                        <div key={stage} className="space-y-2">
                          <div
                            className={`h-1.5 ${
                              reached ? 'bg-[#111111]' : 'bg-black/10'
                            }`}
                          />
                          <p
                            className={`text-[11px] font-medium ${
                              reached ? 'text-[#111111]' : 'text-[#888888]'
                            }`}
                          >
                            {stage}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="divide-y divide-black/8 border-t border-black/10">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="py-3 flex items-center gap-4">
                    <SmartImage
                      src={item.productImage}
                      alt={item.productName}
                      className="w-14 h-14 object-cover bg-[#F7F7F7]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#111111]">{item.productName}</p>
                      <p className="text-xs text-[#6B6B6B]">
                        Size {item.selectedSize} · {item.selectedColor} · Qty {item.quantity}
                      </p>
                    </div>
                    <span className="font-mono-tabular text-sm font-semibold text-[#111111]">
                      {formatPrice(item.lineTotalCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'profile' && (
            <form onSubmit={handleProfileSave} className="max-w-md space-y-4">
              <h2 className="font-display text-xl font-semibold text-[#111111]">My Profile</h2>
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">Email</label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full border border-black/10 bg-[#F7F7F7] px-3.5 py-2.5 text-sm text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
              >
                Save Changes
              </button>
            </form>
          )}

          {tab === 'wishlist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-[#111111]">Saved Wishlist</h2>
                <button
                  type="button"
                  onClick={() => navigate('/wishlist')}
                  className="text-xs font-medium underline cursor-pointer"
                >
                  Open Full Wishlist
                </button>
              </div>
              {wishlist.length === 0 ? (
                <p className="text-sm text-[#6B6B6B]">No saved pieces yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wishlist.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/product/${p.slug}`)}
                      className="flex items-center gap-3 p-3 border border-black/10 text-left hover:bg-[#F7F7F7] cursor-pointer"
                    >
                      <SmartImage
                        src={p.images[0]?.imageUrl}
                        alt={p.name}
                        className="w-16 h-16 object-cover bg-[#EFECE6]"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111111] truncate">{p.name}</p>
                        <p className="font-mono-tabular text-xs text-[#555555] mt-0.5">
                          {formatPrice(p.effectivePriceCents)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'addresses' && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold text-[#111111]">Saved Addresses</h2>
              {addresses.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((a) => (
                    <div key={a.id} className="p-4 border border-black/12 flex justify-between gap-3">
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-[#111111]">{a.label}</p>
                        <p className="text-[#333333]">{a.fullName}</p>
                        <p className="text-[#6B6B6B]">{a.streetAddress}</p>
                        <p className="text-[#6B6B6B]">
                          {a.city}, {a.postalCode}, {a.country}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAddress(a.id)}
                        aria-label="Delete address"
                        className="p-1 text-[#6B6B6B] hover:text-red-700 self-start cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddAddress} className="pt-4 border-t border-black/10 space-y-3 max-w-lg">
                <h3 className="text-sm font-semibold text-[#111111]">Add New Address</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Label (Home / Office)"
                    value={newAddr.label}
                    onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                    className="border border-black/20 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Country"
                    value={newAddr.country}
                    onChange={(e) => setNewAddr({ ...newAddr, country: e.target.value })}
                    className="border border-black/20 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="City"
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    className="border border-black/20 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Postal Code"
                    value={newAddr.postalCode}
                    onChange={(e) => setNewAddr({ ...newAddr, postalCode: e.target.value })}
                    className="border border-black/20 px-3 py-2 text-sm"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Complete Street Address"
                  value={newAddr.streetAddress}
                  onChange={(e) => setNewAddr({ ...newAddr, streetAddress: e.target.value })}
                  className="w-full border border-black/20 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Address
                </button>
              </form>
            </div>
          )}

          {tab === 'password' && (
            <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
              <h2 className="font-display text-xl font-semibold text-[#111111]">Change Password</h2>
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currPass}
                  onChange={(e) => setCurrPass(e.target.value)}
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1">
                  New Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={nextPass}
                  onChange={(e) => setNextPass(e.target.value)}
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
              >
                Update Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
