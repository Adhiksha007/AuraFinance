import { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import RecommendationCard from '../components/RecommendationCard';
import apiClient from '../api/apiClient';
import { useSearchParams } from 'react-router-dom';

import WatchlistButton from '../components/WatchlistButton';

export default function Dashboard() {
    const [searchParams] = useSearchParams();
    const ticker = searchParams.get('ticker') || 'SPY';

    const [chartData, setChartData] = useState([]);
    const [topRecommendations, setTopRecommendations] = useState([]);
    const [searchedRecommendation, setSearchedRecommendation] = useState<any>(null);
    const [news, setNews] = useState([]);
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastTicker, setLastTicker] = useState(ticker);

    // Render-time check to reset state immediately when ticker changes
    // This prevents stale data from being shown while useEffect triggers
    if (ticker !== lastTicker) {
        setLastTicker(ticker);
        setLoading(true);
        setChartData([]);
        setTopRecommendations([]);
        setSearchedRecommendation(null);
        setNews([]);
        setSummary([]);
    }

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            // Only set loading if not already handled by render-time check
            // setLoading(true); 

            try {
                const isMarket = ticker === 'SPY';

                const requests = [
                    apiClient.get(`/market/chart/${ticker}`),
                    apiClient.get(`/market/news?tickers=${ticker}&timeout=1&limit=5`).catch(() => ({ data: [] }))
                ];

                if (isMarket) {
                    requests.push(apiClient.get('/recommendations/top'));
                } else {
                    requests.push(apiClient.get(`/recommendations/${ticker}`));
                    requests.push(apiClient.get(`/market/summary/${ticker}`));
                }

                const responses = await Promise.all(requests);

                if (!isMounted) return;

                const chartRes = responses[0];
                const newsRes = responses[1];
                const recRes = responses[2];
                // For non-SPY, summary is index 3
                const summaryRes = isMarket ? null : responses[3];

                setChartData(chartRes.data);
                setNews(newsRes.data);

                if (isMarket) {
                    setTopRecommendations(recRes.data);
                    setSearchedRecommendation(null);
                    setSummary([]);
                } else {
                    setSearchedRecommendation(recRes.data);
                    setTopRecommendations([]);
                    setSummary(summaryRes?.data || []);
                }

            } catch (error) {
                if (isMounted) console.error("Error fetching dashboard data:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [ticker]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-2">
            <header className="mb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-foreground tracking-tight">{ticker} Overview</h1>
                    <p className="text-muted-foreground mt-2">Real-time analysis and insights.</p>
                </div>
                {ticker !== 'SPY' && <WatchlistButton ticker={ticker} />}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column (Left) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* 1. Price Trend Chart (Top Left) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card rounded-3xl shadow-sm p-8 border border-border/50"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-foreground">Price Trend</h2>
                            <span className="text-green-600 font-semibold bg-green-50 px-3 py-1 rounded-full dark:bg-green-900/30 dark:text-green-400">Live</span>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(str) => str.slice(5)} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* 2. Fundamentals (Bottom Left) - Only if not SPY */}
                    {ticker !== 'SPY' && summary.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -5 }}
                            className="bg-card rounded-3xl shadow-sm p-8 border border-border/50"
                        >
                            <h2 className="text-2xl font-bold text-foreground mb-6">Market Summary</h2>
                            <div className="grid grid-cols-1 min-[320px]:grid-cols-2 min-[425px]:grid-cols-3 md:grid-cols-4 gap-6">
                                {summary.map((row: any, idx: number) => (
                                    <div key={idx} className="flex flex-col gap-1 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                                        <span className="text-sm font-medium text-muted-foreground">{row.Attribute}</span>
                                        <span className="text-sm font-semibold text-foreground font-mono tracking-tight">{row.Value || "N/A"}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Side Column (Right) */}
                <div className="space-y-6">

                    {/* 3. Analysis (Top Right) */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground pl-2">
                            {ticker === 'SPY' ? 'Top Picks' : 'AI Analysis'}
                        </h2>
                        {ticker === 'SPY' ? (
                            topRecommendations.map((rec: any, index) => (
                                <motion.div
                                    key={rec.ticker}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    whileHover={{ y: -5 }}
                                >
                                    <RecommendationCard data={{
                                        ticker: rec.ticker,
                                        company: rec.ticker,
                                        action: rec.sentiment === "Bullish" ? "BUY" : (rec.sentiment === "Bearish" ? "SELL" : "HOLD"),
                                        price: rec.price,
                                        prediction: rec.sentiment,
                                        explanation: rec.ai_rationale,
                                        confidence: Math.round(rec.momentum_score * 100)
                                    }} />
                                </motion.div>
                            ))
                        ) : (
                            searchedRecommendation && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    <RecommendationCard
                                        data={{
                                            ticker: searchedRecommendation.ticker,
                                            company: searchedRecommendation.ticker,
                                            action: searchedRecommendation.sentiment === "Bullish" ? "BUY" : (searchedRecommendation.sentiment === "Bearish" ? "SELL" : "HOLD"),
                                            price: searchedRecommendation.price,
                                            prediction: searchedRecommendation.sentiment,
                                            explanation: searchedRecommendation.ai_rationale,
                                            confidence: Math.round(searchedRecommendation.momentum_score * 100)
                                        }}
                                        showWatchlistButton={false}
                                    />
                                </motion.div>
                            )
                        )}
                    </div>

                    {/* 4. News (Bottom Right) */}
                    <div className="space-y-4 pt-4">
                        <h2 className="text-2xl font-bold text-foreground pl-2">Latest News</h2>
                        {news.length > 0 ? (
                            news.slice(0, 5).map((article: any, idx: number) => (
                                <motion.a
                                    key={idx}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    whileHover={{ y: -5 }}
                                    href={article.Link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block p-4 bg-card rounded-xl border border-border hover:shadow-md transition-all hover:bg-accent/40"
                                >
                                    <h4 className="font-bold text-sm text-foreground mb-1 line-clamp-2">{article.Title}</h4>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">{article.Ticker}</span>
                                        <p className="text-xs text-muted-foreground">{article.Date}</p>
                                    </div>
                                </motion.a>
                            ))
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground">No news available.</div>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
}
