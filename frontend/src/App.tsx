import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import HomePage from './pages/HomePage';
import StorePage from './pages/StorePage';
import ProductPage from './pages/ProductPage';
import ComingSoonPage from './pages/ComingSoonPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="store" element={<StorePage />} />
        <Route path="product/:slug" element={<ProductPage />} />

        {/* Delivered in the next step: cart review, auth forms, checkout & key reveal. */}
        <Route path="cart" element={<ComingSoonPage title="Your cart" description="The cart review and checkout screen arrives in the next step. Items you add are already saved." />} />
        <Route path="login" element={<ComingSoonPage title="Sign in / Register" description="The authentication forms arrive in the next step." />} />
        <Route path="orders" element={<ComingSoonPage title="My orders" description="Order history and revealed license keys arrive in the next step." />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
