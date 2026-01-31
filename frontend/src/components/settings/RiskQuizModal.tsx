import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';

interface RiskQuizModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (score: number) => void;
}

const QUESTIONS = [
    {
        question: "What is your primary goal?",
        options: [
            { text: "Preserve my money (Avoid Loss)", score: 10 },
            { text: "Grow steadily (Balanced)", score: 50 },
            { text: "Maximize returns (Aggressive)", score: 90 },
        ]
    },
    {
        question: "How long do you plan to invest?",
        options: [
            { text: "Less than 1 year", score: 10 },
            { text: "1 - 5 years", score: 50 },
            { text: "5+ years", score: 90 },
        ]
    },
    {
        question: "If your portfolio drops 20% in a month...",
        options: [
            { text: "I sell immediately", score: 0 },
            { text: "I wait it out", score: 50 },
            { text: "I buy more", score: 100 },
        ]
    },
    {
        question: "What is your yearly income stability?",
        options: [
            { text: "Unstable / Variable", score: 20 },
            { text: "Stable", score: 60 },
            { text: "Very Secure (High savings)", score: 90 },
        ]
    },
    {
        question: "How much experience do you have?",
        options: [
            { text: "None / Beginner", score: 10 },
            { text: "Some knowledge", score: 50 },
            { text: "Visualizing candlestick patterns in sleep", score: 90 },
        ]
    }
];

export default function RiskQuizModal({ isOpen, onClose, onComplete }: RiskQuizModalProps) {
    const [step, setStep] = useState(0);
    const [scores, setScores] = useState<number[]>([]);

    if (!isOpen) return null;

    const handleOptionSelect = (score: number) => {
        const newScores = [...scores, score];
        setScores(newScores);

        if (step < QUESTIONS.length - 1) {
            setStep(step + 1);
        } else {
            // Calculate final score
            const averageScore = Math.round(newScores.reduce((a, b) => a + b, 0) / QUESTIONS.length);
            onComplete(averageScore);
            // close handled by parent or auto-close? Usually parent.
            onClose();
            // Reset for next time (optional)
            setTimeout(() => {
                setStep(0);
                setScores([]);
            }, 500);
        }
    };

    const progress = ((step + 1) / QUESTIONS.length) * 100;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative dark:bg-gray-900"
                >
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center dark:border-white/10">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Risk Assessment</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Discover your investor profile</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors dark:hover:bg-white/10">
                            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 bg-gray-100 w-full dark:bg-white/10">
                        <motion.div
                            className="h-full bg-blue-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>

                    {/* Content */}
                    <div className="p-8 min-h-[300px] flex flex-col justify-center">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                transition={{ duration: 0.3 }}>
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-bold text-gray-900 leading-tight dark:text-white">
                                        {QUESTIONS[step].question}
                                    </h3>

                                    <div className="space-y-3">
                                        {QUESTIONS[step].options.map((option, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleOptionSelect(option.score)}
                                                className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-200 flex items-center justify-between group dark:border-white/10 dark:hover:bg-blue-900/20"
                                            >
                                                <span className="font-medium text-gray-700 group-hover:text-blue-700 dark:text-gray-300 dark:group-hover:text-blue-400">
                                                    {option.text}
                                                </span>
                                                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all dark:text-gray-600 dark:group-hover:text-blue-400" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center dark:bg-black/20 dark:border-white/10">
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold dark:text-gray-500">
                            Question {step + 1} of {QUESTIONS.length}
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
