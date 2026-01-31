import * as React from "react"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
    HTMLInputElement,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
        value?: number[];
        onValueChange?: (value: number[]) => void;
    }
>(({ className, value, onValueChange, max, step, ...props }, ref) => {
    const val = value ? value[0] : 0;
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange?.([parseFloat(e.target.value)]);
    };

    return (
        <input
            type="range"
            className={cn(
                "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary transition-all duration-200 hover:brightness-110",
                className
            )}
            value={val}
            onChange={handleChange}
            max={max}
            step={step}
            ref={ref}
            {...props}
        />
    )
})
Slider.displayName = "Slider"

export { Slider }
