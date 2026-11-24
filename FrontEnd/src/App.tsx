import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { CartDrawer } from './components/CartDrawer';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/ToastContainer';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import { AuthPage } from './pages/AuthPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { InfoPage, NotFoundPage } from './pages/InfoPage';

const AppRouter: React.FC = () => {
  const { currentPath } = useStore();
  const pathname = currentPath.split('?')[0];

  if (pathname === '/' || pathname === '') {
    return <HomePage />;
  }
  if (pathname === '/shop') {
    return <ShopPage />;
  }
  if (pathname.startsWith('/product/')) {
    const slug = decodeURIComponent(pathname.slice('/product/'.length));
    return <ProductDetailPage slug={slug} />;
  }
  if (pathname === '/wishlist') {
    return <WishlistPage />;
  }
  if (pathname === '/auth') {
    return <AuthPage />;
  }
  if (pathname === '/checkout') {
    return <CheckoutPage />;
  }
  if (pathname === '/account') {
    return <AccountPage />;
  }
  if (pathname === '/admin') {
    return <AdminPage />;
  }
  if (pathname.startsWith('/info/')) {
    const slug = decodeURIComponent(pathname.slice('/info/'.length));
    return <InfoPage slug={slug} />;
  }

  return <NotFoundPage />;
};

const AppShell: React.FC = () => {
  const { currentPath } = useStore();
  const pathname = currentPath.split('?')[0];
  const isBackendRoute = pathname === '/admin';

  useEffect(() => {
    const link = document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (link) {
      link.href = isBackendRoute ? '/favicon-admin.svg' : '/favicon-store.svg';
    }
    document.title = isBackendRoute
      ? 'WAREWEAR · Backend Dashboard'
      : 'WAREWEAR — Your Style. Your Identity.';
  }, [isBackendRoute]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F7] text-[#333333]">
      {!isBackendRoute && <Navbar />}
      <main className="flex-1">
        <AppRouter />
      </main>
      {!isBackendRoute && <Footer />}
      {!isBackendRoute && <CartDrawer />}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
