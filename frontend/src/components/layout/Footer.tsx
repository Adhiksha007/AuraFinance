import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="mt-12 border-t border-border pt-8 pb-4">
            <div className="max-w-7xl mx-auto px-4 text-center">
                <p className="text-xs text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {/* Disclaimer: The financial data, analysis, and projections provided by this application are for informational purposes only and should not be considered as professional financial advice.
                    Market data may be delayed or inaccurate. All investments involve risk, including the loss of principal.
                    Do not rely blindly on these values for investment decisions. Past performance is not indicative of future results. */}
                    Disclaimer: For informational purposes only. Not financial advice.
                    Data may be delayed. Do not rely solely on these values for investment decisions.
                    Past performance is not indicative of future results.
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-4">
                    © {new Date().getFullYear()} AuraFinance. All rights reserved.
                </p>
            </div>
        </footer>
    );
};

export default Footer;
