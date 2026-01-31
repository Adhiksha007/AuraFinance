
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/auth/Auth';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
// import Portfolio from './pages/Portfolio';
import StockPicks from './pages/StockPicks';
import News from './pages/News';
import Watchlist from './pages/Watchlist';
import PlaceholderPage from './pages/PlaceholderPage';
import MarketTrends from './pages/MarketTrends';
import Layout from './components/layout/Layout';
import { useAuthStore } from './state/authStore';
import { useWatchlistStore } from './state/watchlistStore';
import { useSettingsStore } from './state/useSettingsStore';
import { useEffect } from 'react';
import Settings from './pages/Settings';
import GoalPlanner from './pages/GoalPlanner';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  const fetchWatchlist = useWatchlistStore((state) => state.fetchWatchlist);
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);

  useEffect(() => {
    if (token) {
      fetchWatchlist();
      fetchSettings();
    }
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  const settings = useSettingsStore((state) => state.settings);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    // Only apply dark mode if user is logged in AND has selected dark theme
    if (token && settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme, token]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={token ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login" element={<Auth />} />

        {/* Protected App Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/portfolio" element={<PlaceholderPage title="Portfolio" />} />
                  <Route path="/stock-picks" element={<StockPicks />} />
                  <Route path="/news" element={<News />} />
                  <Route path="/market-trends" element={<MarketTrends />} />
                  <Route path="/financial-aid" element={<PlaceholderPage title="Aid & Debt" />} />
                  <Route path="/goals" element={<GoalPlanner />} />
                  <Route path="/watchlist" element={<Watchlist />} />
                  <Route path="/settings" element={<Settings />} />
                  {/* Default catch-all within app redirects to dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
