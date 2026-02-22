import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Circle, Edges, Text, Ring } from '@react-three/drei';
import * as THREE from 'three';
import { RobotAnimator } from '../lib/RobotAnimator';

export const legColors = {
    FR: { hip: '#ef4444', knee: '#f87171', name: 'Front-Right (Red)' },
    FL: { hip: '#22c55e', knee: '#4ade80', name: 'Front-Left (Green)' },
    BR: { hip: '#3b82f6', knee: '#60a5fa', name: 'Back-Right (Blue)' },
    BL: { hip: '#f97316', knee: '#fb923c', name: 'Back-Left (Orange)' }
};

export const Leg = ({
    position, isLeft, isFront, hipRef, legRef, footRef,
    hipColor, kneeColor, hipKey, kneeKey,
    hoveredServo, selectedServo, onHover, onClick,
    hipState, kneeState
}: any) => {
    const dirX = isLeft ? -1 : 1;
    const dirZ = isFront ? 1 : -1;
    const plateColor = "#334155"; // slate-700
    const stickerColor = "#db2777"; // pink-ish
    const isHipHovered = hoveredServo === hipKey;
    const isKneeHovered = hoveredServo === kneeKey;
    const isHipSelected = selectedServo === hipKey;
    const isKneeSelected = selectedServo === kneeKey;

    const showHipHighlight = isHipSelected || (isHipHovered && !selectedServo);
    const showKneeHighlight = isKneeSelected || (isKneeHovered && !selectedServo);

    // 45-degree outward base rotation to reflect the physical robot's chassis mold
    const baseRotationY = -(dirX * dirZ) * (Math.PI / 4);

    // Helper to draw the arc for a given motor state
    const SemanticOverlay = ({
        state, plane, radius, color, zeroAngle, multiplier
    }: {
        state: any, plane: 'XY' | 'XZ' | 'YZ', radius: number, color: string, zeroAngle: number, multiplier: number
    }) => {
        if (!state || state.mode !== 'oscillate' || state.A === 0) return null;

        const toRad = Math.PI / 180;

        // Abstract values relative to conceptual 90 deg center
        const deltaO = state.O * multiplier;
        const deltaPos = (state.pos - 90) * multiplier;
        const ampRad = state.A * toRad;

        // Mapped physical angles in radians
        const baseRot = zeroAngle * toRad;
        const sweepCenter = baseRot + (deltaO * toRad);
        const posAngle = baseRot + (deltaPos * toRad);

        const startAngle = sweepCenter - ampRad;
        const endAngle = sweepCenter + ampRad;
        const thetaLength = ampRad * 2;
        const sweepStart = Math.min(startAngle, endAngle);

        // Rotaion helper for the main sector
        const rotation: [number, number, number] =
            plane === 'XZ' ? [Math.PI / 2, 0, sweepStart] :
                plane === 'XY' ? [0, 0, sweepStart] :
                    [0, Math.PI / 2, sweepStart];

        // Helper to get 3D coords from an angle on the plane
        const getPos = (ang: number, r: number = radius): [number, number, number] => {
            if (plane === 'XZ') return [Math.cos(ang) * r, 0, -Math.sin(ang) * r];
            if (plane === 'XY') return [Math.cos(ang) * r, Math.sin(ang) * r, 0];
            return [0, Math.sin(ang) * r, Math.cos(ang) * r];
        };

        // Helper rotation for text to stand upright depending on plane
        const textRotation: [number, number, number] = plane === 'XZ' ? [-Math.PI / 2, 0, 0] : [0, 0, 0];

        return (
            <group>
                {/* Zero Line (Abstract 0°) */}
                <Line points={[[0, 0, 0], getPos(baseRot, radius * 1.5)]} color="white" lineWidth={1} dashed dashSize={0.1} gapSize={0.1} />
                <Text position={getPos(baseRot, radius * 1.7)} rotation={textRotation} fontSize={0.2} color="white" anchorX="center" anchorY="middle">
                    0° Zero
                </Text>

                {/* Amplitude Sector (Deep Color) */}
                <Circle args={[radius, 32, 0, thetaLength]} rotation={rotation}>
                    <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} depthTest={false} />
                    <Edges color={color} threshold={15} scale={1.01} />
                </Circle>

                {/* Offset Line */}
                <Line points={[[0, 0, 0], getPos(sweepCenter, radius * 1.3)]} color={color} lineWidth={3} dashed dashSize={0.2} gapSize={0.1} depthTest={false} />
                <Text position={getPos(sweepCenter, radius * 1.5)} rotation={textRotation} fontSize={0.25} color={color} anchorX="center" anchorY="middle" fontWeight="bold">
                    Offset: {state.O.toFixed(1)}°
                </Text>

                {/* Amp Bounds Text */}
                <group>
                    <Text position={getPos(startAngle, radius * 1.1)} rotation={textRotation} fontSize={0.18} color={color} anchorX="center" anchorY="middle">
                        -Amp
                    </Text>
                    <Text position={getPos(endAngle, radius * 1.1)} rotation={textRotation} fontSize={0.18} color={color} anchorX="center" anchorY="middle">
                        +Amp
                    </Text>
                </group>

                {/* Dynamic Position Pointer (Pos) */}
                <Line points={[[0, 0, 0], getPos(posAngle, radius * 1.1)]} color="#ffffff" lineWidth={4} depthTest={false} />
                <mesh position={getPos(posAngle, radius * 1.13)}>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
                <Text position={getPos(posAngle, radius * 1.4)} rotation={textRotation} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" outlineWidth={0.02} outlineColor="#000000">
                    Pos: {state.pos.toFixed(1)}°
                </Text>
            </group>
        );
    };
    return (
        <group position={position} rotation={[0, baseRotationY, 0]}>
            <group ref={hipRef}>
                {/* Hip Servo Body */}
                <mesh
                    position={[dirX * 0.4, 0, 0]}
                    castShadow
                    onPointerOver={(e) => { e.stopPropagation(); onHover?.(hipKey); }}
                    onPointerOut={(e) => { e.stopPropagation(); onHover?.(null); }}
                    onClick={(e) => { e.stopPropagation(); onClick?.(hipKey); }}
                >
                    <boxGeometry args={[0.8, 1.2, 1.2]} />
                    <meshStandardMaterial color={hipColor} emissive={hipColor} emissiveIntensity={showHipHighlight ? 0.8 : 0} />
                </mesh>

                {/* Hip Semantic Overlay (XZ Plane relative to joint) */}
                {isHipSelected && (
                    <group position={[dirX * 0.4, 1.0, 0]}>
                        <SemanticOverlay state={hipState} plane="XZ" radius={1.5} color={hipColor} zeroAngle={dirX === 1 ? 0 : 180} multiplier={1} />
                    </group>
                )}

                {/* Hip Link (Coxa) */}
                <mesh position={[dirX * 1.5, 0.5, 0]} castShadow>
                    <boxGeometry args={[2.0, 0.15, 0.8]} />
                    <meshStandardMaterial color={plateColor} />
                </mesh>
                <mesh position={[dirX * 1.5, -0.5, 0]} castShadow>
                    <boxGeometry args={[2.0, 0.15, 0.8]} />
                    <meshStandardMaterial color={plateColor} />
                </mesh>

                {/* Leg Servo Body */}
                <mesh
                    position={[dirX * 2.6, 0, 0]}
                    castShadow
                    onPointerOver={(e) => { e.stopPropagation(); onHover?.(kneeKey); }}
                    onPointerOut={(e) => { e.stopPropagation(); onHover?.(null); }}
                    onClick={(e) => { e.stopPropagation(); onClick?.(kneeKey); }}
                >
                    <boxGeometry args={[0.8, 1.2, 1.2]} />
                    <meshStandardMaterial color={kneeColor} emissive={kneeColor} emissiveIntensity={showKneeHighlight ? 0.8 : 0} />
                </mesh>

                {/* Knee Semantic Overlay (XY Plane relative to joint wrapper) */}
                {isKneeSelected && (
                    <group position={[dirX * 2.6, 0.8, 0]}>
                        <SemanticOverlay state={kneeState} plane="XY" radius={2.0} color={kneeColor} zeroAngle={-90} multiplier={isFront ? -1 : 1} />
                    </group>
                )}
                {/* Servo Sticker */}
                <mesh position={[dirX * 2.6, 0, dirZ * 0.61]} castShadow>
                    <planeGeometry args={[0.6, 0.8]} />
                    <meshStandardMaterial color={stickerColor} />
                </mesh>

                {/* Leg Joint (Tibia) */}
                <group position={[dirX * 3.0, 0, 0]} ref={legRef}>
                    <mesh position={[dirX * 0.1, -1.5, 0]} castShadow>
                        <boxGeometry args={[0.2, 3.5, 0.8]} />
                        <meshStandardMaterial color={plateColor} />
                    </mesh>
                    {/* Pointy end */}
                    <mesh position={[dirX * 0.1, -3.25, 0]} castShadow>
                        <cylinderGeometry args={[0.1, 0.05, 0.5, 8]} />
                        <meshStandardMaterial color={plateColor} />
                    </mesh>
                    {/* Foot Contact Point */}
                    <group position={[dirX * 0.1, -3.5, 0]} ref={footRef} />
                </group>
            </group>
        </group>
    );
};

export const Robot3D = ({
    animator,
    disableTranslation = false,
    hoveredServo = null,
    selectedServo = null,
    onHoverServo,
    onSelectServo
}: {
    animator: RobotAnimator;
    disableTranslation?: boolean;
    hoveredServo?: string | null;
    selectedServo?: string | null;
    onHoverServo?: (servoKey: string | null) => void;
    onSelectServo?: (servoKey: string | null) => void;
}) => {
    const robotBaseRef = useRef<THREE.Group>(null);

    const frhRef = useRef<THREE.Group>(null);
    const flhRef = useRef<THREE.Group>(null);
    const frlRef = useRef<THREE.Group>(null);
    const fllRef = useRef<THREE.Group>(null);
    const brhRef = useRef<THREE.Group>(null);
    const blhRef = useRef<THREE.Group>(null);
    const brlRef = useRef<THREE.Group>(null);
    const bllRef = useRef<THREE.Group>(null);

    const frfRef = useRef<THREE.Group>(null);
    const flfRef = useRef<THREE.Group>(null);
    const brfRef = useRef<THREE.Group>(null);
    const blfRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        const { positions, velocity, resetBase } = animator.update(delta * 1000);
        const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);

        if (flhRef.current) flhRef.current.rotation.y = toRad(positions[0]);
        if (frhRef.current) frhRef.current.rotation.y = toRad(positions[1]);
        if (blhRef.current) blhRef.current.rotation.y = toRad(positions[4]);
        if (brhRef.current) brhRef.current.rotation.y = toRad(positions[5]);

        if (fllRef.current) fllRef.current.rotation.z = -toRad(positions[2]);
        if (frlRef.current) frlRef.current.rotation.z = -toRad(positions[3]);
        if (bllRef.current) bllRef.current.rotation.z = toRad(positions[6]);
        if (brlRef.current) brlRef.current.rotation.z = toRad(positions[7]);

        if (robotBaseRef.current) {
            if (resetBase) {
                robotBaseRef.current.position.set(0, 4.2, 0);
                robotBaseRef.current.rotation.set(0, 0, 0);
                animator.resetBase = false;
            } else if (!disableTranslation) {
                // Only apply world translations and rotations if not disabled
                robotBaseRef.current.rotation.y += velocity.rY * delta;
                robotBaseRef.current.translateZ(velocity.z * delta);
                robotBaseRef.current.translateX(velocity.x * delta);
            }

            // Always apply the vertical shifting to keep feet on ground natively
            if (flfRef.current && frfRef.current && blfRef.current && brfRef.current) {
                robotBaseRef.current.updateMatrixWorld(true);
                const v = new THREE.Vector3();
                frfRef.current.getWorldPosition(v); const y1 = v.y;
                flfRef.current.getWorldPosition(v); const y2 = v.y;
                brfRef.current.getWorldPosition(v); const y3 = v.y;
                blfRef.current.getWorldPosition(v); const y4 = v.y;

                const minFootY = Math.min(y1, y2, y3, y4);
                const targetShift = -minFootY;

                robotBaseRef.current.position.y += targetShift * (delta * 15);
            }
        }
    });

    return (
        <group position={[0, 4.2, 0]} ref={robotBaseRef}>
            {/* Body Top Plate */}
            <mesh position={[0, 0.6, 0]} castShadow>
                <boxGeometry args={[3.5, 0.15, 5]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>

            {/* Body Bottom Plate */}
            <mesh position={[0, -0.6, 0]} castShadow>
                <boxGeometry args={[3.5, 0.15, 5]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>

            {/* Standoffs */}
            {[-1.5, 1.5].map(x =>
                [-2, 2].map(z => (
                    <mesh key={`${x}-${z}`} position={[x, 0, z]} castShadow>
                        <cylinderGeometry args={[0.1, 0.1, 1.2, 8]} />
                        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
                    </mesh>
                ))
            )}

            {/* Electronics Board (Arduino/Shield) */}
            <mesh position={[0, 0.1, 0]} castShadow>
                <boxGeometry args={[2.5, 0.4, 3.5]} />
                <meshStandardMaterial color="#1e293b" />
            </mesh>

            {/* Eyes / Ultrasonic sensor */}
            <group position={[0, 0.2, 2.6]}>
                <mesh position={[0, 0, 0]} castShadow>
                    <boxGeometry args={[2, 1, 0.2]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                <mesh position={[-0.5, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0.5, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
                </mesh>
            </group>

            <Leg position={[1.75, 0, 2.0]} isLeft={false} isFront={true} hipRef={flhRef} legRef={fllRef} footRef={flfRef}
                hipColor={legColors.FL.hip} kneeColor={legColors.FL.knee} hipKey="FL_Hip" kneeKey="FL_Knee"
                hoveredServo={hoveredServo} selectedServo={selectedServo} onHover={onHoverServo} onClick={onSelectServo}
                hipState={animator.servos[0]} kneeState={animator.servos[2]} />
            <Leg position={[-1.75, 0, 2.0]} isLeft={true} isFront={true} hipRef={frhRef} legRef={frlRef} footRef={frfRef}
                hipColor={legColors.FR.hip} kneeColor={legColors.FR.knee} hipKey="FR_Hip" kneeKey="FR_Knee"
                hoveredServo={hoveredServo} selectedServo={selectedServo} onHover={onHoverServo} onClick={onSelectServo}
                hipState={animator.servos[1]} kneeState={animator.servos[3]} />
            <Leg position={[1.75, 0, -2.0]} isLeft={false} isFront={false} hipRef={blhRef} legRef={bllRef} footRef={blfRef}
                hipColor={legColors.BL.hip} kneeColor={legColors.BL.knee} hipKey="BL_Hip" kneeKey="BL_Knee"
                hoveredServo={hoveredServo} selectedServo={selectedServo} onHover={onHoverServo} onClick={onSelectServo}
                hipState={animator.servos[4]} kneeState={animator.servos[6]} />
            <Leg position={[-1.75, 0, -2.0]} isLeft={true} isFront={false} hipRef={brhRef} legRef={brlRef} footRef={brfRef}
                hipColor={legColors.BR.hip} kneeColor={legColors.BR.knee} hipKey="BR_Hip" kneeKey="BR_Knee"
                hoveredServo={hoveredServo} selectedServo={selectedServo} onHover={onHoverServo} onClick={onSelectServo}
                hipState={animator.servos[5]} kneeState={animator.servos[7]} />
        </group>
    );
};
