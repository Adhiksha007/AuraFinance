import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GoalBase } from "../../types/goal";
import { ArrowRight, Sparkles, DollarSign, Calendar, Target } from "lucide-react";

interface GoalWizardProps {
    onComplete: (goal: GoalBase) => void;
}

export const GoalWizard: React.FC<GoalWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState<Partial<GoalBase>>({
        current_savings: 0,
        monthly_contribution: 0,
        risk_profile: "Moderate"
    });

    const updateField = (field: keyof GoalBase, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const nextStep = () => {
        if (step < 3) setStep(step + 1);
        else if (step === 3) {
            // Basic validation
            if (formData.name && formData.target_amount && formData.target_date) {
                onComplete(formData as GoalBase);
            }
        }
    };

    const variants = {
        enter: { x: 50, opacity: 0 },
        center: { x: 0, opacity: 1 },
        exit: { x: -50, opacity: 0 }
    };

    return (
        <div className="max-w-xl mx-auto py-12 px-4">
            <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-500">
                    What are we dreaming of?
                </h2>
                <p className="text-muted-foreground mt-2">Let's build your path to financial freedom.</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 shadow-xl backdrop-blur-sm bg-opacity-90 min-h-[400px] flex flex-col justify-between relative overflow-hidden">
                {/* Step Indicator */}
                <div className="flex gap-2 mb-8">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-primary" : "bg-muted"}`} />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div key="step0" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-4">
                            <label className="block text-lg font-medium">Name your goal</label>
                            <div className="relative">
                                <Target className="absolute left-3 top-3.5 text-muted-foreground w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="e.g., Tesla Model S, Retirement"
                                    className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none text-lg"
                                    value={formData.name || ""}
                                    onChange={e => updateField("name", e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-4 mt-6">
                                {["Create a Safety Net", "Buy a Home", "Dream Vacation", "Retire Early"].map(chip => (
                                    <button
                                        key={chip}
                                        onClick={() => updateField("name", chip)}
                                        className={`px-4 py-2 rounded-full text-sm border transition-all ${formData.name === chip ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-border hover:border-primary/50"}`}
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {step === 1 && (
                        <motion.div key="step1" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-4">
                            <label className="block text-lg font-medium">How much do you need?</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3.5 text-muted-foreground w-5 h-5" />
                                <input
                                    type="number"
                                    placeholder="50000"
                                    className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none text-lg"
                                    value={formData.target_amount || ""}
                                    onChange={e => updateField("target_amount", parseFloat(e.target.value))}
                                />
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-4">
                            <label className="block text-lg font-medium">When do you want this?</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3.5 text-muted-foreground w-5 h-5" />
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none text-lg"
                                    value={formData.target_date || ""}
                                    onChange={e => updateField("target_date", e.target.value)}
                                />
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-6">
                            <label className="block text-lg font-medium">Starting point</label>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-sm text-muted-foreground">Current Savings</span>
                                    <div className="relative mt-1">
                                        <DollarSign className="absolute left-3 top-3.5 text-muted-foreground w-5 h-5" />
                                        <input
                                            type="number"
                                            className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none text-lg"
                                            value={formData.current_savings || ""}
                                            onChange={e => updateField("current_savings", parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">Monthly Contribution capability</span>
                                    <div className="relative mt-1">
                                        <DollarSign className="absolute left-3 top-3.5 text-muted-foreground w-5 h-5" />
                                        <input
                                            type="number"
                                            className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none text-lg"
                                            value={formData.monthly_contribution || ""}
                                            onChange={e => updateField("monthly_contribution", parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={nextStep}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
                    >
                        {step === 3 ? "Simulate Plan" : "Continue"} <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
