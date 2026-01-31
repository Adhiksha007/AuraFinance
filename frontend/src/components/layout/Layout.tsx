import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }: { children?: React.ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex min-h-screen text-foreground">
            <Sidebar
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            {/*
               Responsive Margins:
               - Mobile: ml-0 (Sidebar is overlay)
               - Tablet (768px+): ml-20 (Sidebar is 80px/20rem collapsed)
               - Desktop (890px+): ml-64 (Sidebar is 256px/64rem expanded)
            */}
            <main className="flex-1 ml-0 min-[650px]:ml-20 min-[1100px]:ml-64 flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out">
                <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
                <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
                    {children || <Outlet />}
                    <Footer />
                </div>
            </main>
        </div>
    );
}
