import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiClient from '../api/apiClient';

export default function News() {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const response = await apiClient.get('/market/news?tickers=SPY&tickers=AAPL&tickers=MSFT&tickers=NVDA&timeout=2&limit=10');
                setNews(response.data);
            } catch (error) {
                console.error("Error fetching news:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    if (loading) {
        return <div className="p-12 text-center text-muted-foreground">Loading Smart News...</div>;
    }

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-foreground">Smart News</h1>
                <p className="text-muted-foreground mt-2">Personalized financial updates.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {news.map((article: any, idx: number) => (
                    <motion.a
                        key={`${article.Ticker}-${idx}`}
                        href={article.Link}
                        layout
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ delay: idx * 0.07 }}
                        className="block bg-card p-6 rounded-2xl shadow-sm border border-border/50 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:bg-accent/40"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className="bg-primary/10 text-primary text-md font-semibold px-2.5 py-0.5 rounded-full">{article.Ticker}</span>
                            <span className="text-muted-foreground text-xs">{article.Date}</span>
                        </div>
                        <p className="text-lg font-bold text-foreground mb-2 line-clamp-4">{article.Title}</p>
                    </motion.a>
                ))}
            </div>
        </div>
    );
}
