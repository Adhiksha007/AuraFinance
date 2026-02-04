import {
    Home,
    Briefcase,
    Sparkles,
    TrendingUp,
    Target,
    Newspaper,
    Star,
    Zap
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const menuItems = [
    {
        section: "Overview",
        items: [
            { name: "Dashboard", icon: Home, path: "/dashboard" },
            { name: "Portfolio", icon: Briefcase, path: "/portfolio" }
        ]
    },
    {
        section: "AI Insights",
        items: [
            { name: "Stock Picks", icon: Sparkles, path: "/stock-picks" },
            { name: "Market Trends", icon: TrendingUp, path: "/market-trends" }
        ]
    },
    {
        section: "Optimization",
        items: [
            { name: "Comparison", icon: Zap, path: "/comparison" },
            { name: "Goal Planner", icon: Target, path: "/goals" }
        ]
    },
    {
        section: "Research",
        items: [
            { name: "Smart News", icon: Newspaper, path: "/news" },
            { name: "Watchlist", icon: Star, path: "/watchlist" }
        ]
    }
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();

    // Mobile Overlay
    const overlay = (
        <div
            className={`fixed inset-0 bg-black/50 z-40 min-[650px]:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        />
    );

    return (
        <>
            {overlay}
            <aside
                className={`
                    fixed left-0 top-0 h-screen z-50 bg-card/70 backdrop-blur-md border-r border-border flex flex-col py-6 px-4 transition-all duration-300 ease-in-out
                    w-64
                    min-[650px]:w-20 min-[1100px]:w-64
                    rounded-r-2xl
                    ${isOpen ? 'translate-x-0' : '-translate-x-full min-[650px]:translate-x-0'}
                `}
            >
                {/* Logo Area */}
                <div className="flex-shrink-0 px-2 mb-8 flex items-center">
                    <div className="w-8 h-8 bg-background/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-6 h-6 tracking-tight text-foreground"
                        >
                            {/* Large Star */}
                            <motion.path
                                d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"
                                animate={{
                                    y: [0, -3, 0, -3, 0, -3, 0, 0],
                                    rotate: [0, 0, 0, 0, 0, 0, 0, 360],
                                    scale: [1, 1.1, 1, 1.1, 1, 1.1, 1, 1]
                                }}
                                transition={{
                                    duration: 6,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    times: [0, 0.083, 0.166, 0.25, 0.333, 0.416, 0.5, 1],
                                    delay: 0.1
                                }}
                                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                                fill="currentColor"
                                stroke="none"
                            />
                            {/* Top Right Small Sparkle */}
                            <motion.path
                                d="M19 2L20 5L23 6L20 7L19 10L18 7L15 6L18 5Z"
                                animate={{
                                    y: [0, -3, 0, -3, 0, -3, 0, 0],
                                    rotate: [0, 0, 0, 0, 0, 0, 0, 360],
                                    scale: [1, 1.2, 1, 1.2, 1, 1.2, 1, 1]
                                }}
                                transition={{
                                    duration: 6,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    times: [0, 0.083, 0.166, 0.25, 0.333, 0.416, 0.5, 1],
                                    delay: 0.15
                                }}
                                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                                fill="currentColor"
                                stroke="none"
                            />
                            {/* Bottom Left Small Sparkle */}
                            <motion.path
                                d="M5 16L6 19L9 20L6 21L5 24L4 21L1 20L4 19Z"
                                animate={{
                                    y: [0, -3, 0, -3, 0, -3, 0, 0],
                                    rotate: [0, 0, 0, 0, 0, 0, 0, 360],
                                    scale: [1, 1.2, 1, 1.2, 1, 1.2, 1, 1]
                                }}
                                transition={{
                                    duration: 6,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    times: [0, 0.083, 0.166, 0.25, 0.333, 0.416, 0.5, 1],
                                    delay: 0.2
                                }}
                                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                                fill="currentColor"
                                stroke="none"
                            />
                        </svg>
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-foreground min-[650px]:hidden min-[1100px]:block whitespace-nowrap">
                        Aura<span className="font-serif italic text-emerald-600">Finance</span>
                    </span>
                </div>

                {/* Navigation Links - Scrollable */}
                <nav className="flex-1 overflow-y-auto min-[650px]:overflow-visible min-[1100px]:overflow-y-auto space-y-6 px-2 no-scrollbar">
                    {menuItems.map((group) => (
                        <div key={group.section}>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 min-[650px]:hidden min-[1100px]:block">
                                {group.section}
                            </h3>
                            {/* Separator for tablet collapsed mode */}
                            <div className="hidden min-[650px]:block min-[1100px]:hidden h-px bg-border my-2 mx-2"></div>

                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <button
                                            key={item.name}
                                            onClick={() => {
                                                navigate(item.path);
                                                onClose(); // Close on mobile navigation
                                            }}
                                            className={`
                                                relative group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ease-out cursor-pointer
                                                justify-start min-[650px]:justify-center min-[1100px]:justify-start
                                                hover:z-10
                                                ${isActive ? 'text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}
                                            `}
                                        >
                                            {/* Active Background Pill (Framer Motion) */}
                                            {isActive && (
                                                <motion.div
                                                    layoutId="activeTab"
                                                    className="absolute inset-0 bg-primary rounded-lg -z-10"
                                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                />
                                            )}

                                            {/* Icon with scale effect */}
                                            <Icon className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 min-[650px]:group-hover:scale-125 min-[1100px]:group-hover:scale-100 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />

                                            <span className="min-[650px]:hidden min-[1100px]:block whitespace-nowrap relative z-0">
                                                {item.name}
                                            </span>

                                            {/* Tooltip for collapsed tablet view */}
                                            <div className="absolute left-full ml-4 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 hidden min-[650px]:block min-[1100px]:hidden pointer-events-none whitespace-nowrap z-50 shadow-xl transition-all duration-200 translate-x-2 group-hover:translate-x-0 border border-border">
                                                {item.name}
                                                {/* Little arrow pointing left */}
                                                <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-popover"></div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>
        </>
    );
}
