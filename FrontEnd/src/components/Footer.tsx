import React, { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';

export const Footer: React.FC = () => {
  const { navigate, settings, showToast } = useStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      showToast(res.message, 'success');
      setEmail('');
    } catch (err: any) {
      showToast(err.message || 'Could not subscribe.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#111111] text-white mt-20">
      {/* Newsletter Band */}
      <div className="border-b border-white/12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-14 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#D6C3A5] mb-2">
              Private Dispatch
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">
              Receive early access to seasonal capsule releases.
            </h2>
          </div>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              aria-label="Email address for newsletter"
              className="flex-1 bg-white/8 border border-white/20 px-4 py-3.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-[#D6C3A5]"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3.5 bg-[#D6C3A5] text-[#111111] text-sm font-semibold tracking-wide hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {submitting ? 'Joining...' : 'Subscribe'}
            </button>
          </form>
        </div>
      </div>

      {/* Main Footer Columns */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <span className="font-display text-xl font-bold tracking-[0.18em] text-white">
            WAREWEAR
          </span>
          <p className="mt-3 text-sm text-white/65 leading-relaxed max-w-xs">
            {settings.tagline || 'YOUR STYLE. YOUR IDENTITY.'} Architectural essentials and contemporary tailoring crafted for modern wardrobes.
          </p>
          <p className="mt-4 text-xs text-white/50">
            {settings.support_email || 'concierge@warewear.com'}
            <br />
            {settings.support_phone || '+1 (212) 555-0194'}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D6C3A5] mb-4">
            Collections
          </h3>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <button type="button" onClick={() => navigate('/shop?gender=men')} className="hover:text-white cursor-pointer">
                Men&apos;s Edit
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/shop?gender=women')} className="hover:text-white cursor-pointer">
                Women&apos;s Edit
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/shop?gender=unisex')} className="hover:text-white cursor-pointer">
                Unisex Core
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/shop?newArrival=true')} className="hover:text-white cursor-pointer">
                New Arrivals
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/shop?sale=true')} className="hover:text-white cursor-pointer">
                Archive Sale
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D6C3A5] mb-4">
            Client Care
          </h3>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <button type="button" onClick={() => navigate('/info/about')} className="hover:text-white cursor-pointer">
                About WareWear
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/support')} className="hover:text-white cursor-pointer">
                Customer Support
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/contact')} className="hover:text-white cursor-pointer">
                Contact Us
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/shipping')} className="hover:text-white cursor-pointer">
                Shipping Policy
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/returns')} className="hover:text-white cursor-pointer">
                Return Policy
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D6C3A5] mb-4">
            Legal &amp; Studio
          </h3>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <button type="button" onClick={() => navigate('/info/privacy')} className="hover:text-white cursor-pointer">
                Privacy Policy
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/terms')} className="hover:text-white cursor-pointer">
                Terms &amp; Conditions
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/account')} className="hover:text-white cursor-pointer">
                Track My Order
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/55">
          <div className="flex flex-wrap items-center gap-4">
            <span>© {new Date().getFullYear()} WAREWEAR. All rights reserved.</span>
            <span>Instagram</span>
            <span>Pinterest</span>
            <span>X / Editorial</span>
          </div>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
