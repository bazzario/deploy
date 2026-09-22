import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import UsedItems from "./pages/UsedItems";
import UsedItemDetail from "./pages/UsedItemDetail";
import Automobiles from "./pages/Automobiles";
import AutomobileDetail from "./pages/AutomobileDetail";
import Checkout from "./pages/Checkout";
import Wishlist from "./pages/Wishlist";
import Sell from "./pages/Sell";
import SellProduct from "./pages/SellProduct";
import SellUsedItem from "./pages/SellUsedItem";
import SellVehicle from "./pages/SellVehicle";
import Auth from "./pages/Auth";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Seller from "./pages/Seller";
import SellerRenew from "./pages/SellerRenew";
import SellerOrderDetail from "./pages/SellerOrderDetail";
import AdminLogin from "./admin/pages/AdminLogin";
import AdminLayout from "./admin/AdminLayout";
import AdminGuard from "./admin/AdminGuard";
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminProducts from "./admin/pages/AdminProducts";
import AdminListings from "./admin/pages/AdminListings";
import AdminOrders from "./admin/pages/AdminOrders";
import AdminDelivery from "./admin/pages/AdminDelivery";
import AdminReports from "./admin/pages/AdminReports";
import AdminAnalytics from "./admin/pages/AdminAnalytics";
import AdminSettings from "./admin/pages/AdminSettings";
import Search from "./pages/Search";
import { Contact, Returns, Payments, Privacy, Terms, Cookies } from "./pages/Policies";
import NotFound from "./pages/NotFound";
import { AppStoreProvider } from "./store/AppStore";
import { ListingsProvider } from "./store/ListingsStore";
import { AuthProvider } from "./store/AuthStore";
import { SellerPlanProvider } from "./store/SellerPlanStore";
import { OrdersProvider } from "./store/OrdersStore";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * The new /admin/* dashboard suite (login, dashboard, users, ...) brings its
 * own sidebar + header (see src/admin/AdminLayout.tsx), so the public site's
 * Header/Footer/BottomNav are hidden for those routes only. The original
 * standalone "/admin" page (src/pages/Admin.tsx) is untouched and still
 * renders inside the normal public layout, exactly as before.
 */
function isAdminSuiteRoute(pathname: string): boolean {
  return pathname.startsWith("/admin/");
}

function AppShell() {
  const { pathname } = useLocation();
  const hidePublicChrome = isAdminSuiteRoute(pathname);

  return (
    <div className="min-h-screen flex flex-col">
      {!hidePublicChrome && <Header />}
      <main className={hidePublicChrome ? "flex-1" : "flex-1 pb-16 lg:pb-0"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/used-items" element={<UsedItems />} />
          <Route path="/used-items/:id" element={<UsedItemDetail />} />
          <Route path="/automobiles" element={<Automobiles />} />
          <Route path="/automobiles/:id" element={<AutomobileDetail />} />
          <Route path="/search" element={<Search />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/sell/product" element={<SellProduct />} />
          <Route path="/sell/used-item" element={<SellUsedItem />} />
          <Route path="/sell/vehicle" element={<SellVehicle />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/seller" element={<Seller />} />
          <Route path="/seller/renew" element={<SellerRenew />} />
          <Route path="/seller/orders/:id" element={<SellerOrderDetail />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

          {/* --- Admin dashboard suite --- */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminGuard><AdminLayout title="Dashboard">
                <AdminDashboard />
              </AdminLayout></AdminGuard>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminGuard><AdminLayout title="Users">
                <AdminUsers />
              </AdminLayout></AdminGuard>
            }
          />
          <Route
            path="/admin/products"
            element={
              <AdminGuard><AdminLayout title="Products">
                <AdminProducts />
              </AdminLayout></AdminGuard>
            }
          />
          <Route
            path="/admin/listings"
            element={
              <AdminGuard><AdminLayout title="Listings">
                <AdminListings />
              </AdminLayout></AdminGuard>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <AdminGuard><AdminLayout title="Orders">
                <AdminOrders />
              </AdminLayout></AdminGuard>
            }
          />
          <Route
            path="/admin/delivery"
            element={
              <AdminGuard><AdminLayout title="Delivery">
                <AdminDelivery />
              </AdminLayout></AdminGuard>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminGuard><AdminLayout title="Reports">
                <AdminReports />
              </AdminLayout></AdminGuard>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminGuard><AdminLayout title="Analytics">
                <AdminAnalytics />
              </AdminLayout></AdminGuard>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminGuard><AdminLayout title="Settings">
                <AdminSettings />
              </AdminLayout></AdminGuard>
            }
          />
          {/* Any other /admin/* URL also goes through the guard (admins land on
              the dashboard, everyone else on /admin/login) instead of a bare 404. */}
          <Route
            path="/admin/*"
            element={
              <AdminGuard>
                <Navigate to="/admin/dashboard" replace />
              </AdminGuard>
            }
          />
          {/* --------------------------------------------------------------- */}

          <Route path="/contact" element={<Contact />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!hidePublicChrome && <Footer />}
      {!hidePublicChrome && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SellerPlanProvider>
        <ListingsProvider>
          <AppStoreProvider>
            <OrdersProvider>
              <BrowserRouter>
                <ScrollToTop />
                <AppShell />
              </BrowserRouter>
            </OrdersProvider>
          </AppStoreProvider>
        </ListingsProvider>
      </SellerPlanProvider>
    </AuthProvider>
  );
}
