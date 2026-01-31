import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { YearlyProjection } from "../../types/goal";
import { ChevronDown, CheckCircle } from "lucide-react";

interface GoalTimelineProps {
    projections: YearlyProjection[];
}

export const GoalTimeline: React.FC<GoalTimelineProps> = ({ projections }) => {
    const [expandedYear, setExpandedYear] = useState<number | null>(null);

    const toggleYear = (year: number) => {
        setExpandedYear(expandedYear === year ? null : year);
    };

    return (
        <div className="relative pl-8 py-4">
            {/* Solid Connection Line */}
            <div className="absolute left-[18px] top-2 bottom-0 w-0.5 bg-border rounded-full" />

            <div className="space-y-6">
                {projections.map((p, index) => {
                    const isExpanded = expandedYear === p.year;
                    return (
                        <motion.div
                            key={p.year}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative"
                        >
                            {/* Node */}
                            <button
                                onClick={() => toggleYear(p.year)}
                                className={`absolute -left-[25px] top-1 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-300 bg-background
                  ${isExpanded ? "border-primary" : "border-muted-foreground hover:border-primary"}`}
                            >
                                {isExpanded ? <CheckCircle className="w-4 h-4 text-background bg-primary rounded-full" /> : <div className="w-2 h-2 rounded-full bg-muted-foreground" />}
                            </button>

                            {/* Card */}
                            <div
                                className={`ml-2 p-4 rounded-xl border transition-all duration-300 backdrop-blur-lg bg-card/60
                  ${isExpanded ? "border-primary/50 shadow-lg shadow-primary/10" : "border-border hover:border-primary/30"}`}
                            >
                                <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleYear(p.year)}>
                                    <div>
                                        <h4 className="font-semibold text-lg">{p.year}</h4>
                                        <p className="text-sm text-muted-foreground">Projected: ${p.amount.toLocaleString()}</p>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </div>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span>Contribution:</span>
                                                    <span className="font-medium text-emerald-500">+${p.contribution.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Investment Growth:</span>
                                                    <span className="font-medium text-indigo-500">+${p.growth.toLocaleString()}</span>
                                                </div>
                                                <div className="bg-primary/10 p-2 rounded-md mt-2 text-xs text-primary">
                                                    💡 Action: Increase savings by 5% to maintain this trajectory.
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
