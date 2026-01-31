import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Ring({ progress, color }: { progress: number; color: string }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((_state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.z -= delta * 0.2;
        }
    });

    // Calculate arc length based on progress (0 to 1) -> 0 to 2*PI presumably, 
    // but usually gauges are partial circles. Let's do a full ring for simplicity 
    // or a torus with a segment? TorusGeometry allows arc.
    // arc = progress * 2 * Math.PI

    return (
        <mesh ref={meshRef}>
            <torusGeometry args={[2.5, 0.2, 16, 100, progress * Math.PI * 2]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
    );
}

function BackRing() {
    return (
        <mesh>
            <torusGeometry args={[2.5, 0.15, 16, 100, Math.PI * 2]} />
            <meshStandardMaterial color="#334155" transparent opacity={0.3} />
        </mesh>
    )
}

interface ProbabilityGaugeProps {
    percentage: number; // 0 to 100
}

export const ProbabilityGauge: React.FC<ProbabilityGaugeProps> = ({ percentage }) => {
    const norm = Math.min(Math.max(percentage, 0), 100) / 100;

    // Color logic
    let color = "#ef4444"; // red
    if (percentage >= 80) color = "#10b981"; // emerald
    else if (percentage >= 50) color = "#f97316"; // orange

    return (
        <div className="w-full h-64 relative flex items-center justify-center">
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 8] }}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />
                    <BackRing />
                    <Ring progress={norm} color={color} />
                </Canvas>
            </div>
            <div className="relative z-10 text-center">
                <span className="text-4xl font-bold text-foreground transition-all duration-300">
                    {percentage}%
                </span>
                <p className="text-sm text-muted-foreground">Probability</p>
            </div>
        </div>
    );
};
