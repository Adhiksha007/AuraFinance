import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Info } from 'lucide-react';
import WatchlistButton from './WatchlistButton';

interface RecommendationProps {
    ticker: string;
    company: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    prediction: string;
    explanation: string;
    confidence: number;
}

export default function RecommendationCard({ data, showWatchlistButton = true }: { data: RecommendationProps; showWatchlistButton?: boolean }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="group relative backdrop-blur-xl bg-card/40 border border-border/60 shadow-lg rounded-2xl p-6 overflow-hidden cursor-pointer"
            onClick={() => setExpanded(!expanded)}
        >
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold text-foreground">{data.ticker}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${data.action === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            data.action === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'
                            }`}>
                            {data.action}
                        </span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-2">{data.company}</p>

                    {showWatchlistButton && <WatchlistButton ticker={data.ticker} companyName={data.company} />}
                </div>
                <div className="text-right">
                    <p className="text-xl font-semibold text-foreground">${data.price.toFixed(2)}</p>
                    <p className={`text-sm flex items-center justify-end ${data.confidence > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {data.confidence}% Confidence
                    </p>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t border-border/50"
                    >
                        <div className="flex items-start gap-2 mb-2">
                            <Info className="w-4 h-4 text-primary mt-1" />
                            <h4 className="font-semibold text-foreground">AI Rationale</h4>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {data.explanation}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                animate={{ rotate: expanded ? 180 : 0 }}
                className="absolute bottom-4 right-4 text-muted-foreground/50 group-hover:text-foreground"
            >
                <ChevronDown className="w-5 h-5" />
            </motion.div>
        </motion.div >
    );
}
