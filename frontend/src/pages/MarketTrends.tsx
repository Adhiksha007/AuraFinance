import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Zap, AlertTriangle, X, Clock, Globe, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import apiClient from '../api/apiClient';

// Types
interface FrontendPayload {
    color_code: string;
    icon: string;
    simple_summary: string;
}

interface SummaryCard {
    label: string;
    region: string;
    status: string;
    indicator: string;
    description: string;
}

interface Signal {
    index: string;
    price: number;
    sma_50: number;
    health_score?: number;
    summary_card?: SummaryCard;
    // Legacy fields for fallback
    signal_label?: string;
    frontend_payload?: FrontendPayload;
}

interface Alert {
    ticker: string;
    name: string;
    message: string;
    severity: string;
}

interface IndexData {
    region: string;
    quick_fact: string;
    color: string;
    percent_change: number;
    current_price: number;
    indicator: string;
    technical: {
        sma50: number;
        health_score: number;
        signal: string;
    };
    chart_data: { time: string; value: number; price: number }[];
}

interface MarketData {
    indices: Record<string, IndexData> | { chartData: any[] }; // Fallback for old cache
    sentiment: {
        score: number;
        status: string;
        vix: number;
        frontend_payload?: FrontendPayload;
    };
    sectors: {
        name: string;
        change: number;
        ticker: string;
        frontend_payload?: FrontendPayload;
    }[];
    india_sectors?: {
        name: string;
        change: number;
        ticker: string;
        current_price: number;
        frontend_payload?: FrontendPayload;
    }[];
    signals?: Signal[];
    alerts?: Alert[];
    market_status?: {
        "New York": string;
        "London": string;
        "Tokyo": string;
        "global_is_open": boolean;
    };
    timestamp: number;
}

const MarketTrends = () => {
    const [data, setData] = useState<MarketData | null>(null);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connectError, setConnectError] = useState<string | null>(null);
    const [showAlerts, setShowAlerts] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState("S&P 500");

    const fetchData = useCallback(async () => {
        try {
            const response = await apiClient.get<MarketData>('/market-trends/');
            setData(response.data);
            setConnected(true);
            setLoading(false);
            setConnectError(null);
        } catch (error) {
            console.error('Error fetching market data:', error);
            setConnectError('Failed to load market data. Please make sure the backend is running.');
            setConnected(false);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="animate-pulse flex flex-col items-center">
                    <Activity className="w-12 h-12 text-primary mb-4" />
                    <span className="text-muted-foreground font-medium">Synced with Global Pulse...</span>
                </div>
            </div>
        );
    }

    if (connectError && !data) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="text-center p-8 bg-card rounded-2xl shadow-lg border border-destructive/30 max-w-md">
                    <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-foreground mb-2">Connection Error</h3>
                    <p className="text-muted-foreground mb-6">{connectError}</p>
                    <button
                        onClick={() => { setConnectError(null); setLoading(true); fetchData(); }}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    // Safety defaults
    const indicesRaw = data?.indices || {};
    // Determine if we have new format (dict) or old format (chartData array)
    // We want to transform it into an array of [name, data] for rendering
    let indicesArray: { name: string; data: IndexData }[] = [];

    if ('S&P 500' in indicesRaw) {
        // New Format
        indicesArray = Object.entries(indicesRaw).map(([name, val]) => ({
            name,
            data: val as IndexData
        }));
    } else {
        // Fallback for old format or empty
        indicesArray = [];
    }

    const sentiment = data?.sentiment || { score: 50, status: 'Neutral', vix: 0 };
    const sectors = data?.sectors || [];
    const indiaSectors = data?.india_sectors || [];
    const signals = data?.signals || [];
    const alerts = data?.alerts || [];
    const marketStatus = data?.market_status || { "New York": "CLOSED", "London": "CLOSED", "Tokyo": "CLOSED", "global_is_open": false };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transitionEnd: { transform: "none" } }}
            transition={{ duration: 0.5 }}
            className="p-8 min-h-screen bg-background text-foreground font-sans"
        >
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        Market Trends
                        {!marketStatus.global_is_open && (
                            <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" /> MARKETS CLOSED
                            </span>
                        )}
                    </h1>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> NY: <span className={marketStatus["New York"] === "OPEN" ? "text-primary font-bold" : ""}>{marketStatus["New York"]}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> LDN: <span className={marketStatus["London"] === "OPEN" ? "text-primary font-bold" : ""}>{marketStatus["London"]}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> TKY: <span className={marketStatus["Tokyo"] === "OPEN" ? "text-primary font-bold" : ""}>{marketStatus["Tokyo"]}</span>
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-card shadow-sm border border-border">
                    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
                    <span className="text-xs font-medium text-muted-foreground">
                        {connected ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
            </header>

            {/* Alerts Banner */}
            <AnimatePresence>
                {showAlerts && alerts.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-8 bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden"
                    >
                        <div className="p-2 bg-destructive/20 rounded-full text-destructive">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-destructive">Breaking Movements</h3>
                            <ul className="mt-1 space-y-1">
                                {alerts.map((alert, idx) => (
                                    <li key={idx} className="text-sm text-destructive font-medium">
                                        {alert.message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => setShowAlerts(false)}
                            className="p-1 hover:bg-black/5 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 text-destructive/60" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Single Chart + Selector */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {/* Selector Header - Moved Above Chart */}

                    {indicesArray.length > 0 ? (() => {
                        const selectedData = indicesArray.find(i => i.name === selectedIndex)?.data || indicesArray[0].data;
                        const keys = indicesArray.map(i => i.name);

                        // Ensure selectedIndex is valid
                        if (!keys.includes(selectedIndex) && keys.length > 0) setSelectedIndex(keys[0]);

                        return (
                            <motion.div
                                key={selectedIndex}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-card rounded-3xl p-8 shadow-sm border border-border flex-1 flex flex-col"
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <Globe className="w-5 h-5 text-muted-foreground" />
                                            <div className="relative">
                                                <select
                                                    value={selectedIndex}
                                                    onChange={(e) => setSelectedIndex(e.target.value)}
                                                    className="w-full bg-background border-none text-foreground text-xl font-bold rounded-lg py-2 pl-3 pr-10 appearance-none cursor-pointer hover:bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                >
                                                    {indicesArray.map(i => <option key={i.name} value={i.name} className="bg-background text-foreground">{i.name}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                            </div>
                                        </div>
                                        <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            {selectedData.region} • <span className="text-primary">{selectedData.quick_fact}</span>
                                        </div>
                                    </div>

                                    <div className={`text-right ${selectedData.percent_change >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                        <div className="text-4xl font-bold tracking-tight">{selectedData.current_price.toLocaleString()}</div>
                                        <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block mt-1 ${selectedData.percent_change >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                                            {selectedData.percent_change > 0 ? '+' : ''}{selectedData.percent_change}%
                                        </div>
                                    </div>
                                </div>

                                {/* Large Chart */}
                                <div className="flex-1 w-full min-h-[250px] mb-8">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={selectedData.chart_data}
                                            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                                        >
                                            <defs>
                                                <linearGradient id="chart-gradient-fill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={selectedData.color} stopOpacity={0.5} />
                                                    <stop offset="95%" stopColor={selectedData.color} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis
                                                dataKey="time"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                hide
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip
                                                cursor={{ stroke: selectedData.color, strokeWidth: 1, strokeDasharray: '4 4' }}
                                                contentStyle={{
                                                    borderRadius: '16px',
                                                    border: '1px solid hsl(var(--border))',
                                                    boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.2)',
                                                    backgroundColor: 'hsl(var(--background))',
                                                    color: 'hsl(var(--foreground))',
                                                    padding: '12px'
                                                }}
                                                itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                                                formatter={(_value: any, _name: any, props: any) => [`$${props.payload.price}`, 'Price']}
                                                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke={selectedData.color}
                                                strokeWidth={3}
                                                fill="url(#chart-gradient-fill)"
                                                activeDot={{ r: 6, fill: selectedData.color, stroke: 'hsl(var(--background))', strokeWidth: 4 }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Detailed Technical Data Section (Below Chart) */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-border/50">
                                    <div className="bg-secondary/30 p-4 rounded-2xl border border-secondary">
                                        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Trend Signal</p>
                                        <p className={`font-bold flex items-center gap-1.5 ${selectedData.technical?.signal === 'Bullish' ? 'text-green-500' : 'text-red-500'}`}>
                                            {selectedData.indicator} {selectedData.technical?.signal || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="bg-secondary/30 p-4 rounded-2xl border border-secondary">
                                        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">50-Day SMA</p>
                                        <p className="font-bold text-foreground">
                                            {selectedData.technical?.sma50?.toLocaleString() || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="bg-secondary/30 p-4 rounded-2xl border border-secondary">
                                        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Health Score</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${selectedData.technical?.health_score >= 8 ? 'bg-green-500' : selectedData.technical?.health_score >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                    style={{ width: `${(selectedData.technical?.health_score || 0) * 10}%` }}
                                                />
                                            </div>
                                            <span className="font-bold text-sm">{selectedData.technical?.health_score}/10</span>
                                        </div>
                                    </div>
                                    <div className="bg-secondary/30 p-4 rounded-2xl border border-secondary">
                                        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Region</p>
                                        <p className="font-bold text-foreground truncate">{selectedData.region}</p>
                                    </div>
                                </div>

                            </motion.div>
                        );
                    })() : (
                        <div className="h-full flex items-center justify-center p-12 bg-card rounded-2xl border border-dashed border-border">
                            <p className="text-muted-foreground">Loading Market Indices...</p>
                        </div>
                    )}
                </div>

                {/* Sentiment Gauge (Right Column) */}
                <div className="bg-card rounded-3xl p-6 shadow-sm border border-border flex flex-col items-center justify-center relative bg-gradient-to-b from-card to-secondary/10">
                    <h3 className="font-semibold text-lg absolute top-6 left-6 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        Market Mood
                    </h3>

                    <div className="relative mt-8">
                        <svg viewBox="0 0 200 110" className="w-64 h-36">
                            <defs>
                                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="hsl(var(--destructive))" />
                                    <stop offset="50%" stopColor="#eab308" />
                                    <stop offset="100%" stopColor="hsl(var(--primary))" />
                                </linearGradient>
                            </defs>
                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" className="text-border stroke-current dark:text-gray-700" />
                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGradient)" strokeWidth="12" strokeLinecap="round" />
                        </svg>

                        <motion.div
                            className="absolute bottom-[13px] left-1/2 w-1 h-24 bg-foreground origin-bottom rounded-full"
                            style={{ x: '-50%' }}
                            initial={{ rotate: -90 }}
                            animate={{ rotate: -90 + (sentiment.score / 100) * 180 }}
                            transition={{ type: "spring", stiffness: 60, damping: 15 }}
                        >
                            <div className="absolute -top-1 -left-1.5 w-4 h-4 rounded-full bg-card border-4 border-foreground"></div>
                        </motion.div>
                    </div>

                    <div className="text-center mt-[-10px] space-y-2">
                        <motion.div
                            key={sentiment.score}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-5xl font-extrabold tracking-tighter"
                            style={{ color: sentiment.frontend_payload?.color_code }}
                        >
                            {sentiment.score}
                        </motion.div>
                        <p className="text-lg font-bold flex items-center justify-center gap-2" style={{ color: sentiment.frontend_payload?.color_code }}>
                            {sentiment.frontend_payload?.icon} {sentiment.status}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-[200px] mx-auto px-4 py-2 bg-secondary/50 rounded-lg">
                            {sentiment.frontend_payload?.simple_summary || `VIX: ${sentiment.vix}`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Smart Momentum Signals */}
            {signals.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        Smart Momentum Signals
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {signals.map((signal, _) => (
                            <motion.div
                                key={signal.index}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5 }}
                                whileHover={{ scale: 1.02, y: -5 }}
                                className="bg-card p-5 rounded-2xl border border-border shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-lg hover:border-primary/20 transition-all group"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-5 font-bold text-7xl select-none text-muted-foreground/50 transition-opacity group-hover:opacity-10">
                                    {signal.health_score}
                                </div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="bg-secondary/40 p-1.5 rounded-lg">
                                            <h4 className="font-bold text-lg leading-none">{signal.summary_card?.label || signal.index}</h4>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${signal.summary_card?.status === 'OPEN' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            {signal.summary_card?.status || (marketStatus?.global_is_open ? 'OPEN' : 'CLOSED')}
                                        </div>
                                    </div>

                                    <div className="flex items-baseline gap-2 mb-4">
                                        <span className="text-3xl font-bold tracking-tight">${signal.price.toLocaleString()}</span>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-xs mb-1.5 font-medium text-muted-foreground">
                                                <span>Health Score</span>
                                                <span className={`${(signal.health_score || 0) >= 7 ? 'text-primary' : 'text-foreground'}`}>{signal.health_score || 5}/10</span>
                                            </div>
                                            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${(signal.health_score || 5) >= 8 ? 'bg-primary' : (signal.health_score || 5) >= 5 ? 'bg-yellow-500' : 'bg-destructive'}`}
                                                    style={{ width: `${(signal.health_score || 5) * 10}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-3 bg-secondary/30 rounded-xl border border-secondary group-hover:bg-secondary/50 transition-colors">
                                            <p className="font-bold text-sm mb-0.5 flex items-center gap-1.5">
                                                {signal.summary_card?.indicator || signal.signal_label}
                                            </p>
                                            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                                                {signal.summary_card?.description || signal.frontend_payload?.simple_summary || 'Analyzing trend...'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sector Section (Global + India) */}
            <div className="space-y-8 mb-6">
                {/* Global Sectors */}
                <div>
                    <h3 className="text-xl font-bold mb-4">Global Sector Performance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sectors.map((sector, _) => (
                            <motion.div
                                key={sector.name}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5 }}
                                whileHover={{ scale: 1.02, y: -5 }}
                                className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-default"
                            >
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-lg truncate max-w-[180px] text-foreground">{sector.name}</h4>
                                    </div>
                                    <span className="text-[11px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded w-fit">{sector.ticker}</span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <div className={`font-bold text-xl ${sector.change >= 0 ? 'text-green-500' : 'text-red-500'} flex items-center gap-1`}>
                                        {sector.change >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                        {Math.abs(sector.change)}%
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Indian Sectors */}
                <div>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-orange-500">🇮🇳</span> India Sector Performance
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {indiaSectors.map((sector, _) => (
                            <motion.div
                                key={sector.name}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5 }}
                                whileHover={{ scale: 1.02, y: -5 }}
                                className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-default"
                            >
                                <div className="flex flex-col">
                                    <h4 className="font-bold text-lg truncate max-w-[180px] text-foreground">{sector.name}</h4>
                                    <span className="text-[11px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded w-fit mb-1">{sector.ticker}</span>
                                    <span className="text-xs font-semibold text-muted-foreground">Price: ₹{sector.current_price.toLocaleString()}</span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <div className={`font-bold text-xl ${sector.change >= 0 ? 'text-green-500' : 'text-red-500'} flex items-center gap-1`}>
                                        {sector.change >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                        {Math.abs(sector.change)}%
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    {indiaSectors.length === 0 && (
                        <div className="p-12 bg-card rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground opacity-70">
                            <Activity className="w-8 h-8 mb-2" />
                            <p>Loading Indian Market Data...</p>
                        </div>
                    )}
                </div>
            </div>

        </motion.div>
    );
};

export default MarketTrends;
