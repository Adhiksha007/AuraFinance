import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Torus, Float, Stars, Sparkles, Text as DreiText, Sphere, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// Satellite component that orbits at a fixed radius
function Satellite({ radius, speed, color, offset = 0, axisRotation = [0, 0, 0] }: { radius: number, speed: number, color: string, offset?: number, axisRotation?: [number, number, number] }) {
    const satRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (satRef.current) {
            satRef.current.rotation.z = state.clock.getElapsedTime() * speed + offset;
        }
    });

    return (
        // The group handles the rotation (orbit)
        <group ref={satRef} rotation={axisRotation as any}>
            {/* The sphere is offset by radius to sit on the ring path */}
            <Sphere args={[0.15, 16, 16]} position={[radius, 0, 0]}>
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={2}
                    toneMapped={false}
                />
            </Sphere>
        </group>
    );
}

function AuraCore() {
    const coreRef = useRef<THREE.Mesh>(null);
    const ring1Ref = useRef<THREE.Group>(null);
    const ring2Ref = useRef<THREE.Group>(null);
    const ring3Ref = useRef<THREE.Group>(null);
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // Mouse interaction
        // state.mouse.x values are -1 to 1.
        // We want a subtle rotation, maybe max 0.5 radians (~30 degrees).
        const targetX = state.mouse.x * 0.5;
        const targetY = state.mouse.y * 0.5;

        if (groupRef.current) {
            // Smoothly interpolate current rotation to target mouse rotation
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetX, 0.1);
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -targetY, 0.1);
        }

        if (coreRef.current) {
            // Pulse the core
            const scale = 1 + Math.sin(time * 2) * 0.05;
            coreRef.current.scale.setScalar(scale);
        }

        if (ring1Ref.current) {
            ring1Ref.current.rotation.x = time * 0.2;
            ring1Ref.current.rotation.y = time * 0.3;
        }

        if (ring2Ref.current) {
            ring2Ref.current.rotation.x = -time * 0.25;
            ring2Ref.current.rotation.y = time * 0.1;
        }

        if (ring3Ref.current) {
            ring3Ref.current.rotation.x = time * 0.15;
            ring3Ref.current.rotation.z = time * 0.2;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Central Glowing Dollar Sign */}
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                {/* Main Visible Text */}
                <DreiText
                    ref={coreRef as any}
                    fontSize={2.5}
                    font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                    anchorX="center"
                    anchorY="middle"
                >
                    $
                    <meshPhysicalMaterial
                        color="#10b981" // Emerald-500
                        emissive="#059669" // Emerald-600
                        emissiveIntensity={0.8}
                        roughness={0.1}
                        metalness={0.8}
                        clearcoat={1}
                        clearcoatRoughness={0.1}
                    />
                </DreiText>

                {/* Shadow Caster Stack - Simulates Volume */}
                {Array.from({ length: 8 }).map((_, i) => (
                    <DreiText
                        key={i}
                        fontSize={2.5}
                        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                        anchorX="center"
                        anchorY="middle"
                        // Stack centered around 0 (from -0.2 to +0.2)
                        position={[0, 0, (i - 3.5) * 0.05]}
                    >
                        $
                        <meshBasicMaterial color="#000000" opacity={0} transparent />
                    </DreiText>
                ))}
            </Float>

            {/* Ring 1 - White Glass */}
            <group ref={ring1Ref}>
                <Torus args={[2.2, 0.05, 16, 100]} rotation={[0.5, 0, 0]}>
                    <meshPhysicalMaterial
                        color="#ffffff"
                        transmission={0.9}
                        opacity={0.5}
                        transparent
                        roughness={0}
                        metalness={0}
                        ior={1.5}
                        thickness={0.1}
                    />
                </Torus>
                {/* Satellite for Ring 1 - Needs to match rotation [0.5, 0, 0] of the Torus */}
                <Satellite radius={2.2} speed={1.5} color="#ffffff" axisRotation={[0.5, 0, 0]} />
            </group>

            {/* Ring 2 - Emerald */}
            <group ref={ring2Ref} rotation={[0, 0, Math.PI / 3]}>
                <Torus args={[2.8, 0.03, 16, 100]}>
                    <meshPhysicalMaterial
                        color="#34d399" // Emerald-400
                        emissive="#34d399"
                        emissiveIntensity={2}
                        toneMapped={false}
                    />
                </Torus>
                <Satellite radius={2.8} speed={-1.2} color="#34d399" />
            </group>

            {/* Ring 3 - Gold */}
            <group ref={ring3Ref} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
                <Torus args={[3.5, 0.02, 16, 100]}>
                    <meshStandardMaterial
                        color="#fbbf24" // Amber/Gold accent
                        emissive="#fbbf24"
                        emissiveIntensity={1}
                    />
                </Torus>
                <Satellite radius={3.5} speed={1} color="#fbbf24" offset={2} />
            </group>

            {/* Floating Particles */}
            <Sparkles count={50} scale={6} size={4} speed={0.4} opacity={0.5} color="#10b981" />
        </group>
    );
}

export default function FinanceScene() {
    return (
        <>
            {/* Lights - Additive to the parent scene's lights, creating a specific mood */}
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#ecfdf5" />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#047857" />
            <spotLight position={[0, 10, 0]} intensity={0.8} angle={0.5} penumbra={1} />

            <group scale={0.65}>
                <AuraCore />
            </group>

            <ContactShadows
                position={[0, -2.5, 0]}
                opacity={0.9}
                scale={6}
                blur={2}
                far={10}
                resolution={720}
                color="#000000"
            />

            <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
        </>
    );
}
