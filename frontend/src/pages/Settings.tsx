import { useEffect, useState, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import {
    User, Bell, Moon, ChevronRight,
    CreditCard, Fingerprint, Lock,
    Zap, TrendingUp, Camera, CheckCircle, AlertCircle,
    Pencil, X, Check
} from 'lucide-react';
import { useSettingsStore, ComplexityLevel } from '../state/useSettingsStore';
import { useAuthStore } from '../state/authStore';
import RiskQuizModal from '../components/settings/RiskQuizModal';

// ... imports remain the same

// --- Reusable Components (Local) ---
function SettingsSection({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="mb-8">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">{title}</h3>
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                {children}
            </div>
        </div>
    );
}

function SettingsItem({
    icon: Icon,
    label,
    value,
    type = 'arrow',
    onClick,
    color = 'bg-accent text-accent-foreground',
    disabled = false
}: any) {
    return (
        <div
            onClick={!disabled ? onClick : undefined}
            className={`flex items-center justify-between p-4 border-b border-border last:border-0 ${onClick && !disabled ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-foreground">{label}</span>
            </div>

            <div className="flex items-center gap-3">
                {type === 'toggle' && (
                    <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${value ? 'bg-primary' : 'bg-primary/30'}`}>
                        <motion.div
                            layout
                            className="w-5 h-5 bg-background rounded-full shadow-sm"
                            animate={{ x: value ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    </div>
                )}
                {type === 'value' && <span className="text-muted-foreground text-sm">{value}</span>}
                {type === 'arrow' && (
                    <>
                        <span className="text-muted-foreground text-sm">{value}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </>
                )}
            </div>
        </div>
    )
}

function ProfileInput({ label, value, onChange, placeholder, type = "text", verified, onVerify, canVerify }: any) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    // Sync tempValue if external value changes (though we mostly control it internally during edit)
    useEffect(() => {
        if (!isEditing) setTempValue(value);
    }, [value, isEditing]);

    const handleSave = () => {
        onChange(tempValue);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setTempValue(value);
        setIsEditing(false);
    };

    return (
        <div className="p-4 border-b border-border last:border-0">
            <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Edit"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 h-8">
                {isEditing ? (
                    <>
                        <input
                            type={type}
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            placeholder={placeholder}
                            className="flex-1 bg-input/20 border border-input rounded px-2 py-1 text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground"
                            autoFocus
                        />
                        <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded dark:text-green-400 dark:hover:bg-green-900/20">
                            <Check className="w-4 h-4" />
                        </button>
                        <button onClick={handleCancel} className="p-1 text-muted-foreground hover:bg-accent rounded">
                            <X className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <>
                        <span className={`flex-1 font-medium text-foreground truncate ${!value ? 'text-muted-foreground italic' : ''}`}>
                            {value || placeholder}
                        </span>

                        {verified !== undefined && (
                            verified ? (
                                <span className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full dark:bg-green-900/30 dark:text-green-400">
                                    <CheckCircle className="w-3 h-3" /> Verified
                                </span>
                            ) : (
                                canVerify ? (
                                    <button
                                        onClick={onVerify}
                                        className="text-primary-foreground text-xs font-medium bg-accent hover:bg-primary/90 px-3 py-1 rounded-full transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
                                    >
                                        Verify
                                    </button>
                                ) : (
                                    <span className="flex items-center gap-1 text-foreground text-xs font-medium bg-primary/20 px-2 py-1 rounded-full">
                                        Unverified
                                    </span>
                                )
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function Settings() {
    const { settings, fetchSettings, updateSettings, calculateRiskLevel, loading, error } = useSettingsStore();
    const { user: authUser, updateUser, fetchUser } = useAuthStore();
    const [isQuizOpen, setQuizOpen] = useState(false);

    // Profile State
    interface ProfileState {
        name: string;
        email: string;
        username: string; // Added username
        phone: string;
        photo: string;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
        is2FA: boolean;
    }

    const [profile, setProfile] = useState<ProfileState>({
        name: authUser?.full_name || '',
        email: authUser?.email || '',
        username: authUser?.username || '', // Initialize username
        phone: authUser?.phone_number || '',
        photo: authUser?.profile_image || '',
        isPhoneVerified: authUser?.is_phone_verified || false,
        isEmailVerified: authUser?.is_email_verified || true,
        is2FA: authUser?.is_2fa_enabled || false
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchSettings();
        fetchUser(); // Ensure we have the latest user data from DB
    }, [fetchSettings, fetchUser]);

    // Sync local state when authUser changes (e.g. after initial load or update)
    useEffect(() => {
        if (authUser) {
            setProfile(prev => ({
                ...prev,
                name: authUser.full_name || prev.name,
                email: authUser.email || prev.email,
                username: authUser.username || prev.username,
                phone: authUser.phone_number || prev.phone,
                photo: authUser.profile_image || prev.photo,
                isPhoneVerified: authUser.is_phone_verified,
                isEmailVerified: authUser.is_email_verified,
                is2FA: authUser.is_2fa_enabled
            }));
        }
    }, [authUser]);

    const handleRiskQuizComplete = (score: number) => {
        const newLevel = calculateRiskLevel(score);
        updateSettings({ risk_score: score, risk_level: newLevel });
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                // Optimistic UI update
                setProfile(prev => ({ ...prev, photo: base64String }));
                // Persist to backend
                updateUser({ profile_image: base64String });
            };
            reader.readAsDataURL(file);
        }
    };

    const toggle2FA = () => {
        if (profile.is2FA) {
            // Turning off
            updateUser({ is_2fa_enabled: false });
        } else {
            // Turning on
            if (profile.phone && profile.email && profile.isPhoneVerified && profile.isEmailVerified) {
                updateUser({ is_2fa_enabled: true });
            }
        }
    };

    // 2FA Condition Check
    const canEnable2FA = !!(profile.phone && profile.email && profile.isPhoneVerified && profile.isEmailVerified);

    if (loading && !settings) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
            </div>
        );
    }

    if (error && !settings) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
                <p className="text-destructive font-medium">{error}</p>
                <button
                    onClick={() => fetchSettings()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="min-h-screen py-12 px-4 bg-background overflow-y-auto">
            <div className="max-w-2xl mx-auto pb-20">
                <header className="mb-8 ml-2">
                    <h1 className="text-4xl font-bold text-foreground tracking-tight">Settings</h1>
                </header>

                <LayoutGroup>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

                        {/* Profile Section */}
                        <SettingsSection title="Personal Profile">
                            <div className="p-6 flex flex-col items-center border-b border-border">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-24 h-24 rounded-full bg-muted overflow-hidden border-4 border-background shadow-lg transition-transform group-hover:scale-105">
                                        {profile.photo ? (
                                            <img src={profile.photo} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <User className="w-10 h-10" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="w-6 h-6 text-white" />
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                    />
                                </div>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-3 text-sm font-medium text-primary hover:text-primary/80"
                                >
                                    Change Photo
                                </button>
                                <h2 className="mt-2 text-xl font-bold text-foreground">{profile.username || profile.name}</h2>
                            </div>

                            <ProfileInput
                                label="Username"
                                value={profile.username}
                                onChange={(val: string) => updateUser({ username: val })}
                                placeholder="Enter username"
                            />
                            <ProfileInput
                                label="Full Name"
                                value={profile.name}
                                onChange={(val: string) => updateUser({ full_name: val })}
                                placeholder="Enter your name"
                            />
                            <ProfileInput
                                label="Email Address"
                                value={profile.email}
                                onChange={(val: string) => updateUser({ email: val, is_email_verified: false })} // Changing email resets verification
                                placeholder="name@example.com"
                                verified={profile.isEmailVerified}
                                canVerify={!!profile.email && profile.email.includes('@')}
                                onVerify={() => updateUser({ is_email_verified: true })}
                            />
                            <ProfileInput
                                label="Phone Number"
                                value={profile.phone}
                                onChange={(val: string) => updateUser({ phone_number: val, is_phone_verified: false })} // Changing phone resets verification
                                placeholder="+1 (555) 000-0000"
                                type="tel"
                                verified={profile.isPhoneVerified}
                                canVerify={profile.phone && profile.phone.length > 9}
                                onVerify={() => updateUser({ is_phone_verified: true })}
                            />
                        </SettingsSection>

                        {/* Security */}
                        <SettingsSection title="Security">
                            <SettingsItem
                                icon={Lock}
                                label="Two-Factor Authentication"
                                value={profile.is2FA}
                                type="toggle"
                                onClick={toggle2FA}
                                color="bg-orange-100 text-orange-600"
                                disabled={!canEnable2FA && !profile.is2FA} // Disable only if trying to enable but can't
                            />
                            {(!canEnable2FA && !profile.is2FA) && (
                                <div className="px-4 py-3 bg-destructive/10 text-destructive text-xs flex items-start gap-2 border-t border-destructive/20">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <p>To enable 2FA, please add and verify both your phone number and email address.</p>
                                </div>
                            )}

                            <SettingsItem
                                icon={Fingerprint}
                                label="Biometric Login"
                                value={true}
                                type="toggle"
                                onClick={() => { }}
                                color="bg-green-100 text-green-600"
                            />
                        </SettingsSection>

                        {/* Investor Profile Section */}
                        <SettingsSection title="Investor Profile">
                            <SettingsItem
                                icon={TrendingUp}
                                label="Risk Level"
                                value={settings.risk_level}
                                type="arrow"
                                onClick={() => setQuizOpen(true)}
                                color="bg-blue-100 text-blue-600"
                            />
                            <SettingsItem
                                icon={Zap}
                                label="AI Complexity"
                                value={settings.complexity_level === ComplexityLevel.BEGINNER ? false : true}
                                type="toggle"
                                onClick={() => updateSettings({
                                    complexity_level: settings.complexity_level === ComplexityLevel.BEGINNER ? ComplexityLevel.EXPERT : ComplexityLevel.BEGINNER
                                })}
                                color="bg-purple-100 text-purple-600"
                            />
                        </SettingsSection>

                        {/* Preferences */}
                        <SettingsSection title="App Preferences">
                            <SettingsItem
                                icon={Moon}
                                label="Dark Mode"
                                value={settings.theme === 'dark'}
                                type="toggle"
                                onClick={() => updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
                                color="bg-indigo-100 text-indigo-600"
                            />
                            <SettingsItem
                                icon={Bell}
                                label="Notifications"
                                value={settings.notifications_enabled}
                                type="toggle"
                                onClick={() => updateSettings({ notifications_enabled: !settings.notifications_enabled })}
                                color="bg-red-100 text-red-600"
                            />
                        </SettingsSection>

                        {/* Linked Accounts (Mock) */}
                        <SettingsSection title="Linked Accounts">
                            <SettingsItem
                                icon={CreditCard}
                                label="Chase Bank"
                                value="Connected"
                                type="value"
                                color="bg-blue-600 text-white"
                            />
                            <SettingsItem
                                icon={User}
                                label="Robinhood"
                                value="Connected"
                                type="value"
                                color="bg-green-500 text-white"
                            />
                        </SettingsSection>

                    </motion.div>
                </LayoutGroup>

                <RiskQuizModal
                    isOpen={isQuizOpen}
                    onClose={() => setQuizOpen(false)}
                    onComplete={handleRiskQuizComplete}
                />
            </div>
        </div>
    );
}
