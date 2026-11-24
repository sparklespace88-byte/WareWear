import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';

const INFO_CONTENT: Record<
  string,
  { title: string; eyebrow: string; body: string[] }
> = {
  about: {
    eyebrow: 'The House',
    title: 'About WAREWEAR',
    body: [
      'WAREWEAR is an architectural fashion house guided by a single conviction: everyday garments should carry the quiet precision of tailored design.',
      'From 500gsm organic loopback fleece to Italian virgin wool and Japanese shuttle-loomed selvedge denim, every piece is constructed to endure seasons rather than cycles.',
      'Your Style. Your Identity. We design foundational silhouettes in obsidian, bone, and warm travertine tones that adapt effortlessly across environments.',
    ],
  },
  support: {
    eyebrow: 'Client Concierge',
    title: 'Customer Support',
    body: [
      'Our client concierge team assists with sizing consultations, order modifications, tracking inquiries, and garment care guidance Monday through Saturday.',
      'For immediate tracking updates, visit My Orders in your customer dashboard using your registered account.',
    ],
  },
  contact: {
    eyebrow: 'Atelier & Studios',
    title: 'Contact Us',
    body: [
      'Flagship Studio: 428 Mercer Street, New York, NY 10013.',
      'Direct Concierge: concierge@warewear.com · +1 (212) 555-0194.',
    ],
  },
  shipping: {
    eyebrow: 'Global Logistics',
    title: 'Shipping Policy',
    body: [
      'Orders are inspected, folded, and dispatched within 24 business hours. Complimentary express shipping applies automatically to orders exceeding $150.',
      'Orders below the complimentary threshold ship at a flat $12 express courier rate with full live tracking.',
    ],
  },
  returns: {
    eyebrow: 'Fit Guarantee',
    title: 'Return Policy',
    body: [
      'Unworn garments with original tags and packaging may be returned or exchanged within 30 days of delivery.',
      'Cash on Delivery and Bank Transfer orders are eligible for rapid store credit or direct bank refund upon atelier inspection.',
    ],
  },
  privacy: {
    eyebrow: 'Data Protection',
    title: 'Privacy Policy',
    body: [
      'WAREWEAR respects your privacy. Account credentials are protected with cryptographic scrypt hashing, and personal shipping details are used strictly to fulfill and track your orders.',
      'We never sell or distribute customer contact information to third parties.',
    ],
  },
  terms: {
    eyebrow: 'Legal Notice',
    title: 'Terms & Conditions',
    body: [
      'All catalog pricing, seasonal promotions, and coupon redemptions are verified server-side at checkout.',
      'Product inventory is reserved atomically upon order confirmation. Pending orders may be cancelled prior to courier dispatch.',
    ],
  },
};

export const InfoPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { navigate, showToast, settings } = useStore();
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const info = INFO_CONTENT[slug] ?? INFO_CONTENT.about;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
      <p className="text-xs uppercase tracking-[0.2em] text-[#6B6B6B] mb-2">{info.eyebrow}</p>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#111111] mb-6">
        {info.title}
      </h1>

      <div className="bg-white border border-black/10 p-7 sm:p-10 space-y-5 text-sm sm:text-base text-[#444444] leading-relaxed">
        {info.body.map((para, idx) => (
          <p key={idx}>{para}</p>
        ))}

        {(slug === 'contact' || slug === 'support') && (
          <div className="pt-6 border-t border-black/10">
            <p className="text-xs font-medium text-[#6B6B6B] mb-4">
              Concierge Email: {settings.support_email || 'concierge@warewear.com'} · Phone:{' '}
              {settings.support_phone || '+1 (212) 555-0194'}
            </p>
            {contactSubmitted ? (
              <p className="text-sm font-medium text-emerald-800">
                Message received. Our client concierge will respond shortly.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setContactSubmitted(true);
                  showToast('Inquiry sent to WAREWEAR Concierge.', 'success');
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
                <input
                  type="email"
                  required
                  placeholder="Your Email"
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
                <textarea
                  rows={3}
                  required
                  placeholder="How can our concierge assist you?"
                  className="w-full border border-black/20 px-3.5 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
                >
                  Send Message
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="text-sm font-medium text-[#111111] underline cursor-pointer"
        >
          &larr; Return to WAREWEAR Collection
        </button>
      </div>
    </div>
  );
};

export const NotFoundPage: React.FC = () => {
  const { navigate } = useStore();
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <p className="font-mono-tabular text-xs uppercase tracking-[0.22em] text-[#6B6B6B] mb-2">
        404 · Page Unavailable
      </p>
      <h1 className="font-display text-4xl font-bold text-[#111111] mb-3">
        Lost in the Archive
      </h1>
      <p className="text-sm text-[#6B6B6B] mb-8">
        The page you requested could not be located. Explore our current seasonal collection instead.
      </p>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="px-8 py-3.5 bg-[#111111] text-white text-sm font-semibold cursor-pointer"
      >
        Back to Homepage
      </button>
    </div>
  );
};
