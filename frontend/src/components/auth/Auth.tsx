import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import FinanceScene from './FinanceScene';
import apiClient from '../../api/apiClient';
import { useAuthStore } from '../../state/authStore';
import { useNavigate } from 'react-router-dom';



export default function Auth() {
    const [is3DReady, setIs3DReady] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { setAuth, fetchUser } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        // Simulating 3D environment loading time
        const timer = setTimeout(() => setIs3DReady(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            let response;

            if (isLogin) {
                const formData = new FormData();
                formData.append('username', email);
                formData.append('password', password);

                response = await apiClient.post(endpoint, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                response = await apiClient.post(endpoint, {
                    username,
                    email,
                    password
                });
            }

            if (isLogin) {
                const { access_token } = response.data;
                setAuth(access_token, { email });
                await fetchUser();
                navigate('/');
            } else {
                setIsLogin(true);
                setError('Registration successful! Please login.');
            }

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-background overflow-hidden relative">
            {/* Left Side - 3D Scene */}
            <div className="hidden min-[650px]:flex w-1/2 relative items-center justify-center bg-muted/5 backdrop-blur-3xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-purple-500/10 z-0 dark:from-primary/20 dark:to-purple-500/20" />

                <div className="w-full h-full z-10 relative flex items-center justify-center">
                    {/* 3D Scene - Always mounted, fades in */}
                    <motion.div
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: is3DReady ? 1 : 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    >
                        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                            <ambientLight intensity={0.5} />
                            <directionalLight position={[10, 10, 5]} intensity={1} />
                            <Suspense fallback={null}>
                                <FinanceScene />
                            </Suspense>
                        </Canvas>
                    </motion.div>

                    {/* Loader - Overlays scene, fades out */}
                    <AnimatePresence>
                        {!is3DReady && (
                            <motion.div
                                key="loader"
                                initial={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                                className="absolute inset-0 flex flex-col items-center justify-center bg-muted/5 backdrop-blur-3xl z-20"
                            >
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="absolute bottom-10 left-10 z-20">
                    <h1 className="text-4xl font-bold text-foreground tracking-tight">AuraFinance</h1>
                    <p className="text-muted-foreground mt-2 text-lg">AI-Powered Wealth Management.</p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full min-[650px]:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 xl:p-24 relative">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={isLogin ? 'login' : 'register'}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-sm lg:max-w-md bg-card/70 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border border-border/50"
                    >
                        <h2 className="text-3xl font-bold text-foreground mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                        <p className="text-muted-foreground mb-8">{isLogin ? 'Enter your Credentials.' : 'Start your journey to financial freedom.'}</p>

                        {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}

                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Username Field - ONLY FOR REGISTER */}
                            {!isLogin && (
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Username</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-input/50 focus:ring-1 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground"
                                        placeholder="johndoe123"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Email / Identifier Field */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                    {isLogin ? 'Email or Username' : 'Email Address'}
                                </label>
                                <input
                                    type={isLogin ? "text" : "email"}
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-input/50 focus:ring-1 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground"
                                    placeholder={isLogin ? "email or username" : "email"}
                                    value={email} // Note: We reuse 'email' state for login identifier
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-input/50 focus:ring-1 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-primary text-primary-foreground cursor-pointer rounded-xl font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center hover:bg-primary/90"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isLogin ? 'Sign In' : 'Create Account')}
                            </button>
                        </form>

                        <div className="mt-8 text-center text-sm text-muted-foreground">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-primary font-semibold hover:underline cursor-pointer"
                            >
                                {isLogin ? 'Sign up' : 'Log in'}
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
