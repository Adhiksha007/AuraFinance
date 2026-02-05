import { useState, useEffect, useRef } from 'react';
import { Search, Settings, LogOut, User, Menu, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import { useNavigationStore } from '../../state/navigationStore';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../api/apiClient';

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const searchRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const { lastVisitedPath, setLastVisitedPath } = useNavigationStore();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // ... (logic remains same, just need to update component signature and add button)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length >= 1) {
                try {
                    const response = await apiClient.get(`/market/search?q=${searchTerm}`);
                    setSuggestions(response.data);
                    setShowSuggestions(true);
                } catch (error) {
                    console.error("Search error:", error);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setSelectedIndex(-1);
    }, [suggestions]);

    // Clear search on location change (navigation) AND track history
    useEffect(() => {
        setSearchTerm('');
        setShowSuggestions(false);
        setIsUserMenuOpen(false);

        // Track last visited path (ignore settings page itself)
        if (location.pathname !== '/settings') {
            setLastVisitedPath(location.pathname + location.search);
        }
    }, [location, setLastVisitedPath]);

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // If an item is selected via keyboard, use that
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleSelectTicker((suggestions[selectedIndex] as any).symbol);
            return;
        }
        // If no item selected but suggestions exist, and user hit enter, pick the first one (Smart Enter)
        if (suggestions.length > 0) {
            handleSelectTicker((suggestions[0] as any).symbol);
            return;
        }

        if (searchTerm.trim()) {
            navigate(`/dashboard?ticker=${searchTerm.trim().toUpperCase()}`);
            setShowSuggestions(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        }
    };

    const handleSelectTicker = (ticker: string) => {
        setSearchTerm(ticker);
        navigate(`/dashboard?ticker=${ticker}`);
        setShowSuggestions(false);
    };

    return (
        <header className="flex items-center justify-between px-4 md:px-8 py-5 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40 rounded-2xl shadow-sm">
            {/* Left: Menu Button (Mobile), User Welcome & Search */}
            <div className="flex items-center gap-4 md:gap-12 flex-1">

                {/* Mobile Menu Button */}
                <button
                    onClick={onMenuClick}
                    className="min-[650px]:hidden p-2 -ml-2 text-muted-foreground hover:bg-accent rounded-lg hover:text-foreground"
                >
                    <Menu className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-3 min-w-fit hidden sm:flex">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Welcome back</p>
                        <h2 className="text-sm font-bold text-foreground leading-none">{user?.username || user?.full_name || user?.email || 'User'}</h2>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative w-full max-w-md" ref={searchRef}>
                    <form onSubmit={handleSearch}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => { if (searchTerm) setShowSuggestions(true); }}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-card border border-border focus:border-border focus:bg-card/50 text-foreground text-sm rounded-xl pl-10 pr-4 py-2.5 transition-all outline-none"
                        />
                    </form>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-popover rounded-xl shadow-lg border border-border py-2 z-50 overflow-hidden">
                            {suggestions.map((item: any, index: number) => (
                                <button
                                    key={item.symbol}
                                    onClick={() => handleSelectTicker(item.symbol)}
                                    className={`w-full text-left px-4 py-2 flex items-center justify-between group transition-colors ${index === selectedIndex ? 'bg-accent' : 'hover:bg-accent'}`}
                                >
                                    <div>
                                        <span className={`text-sm font-bold ${index === selectedIndex ? 'text-primary' : 'text-foreground'}`}>{item.symbol}</span>
                                        <span className="ml-2 text-xs text-muted-foreground">{item.name}</span>
                                    </div>
                                    <span className={`text-xs text-primary transition-opacity ${index === selectedIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>Select</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* Desktop Actions */}
                <div className="hidden sm:flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (location.pathname === '/settings') {
                                navigate(lastVisitedPath);
                            } else {
                                navigate('/settings');
                            }
                        }}
                        className="p-2.5 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="p-2.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                {/* Mobile User Dropdown */}
                <div className="sm:hidden relative " ref={userMenuRef}>
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex cursor-pointer items-center gap-1.5 p-1.5 rounded-lg hover:bg-accent transition-colors"
                    >
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isUserMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-popover rounded-xl shadow-lg border border-border py-1 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-4 py-3 border-b border-border/50">
                                <p className="text-lg text-foreground font-bold">Hi,<span className="text-md p-1 font-medium text-foreground truncate">{user?.username || user?.full_name || 'User'}</span></p>
                            </div>

                            <div className="py-1">
                                <button
                                    onClick={() => {
                                        if (location.pathname === '/settings') {
                                            navigate(lastVisitedPath);
                                        } else {
                                            navigate('/settings');
                                        }
                                        setIsUserMenuOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-md text-foreground hover:bg-primary/10 flex items-center gap-2 transition-colors"
                                >
                                    <Settings className="w-4 h-4 text-muted-foreground" />
                                    Settings
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2.5 text-md text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Log Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
