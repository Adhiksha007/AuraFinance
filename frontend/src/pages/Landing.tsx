import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Zap, Globe, PieChart, Menu, X, Plus } from 'lucide-react';
import { useState } from 'react';

export default function Landing() {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const toggleFaq = (idx: number) => setOpenFaq(openFaq === idx ? null : idx);

    const fadeInUp: Variants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
    };

    const stagger: Variants = {
        visible: { transition: { staggerChildren: 0.1 } }
    };

    return (
        <div className="p-2min-h-screen bg-[#FDFBF7] text-[#0F2922] font-sans selection:bg-[#0F2922] selection:text-white">

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-[#0F2922]/5">
                <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold tracking-tight text-[#0F2922]">Q<span className="font-serif italic text-emerald-600">Finance</span></span>
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#0F2922]/70">
                        <a href="#features" className="hover:text-[#0F2922] transition-colors">Features</a>
                        <a href="#about" className="hover:text-[#0F2922] transition-colors">About</a>
                        <a href="#pricing" className="hover:text-[#0F2922] transition-colors">Pricing</a>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <button onClick={() => navigate('/login')} className="text-sm font-medium hover:text-emerald-700">Login</button>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-5 py-2.5 rounded-full bg-[#0F2922] text-white text-sm font-medium hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-900/10"
                        >
                            Start Free
                        </button>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-40 bg-[#FDFBF7] pt-24 px-6 md:hidden">
                    <div className="flex flex-col gap-6 text-xl font-medium">
                        <a href="#features" onClick={() => setIsMenuOpen(false)}>Features</a>
                        <a href="#about" onClick={() => setIsMenuOpen(false)}>About</a>
                        <button onClick={() => navigate('/login')} className="text-left text-emerald-700">Login</button>
                    </div>
                </div>
            )}

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                    <motion.div initial="hidden" animate="visible" variants={stagger}>
                        <motion.div variants={fadeInUp} className="inline-block px-3 py-1 bg-emerald-100/50 text-emerald-800 text-xs font-bold tracking-wider rounded-full mb-6">
                            AI-POWERED INTELLIGENCE
                        </motion.div>
                        <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 tracking-tight">
                            AI-Powered <br />
                            Wealth <br />
                            <span className="font-serif italic text-emerald-600">Management.</span>
                        </motion.h1>
                        <motion.p variants={fadeInUp} className="text-lg text-[#0F2922]/60 mb-10 max-w-md leading-relaxed">
                            Master the markets with Quantum Optimization, Monte Carlo Simulations, and Real-Time AI Analysis.
                        </motion.p>
                        <motion.button
                            variants={fadeInUp}
                            onClick={() => navigate('/login')}
                            className="px-8 py-4 rounded-full bg-[#0F2922] text-white font-medium text-lg hover:translate-y-[-2px] hover:shadow-xl transition-all flex items-center gap-2"
                        >
                            Get Started Now <ArrowRight className="w-5 h-5" />
                        </motion.button>

                        <motion.div variants={fadeInUp} className="flex items-center gap-4 mt-8">
                            <div className="flex -space-x-3">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#FDFBF7] bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                        U{i}
                                    </div>
                                ))}
                            </div>
                            <div className="text-sm">
                                <span className="font-bold">4.9/5</span> from 12k+ investors
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Right Grid Visual */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="grid grid-cols-2 gap-4 h-[500px]"
                    >
                        {/* Top Left: Mobile Mockup */}
                        <div className="bg-[#EAE4D5] rounded-3xl p-6 flex items-center justify-center relative overflow-hidden group">
                            <div className="w-32 h-56 bg-[#0F2922] rounded-2xl border-4 border-[#0F2922] shadow-2xl transform group-hover:scale-105 transition-transform duration-500 overflow-hidden relative">
                                <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-white/10 to-transparent"></div>
                                <div className="p-3">
                                    <div className="w-full h-2 bg-white/20 rounded-full mb-2"></div>
                                    <div className="w-2/3 h-2 bg-white/20 rounded-full mb-6"></div>
                                    <div className="flex gap-1 items-end h-20">
                                        <div className="w-1/4 bg-emerald-400 rounded-t h-[40%]"></div>
                                        <div className="w-1/4 bg-emerald-300 rounded-t h-[70%]"></div>
                                        <div className="w-1/4 bg-emerald-500 rounded-t h-[55%]"></div>
                                        <div className="w-1/4 bg-emerald-200 rounded-t h-[90%]"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Right: Currencies */}
                        <div className="bg-[#F2EFE9] rounded-[2rem] p-6 flex flex-col justify-between hover:bg-[#EAE4D5] transition-colors duration-300">
                            <div className="text-right">
                                <div className="text-4xl font-bold text-[#0F2922]">20k+</div>
                                <div className="text-sm text-[#0F2922]/60">Assets Tracked</div>
                            </div>
                            <Globe className="w-16 h-16 text-[#0F2922]/10 self-start" />
                        </div>

                        {/* Bottom Left: Sparkles */}
                        <div className="bg-[#D1FAE5] rounded-[2rem] p-6 flex flex-col justify-between hover:bg-[#A7F3D0] transition-colors duration-300">
                            <Sparkles className="w-8 h-8 text-emerald-700" />
                            <div>
                                <div className="text-sm font-bold text-emerald-900">AI Signals</div>
                                <div className="flex items-center gap-1 text-xs text-emerald-800">
                                    <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></div> Active
                                </div>
                            </div>
                        </div>

                        {/* Bottom Right: Chart */}
                        <div className="bg-[#0F2922] rounded-[2rem] p-6 text-white flex flex-col justify-between relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="text-2xl font-bold">$195k</div>
                                <div className="text-white/60 text-xs">+12.5% this month</div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-50">
                                <svg viewBox="0 0 100 40" className="w-full h-full fill-none stroke-emerald-400 stroke-2">
                                    <path d="M0 30 Q 20 35, 40 20 T 100 5" />
                                </svg>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Logo Strip */}
            <div className="py-12 border-y border-[#0F2922]/5 bg-white/50">
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center opacity-40 grayscale mix-blend-multiply flex-wrap gap-8">
                    {/* Placeholder logos */}
                    <span className="text-xl font-bold">Hugging Face</span>
                    <span className="text-xl font-bold">VADER Sentiment</span>
                    <span className="text-xl font-bold">YAHOO! FINANCE</span>
                    <span className="text-xl font-bold">FORBES</span>
                    <span className="text-xl font-bold">FinBert</span>
                </div>
            </div>

            {/* Main Feature Area */}
            <section className="py-32 px-6 max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <span className="text-xs font-bold tracking-widest text-[#0F2922]/40 uppercase mb-4 block">Features</span>
                    <h2 className="text-4xl md:text-5xl font-bold text-[#0F2922]">Precision tools for <br /> serious investors.</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-auto md:h-[500px]">
                    {/* Card 1: Goal Planner */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-[#0F2922] rounded-[2.5rem] p-10 md:p-14 text-white relative flex flex-col justify-between overflow-hidden"
                    >
                        <div className="relative z-10">
                            <h3 className="text-3xl font-medium mb-2">Simulate your <br />financial future</h3>
                            <div className="text-sm opacity-80 mb-4">Monte Carlo Projections</div>
                            <div className="text-3xl font-bold text-emerald-400">94% Success</div>
                        </div>

                        {/* Bar Chart Visual */}
                        <div className="flex items-end gap-3 h-48 mt-8">
                            {[40, 45, 55, 60, 70, 85, 95].map((h, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ height: 0 }}
                                    whileInView={{ height: `${h}%` }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 1, delay: i * 0.1 }}
                                    className={`flex-1 rounded-t-lg ${i === 6 ? 'bg-emerald-500' : 'bg-white/10'}`}
                                />
                            ))}
                        </div>
                        <ArrowRight className="absolute bottom-10 right-10 w-8 h-8 text-white/50" />
                    </motion.div>

                    {/* Card 2: Quantum Portfolio */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-[#E6F0EB] rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden"
                    >
                        <h3 className="text-3xl font-medium text-[#0F2922] mb-2">Quantum <br />Optimization</h3>
                        <p className="text-[#0F2922]/60 mb-8 max-w-[200px]">Tailored assets based on your risk & tenure.</p>

                        {/* Map Visual (Abstract) */}
                        <div className="absolute inset-0 top-32 opacity-20">
                            <div className="w-full h-full border-[1px] border-[#0F2922] rounded-full scale-[2]" />
                            <div className="w-full h-full border-[1px] border-[#0F2922] rounded-full scale-[1.5]" />
                        </div>

                        {/* Floating Cards */}
                        <div className="relative z-10 grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-lg shadow-[#0F2922]/5">
                                <div className="text-xs text-gray-400">Risk Profile</div>
                                <div className="text-lg font-bold">Moderate</div>
                            </div>
                            <div className="bg-[#0F2922] text-white p-4 rounded-xl shadow-lg translate-y-8">
                                <div className="text-xs text-white/60">Rec. Asset</div>
                                <div className="text-lg font-bold">VTI + BND</div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Tri-Column Features */}
            <section className="py-20 px-6 max-w-7xl mx-auto">
                <div className="mb-12">
                    <h3 className="text-3xl font-bold mb-4">Complete financial <br /> intelligience</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Feature 1: AI Stock Picks */}
                    <div className="bg-white rounded-[2rem] p-8 border border-[#0F2922]/5 hover:shadow-lg transition-all">
                        <div className="w-12 h-12 rounded-full border border-gray-100 flex items-center justify-center mb-6 text-[#0F2922]">
                            <Zap />
                        </div>
                        <h4 className="text-xl font-bold mb-3">AI Stock Picks</h4>
                        <p className="text-[#0F2922]/60 text-sm leading-relaxed">
                            High-confidence Buy/Sell signals with clear Stop Loss, Take Profit, and Risk/Reward ratios.
                        </p>
                    </div>

                    {/* Feature 2: Smart News */}
                    <div className="bg-white rounded-[2rem] p-8 border border-[#0F2922]/5 hover:shadow-lg transition-all">
                        <div className="w-12 h-12 rounded-full border border-gray-100 flex items-center justify-center mb-6 text-[#0F2922]">
                            <PieChart />
                        </div>
                        <h4 className="text-xl font-bold mb-3">Smart News</h4>
                        <p className="text-[#0F2922]/60 text-sm leading-relaxed">
                            Sentiment-aware news feed tailored to your portfolio. Know the mood before you move.
                        </p>
                    </div>

                    {/* Feature 3: Market Pulse */}
                    <div className="bg-[#F2EFE9] rounded-[2rem] p-8 hover:shadow-lg transition-all flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 rounded-full border border-[#0F2922]/10 flex items-center justify-center mb-6 text-[#0F2922]">
                                <Globe />
                            </div>
                            <h4 className="text-xl font-bold mb-3">Global Market Pulse</h4>
                            <p className="text-[#0F2922]/60 text-sm leading-relaxed">
                                Real-time Sector Heatmaps (Global & India) and a live Market Mood Gauge.
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-[#0F2922] flex items-center justify-center text-white mt-8 self-end">
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Banner */}
            <section className="py-32 bg-[#0F2922] relative overflow-hidden">
                {/* Wavy Background SVG */}
                <div className="absolute inset-0 opacity-20 mix-blend-soft-light">
                    <svg viewBox="0 0 1440 320" className="w-full h-full object-cover">
                        <path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                    </svg>
                </div>

                <div className="max-w-7xl mx-auto px-6 relative z-10 text-white flex flex-col md:flex-row gap-12 items-center justify-between">
                    <div>
                        <div className="text-6xl font-serif italic mb-2">$14B</div>
                        <div className="text-sm opacity-60 uppercase tracking-widest">Funds analyzed</div>
                    </div>
                    <div>
                        <div className="text-6xl font-serif italic mb-2">23k+</div>
                        <div className="text-sm opacity-60 uppercase tracking-widest">Active Investors</div>
                    </div>
                    <div className="max-w-xs text-right">
                        <div className="text-xs opacity-60 mb-2 uppercase tracking-widest">Growth</div>
                        <h3 className="text-3xl font-medium">Market and build the solutions</h3>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-24 px-6 max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between mb-12">
                    <h3 className="text-3xl font-bold text-[#0F2922] max-w-xs">Frequently asked questions</h3>
                </div>

                <div className="space-y-4">
                    {[
                        "How does Quantum Optimization work?",
                        "What is a Monte Carlo simulation?",
                        "Is my data secure?",
                        "How accurate are the AI signals?"
                    ].map((q, i) => (
                        <div key={i} className="border-b border-[#0F2922]/10 pb-4">
                            <button
                                onClick={() => toggleFaq(i)}
                                className="w-full flex justify-between items-center py-4 text-left hover:text-emerald-700 transition-colors"
                            >
                                <span className="font-medium text-lg">{q}</span>
                                {openFaq === i ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            </button>
                            {openFaq === i && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="text-[#0F2922]/60 pb-4"
                                >
                                    {i === 0 && "Our Quantum Optimization algorithms process vast amounts of market data to construct portfolios that maximize returns for your specific risk profile and investment tenure."}
                                    {i === 1 && "Monte Carlo simulations run thousands of possible future market scenarios to predict the probability of reaching your financial goals, helping you plan with confidence."}
                                    {i === 2 && "Yes, we use bank-level encryption and secure protocols to ensure your financial data and personal information remain private and protected at all times."}
                                    {i === 3 && "Our AI signals are based on multi-factor analysis including technical indicators, volatility regimes, and news sentiment. While highly sophisticated, they should be used as tools to inform your decisions, not guarantees."}
                                </motion.div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer CTA */}
            <section className="px-6 pb-20 max-w-7xl mx-auto">
                <div className="bg-[#0F2922] rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center text-center md:text-left">
                    <div className="relative z-10 max-w-xl">
                        <h2 className="text-4xl md:text-6xl font-serif italic mb-6">Change the way you use your <span className="font-sans not-italic font-bold">money</span></h2>
                        <p className="text-white/60 mb-10 text-lg">Join over million people who choose QFinance for fast and secure future banking.</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="bg-white text-[#0F2922] px-8 py-4 rounded-full font-bold hover:bg-[#FDFBF7] transition-colors"
                        >
                            Get Started Now
                        </button>
                    </div>

                    {/* Decorative Stars */}
                    <div className="hidden md:block absolute top-10 right-20">
                        <Sparkles className="w-24 h-24 text-emerald-400 opacity-50" />
                    </div>
                    <div className="hidden md:block absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-t from-emerald-900 to-transparent"></div>
                </div>
            </section>

            {/* Footer Links */}
            <footer className="py-12 border-t border-[#0F2922]/5 bg-[#FDFBF7]">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-end gap-12">
                    <div className="flex gap-12 md:gap-24">
                        <div className="flex flex-col gap-4">
                            <div className="text-xs text-[#0F2922]/50 font-medium uppercase tracking-widest">Account</div>
                            <a href="#" className="text-sm text-[#0F2922]/70 hover:text-[#0F2922]">SignIn</a>
                            <a href="#" className="text-sm text-[#0F2922]/70 hover:text-[#0F2922]">Register</a>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="text-xs text-[#0F2922]/50 font-medium uppercase tracking-widest">Company</div>
                            <a href="#" className="text-sm text-[#0F2922]/70 hover:text-[#0F2922]">About</a>
                            <a href="#" className="text-sm text-[#0F2922]/70 hover:text-[#0F2922]">Contact</a>
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto text-center md:text-right">
                        <div className="text-2xl font-bold text-[#0F2922]">QFinance</div>
                        <div className="text-xs text-[#0F2922]/40">© 2024 QFinance Inc.</div>
                    </div>
                </div>
            </footer>

        </div>
    );
}
