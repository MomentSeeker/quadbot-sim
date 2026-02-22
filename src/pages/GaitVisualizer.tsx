import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { RobotAnimator } from '../lib/RobotAnimator';
import { Robot3D, legColors } from '../components/Robot3D';
import { RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Activity, Hand, ShieldAlert, Footprints, Play, Pause, FastForward, StepForward, StepBack, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

export const GaitVisualizer = ({ onGoBack }: { onGoBack: () => void }) => {
    const animator = useMemo(() => {
        const anim = new RobotAnimator();
        anim.playbackSpeed = 0.1;
        return anim;
    }, []);
    const [activeAction, setActiveAction] = useState<string>('home');
    const [currentServos, setCurrentServos] = useState<any[]>(animator.servos);
    const [isPaused, setIsPaused] = useState(false);
    const [speed, setSpeed] = useState(0.1);
    const [time, setTime] = useState(0);
    const [hoveredServo, setHoveredServo] = useState<string | null>(null);
    const [selectedServo, setSelectedServo] = useState<string | null>(null);
    const [isLoop, setIsLoop] = useState(true);

    const controlsRef = useRef<any>(null);

    const adjustCameraHeight = (delta: number) => {
        if (controlsRef.current) {
            controlsRef.current.object.position.y += delta;
            controlsRef.current.target.y += delta;
            controlsRef.current.update();
        }
    };

    // Draggable Panel State
    const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        dragStart.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging.current) {
            setPanelPos({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
            });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Sync loop state to animator
    useEffect(() => {
        animator.isInfiniteLoop = isLoop;
    }, [animator, isLoop]);

    const actions = [
        { id: 'home', label: 'Home (Rest)', icon: RotateCcw, fn: () => animator.home(), desc: 'Returns all servos to their neutral 90-degree position.' },
        { id: 'forward', label: 'Forward Walk', icon: ArrowUp, fn: () => animator.forward(), desc: 'Standard forward gait. Front and back legs are out of phase by 180° to provide continuous propulsion.' },
        { id: 'backward', label: 'Backward Walk', icon: ArrowDown, fn: () => animator.backward(), desc: 'Reverse of forward walk. Phases are adjusted to pull the body backwards.' },
        { id: 'turn_L', label: 'Turn Left', icon: ArrowLeft, fn: () => animator.turn_L(), desc: 'Left legs and right legs move in opposite phases (differential steering) to rotate the body counter-clockwise.' },
        { id: 'turn_R', label: 'Turn Right', icon: ArrowRight, fn: () => animator.turn_R(), desc: 'Right legs and left legs move in opposite phases to rotate the body clockwise.' },
        { id: 'moonwalk_L', label: 'Moonwalk Left', icon: ArrowLeft, fn: () => animator.moonwalk_L(), desc: 'A trick gait where horizontal amplitude is 0, but Z-axis lifting and offset shifting creates an illusion of sliding.' },
        { id: 'dance', label: 'Dance', icon: Activity, fn: () => animator.dance(), desc: 'A stationary gait that rapidly shifts Z-axis (height) with varying phases to create a bobbing motion.' },
        { id: 'push_up', label: 'Push Up', icon: Footprints, fn: () => animator.push_up(), desc: 'Locks the back legs (0 amplitude) and aggressively oscillates the front legs in the Z and X axes.' },
        { id: 'scared', label: 'Scared (Keyframes)', icon: ShieldAlert, fn: () => animator.scared(), desc: 'Not an oscillator gait, but keyframe based. Instantly drops Z height, then wildly extends all legs.' },
        { id: 'frog_jump', label: 'Frog Jump', icon: ArrowUp, fn: () => animator.frog_jump(), desc: 'A 4-stage action that squats down, pushes off the back legs, and then powerfully thrusts the front legs while tucking in mid-air.' },
        { id: 'relax', label: 'Relax', icon: ArrowDown, fn: () => animator.relax(), desc: 'Folds the legs inward sequentially (Right Front, Left Front, Left Hind, Right Hind) to a relaxed resting posture.' }
    ];

    const handleAction = (action: any) => {
        setActiveAction(action.id);
        action.fn();
        // Auto-resume on new action
        if (isPaused) togglePause();
    };

    const togglePause = () => {
        animator.isPaused = !animator.isPaused;
        setIsPaused(animator.isPaused);
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSpeed = parseFloat(e.target.value);
        animator.playbackSpeed = newSpeed;
        setSpeed(newSpeed);
    };

    const stepFrame = (ms: number) => {
        if (!isPaused) {
            togglePause();
        }
        animator.stepAhead(ms);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentServos([...animator.servos]);
            setTime(animator.timeMs);
        }, 50); // High refresh rate for smooth waves
        return () => clearInterval(interval);
    }, [animator]);

    const activeActionObj = actions.find(a => a.id === activeAction);

    // Helper component to draw the live sine wave logic
    const SpatialGraph = ({ servo, t, color }: { servo: any, t: number, color: string }) => {
        if (servo.mode !== 'oscillate' || servo.A === 0) {
            return (
                <div className="h-12 mt-2 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400 border border-slate-200">
                    No Oscillation
                </div>
            );
        }

        // SVG params
        const w = 100; // viewbox width
        const h = 40;  // viewbox height
        const midY = h / 2;

        // Draw the theoretical wave representing a full cycle of T
        const points = [];
        for (let i = 0; i <= w; i++) {
            const simTime = (i / w) * servo.T;
            const phase = (simTime / servo.T) * 2 * Math.PI;
            // Map sine value (-1 to 1) to SVG height, inverted Y
            const y = midY - Math.sin(phase + servo.Ph) * (h / 2) * 0.8;
            points.push(`${i},${y}`);
        }

        // Current point on the wave based on actual time
        const elapsed = t - servo.moveStartTime;
        const currentPhase = (elapsed / servo.T) * 2 * Math.PI;
        const normX = (elapsed % servo.T) / servo.T;
        const currX = normX * w;
        const currY = midY - Math.sin(currentPhase + servo.Ph) * (h / 2) * 0.8;

        return (
            <div className="h-12 mt-2 bg-white rounded border border-slate-200 relative overflow-hidden flex items-center cursor-crosshair">
                <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full opacity-50">
                    <line x1="0" y1={midY} x2={w} y2={midY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2" />
                    <polyline points={points.join(' ')} fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                    <circle cx={currX} cy={currY} r="5" fill={color} />
                </svg>
            </div>
        );
    };

    // Global Phase Radar to show temporal relationship between legs
    const GlobalPhaseRadar = ({ servos, t }: { servos: any[], t: number }) => {
        const size = 120;
        const center = size / 2;
        const radius = size * 0.35;

        // Track the Knee Z servos (dominant step phase)
        const dots = [
            { id: "左前", isLeft: true, isFront: true, color: legColors.FL.knee, servo: servos[2] }, // FL is now idx 2
            { id: "右前", isLeft: false, isFront: true, color: legColors.FR.knee, servo: servos[3] }, // FR is now idx 3
            { id: "左后", isLeft: true, isFront: false, color: legColors.BL.knee, servo: servos[6] }, // BL is now idx 6
            { id: "右后", isLeft: false, isFront: false, color: legColors.BR.knee, servo: servos[7] }, // BR is now idx 7
        ].filter(d => d.servo && d.servo.mode === 'oscillate' && d.servo.A > 0);

        if (dots.length === 0) return null;

        return (
            <div className="absolute bottom-6 left-6 z-10 bg-slate-900/80 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl flex flex-col items-center select-none pointer-events-none">
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-2 tracking-[0.2em]">Global Phase</div>
                <div className="relative" style={{ width: size, height: size }}>
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        {/* Background Orbit */}
                        <circle cx={center} cy={center} r={radius} fill="none" stroke="#334155" strokeWidth="4" />
                        <circle cx={center} cy={center} r={radius} fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />

                        {/* Crosshair markers */}
                        <line x1={center} y1={center - radius + 4} x2={center} y2={center - radius - 4} stroke="#cbd5e1" strokeWidth="2" />
                        <line x1={center} y1={center + radius - 4} x2={center} y2={center + radius + 4} stroke="#cbd5e1" strokeWidth="2" />
                        <line x1={center - radius + 4} y1={center} x2={center - radius - 4} y2={center} stroke="#cbd5e1" strokeWidth="2" />
                        <line x1={center + radius - 4} y1={center} x2={center + radius + 4} y2={center} stroke="#cbd5e1" strokeWidth="2" />

                        {/* Dynamic Marker Dots with overlap offset */}
                        {(() => {
                            // 1. Calculate and normalize phases for all dots
                            const dotsData = dots.map((dot) => {
                                const elapsed = t - dot.servo.moveStartTime;
                                let phase = (elapsed / dot.servo.T) * 2 * Math.PI + dot.servo.Ph;
                                if (dot.isLeft) phase += Math.PI;
                                if (dot.isFront) phase += Math.PI;
                                // Normalize 0 to 2PI
                                phase = phase % (2 * Math.PI);
                                if (phase < 0) phase += 2 * Math.PI;
                                return { ...dot, phase, radiusOffset: 0 };
                            });

                            // 2. Group into buckets to detect overlaps
                            const buckets: typeof dotsData[] = [];
                            dotsData.forEach(dot => {
                                let placed = false;
                                for (const bucket of buckets) {
                                    const diff = Math.abs(dot.phase - bucket[0].phase);
                                    const minDiff = Math.min(diff, 2 * Math.PI - diff);
                                    if (minDiff < 0.1) {
                                        bucket.push(dot);
                                        placed = true;
                                        break;
                                    }
                                }
                                if (!placed) {
                                    buckets.push([dot]);
                                }
                            });

                            // 3. Assign concentric radial offsets to overlapping dots
                            const radialOffsets = [0, 12, -12, 24]; // inner, outer, far-inner...
                            buckets.forEach(bucket => {
                                if (bucket.length === 2) {
                                    // For common 2-dot overlap, split them aesthetically
                                    bucket[0].radiusOffset = 10;
                                    bucket[1].radiusOffset = -10;
                                } else if (bucket.length > 2) {
                                    bucket.forEach((dot, idx) => {
                                        dot.radiusOffset = radialOffsets[idx] || 0;
                                    });
                                }
                            });

                            // 4. Render
                            return dotsData.map((dot) => {
                                const angle = dot.phase - Math.PI / 2;
                                const r = radius + dot.radiusOffset;
                                const x = center + r * Math.cos(angle);
                                const y = center + r * Math.sin(angle);

                                return (
                                    <g key={dot.id}>
                                        <circle cx={x} cy={y} r="8" fill={dot.color} stroke="#0f172a" strokeWidth="2" opacity={0.9} />
                                        <text
                                            x={x + (x > center ? 14 : -14)}
                                            y={y + (y > center ? 14 : -14)}
                                            fill={dot.color} fontSize="11" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle"
                                        >
                                            {dot.id}
                                        </text>
                                    </g>
                                )
                            });
                        })()}
                    </svg>
                </div>
            </div>
        );
    };

    // logical groupings by leg instead of flat array
    const legGroups = [
        {
            id: "FL",
            title: "左前腿 (Front-Left)",
            colorObj: legColors.FL,
            servos: [
                { key: "FL_Hip", label: "髋关节 (Hip X)", idx: 0, isHip: true }, // Was 1
                { key: "FL_Knee", label: "膝关节 (Knee Z)", idx: 2, isHip: false } // Was 3
            ]
        },
        {
            id: "FR",
            title: "右前腿 (Front-Right)",
            colorObj: legColors.FR,
            servos: [
                { key: "FR_Hip", label: "髋关节 (Hip X)", idx: 1, isHip: true }, // Was 0
                { key: "FR_Knee", label: "膝关节 (Knee Z)", idx: 3, isHip: false } // Was 2
            ]
        },
        {
            id: "BL",
            title: "左后腿 (Back-Left)",
            colorObj: legColors.BL,
            servos: [
                { key: "BL_Hip", label: "髋关节 (Hip X)", idx: 4, isHip: true }, // Was 5
                { key: "BL_Knee", label: "膝关节 (Knee Z)", idx: 6, isHip: false } // Was 7
            ]
        },
        {
            id: "BR",
            title: "右后腿 (Back-Right)",
            colorObj: legColors.BR,
            servos: [
                { key: "BR_Hip", label: "髋关节 (Hip X)", idx: 5, isHip: true }, // Was 4
                { key: "BR_Knee", label: "膝关节 (Knee Z)", idx: 7, isHip: false } // Was 6
            ]
        }
    ];

    return (
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden font-sans">

            {/* Sidebar: Action Selector */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-xl">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight mb-1 text-slate-900">Gait Visualizer</h1>
                        <p className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold">Interactive Lab</p>
                    </div>
                    <button
                        onClick={onGoBack}
                        className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded transition-colors shadow-sm"
                    >
                        ← Back
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-4 mt-2 font-bold px-2">Select Action</div>
                    {actions.map((action) => {
                        const Icon = action.icon;
                        const isActive = activeAction === action.id;
                        return (
                            <button
                                key={action.id}
                                onClick={() => handleAction(action)}
                                className={`w-full flex flex-col p-3 rounded-xl border transition-all duration-200 text-left ${isActive
                                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                                    : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                    }`}
                            >
                                <div className="flex items-center space-x-3 w-full">
                                    <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                                        <Icon size={16} />
                                    </div>
                                    <span className={`text-sm font-semibold ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>
                                        {action.label}
                                    </span>
                                </div>
                                {/* Description moved into the sidebar beneath the active item to prevent blocking the canvas */}
                                {isActive && (
                                    <div className="mt-3 text-xs text-slate-600 leading-relaxed pl-1">
                                        {action.desc}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative bg-slate-100">

                {/* Playback Controls (Top right floating, draggable) */}
                <div
                    className="absolute z-10 bg-white/90 backdrop-blur-md border border-slate-200 p-2 rounded-xl shadow-lg flex items-center gap-4 select-none"
                    style={{
                        top: '1.5rem', right: '1.5rem',
                        transform: `translate(${panelPos.x}px, ${panelPos.y}px)`,
                        touchAction: 'none' // Prevent scrolling while dragging on touch devices
                    }}
                >
                    {/* Drag Handle */}
                    <div
                        className="cursor-grab active:cursor-grabbing p-2 -ml-2 text-slate-400 hover:text-slate-600 self-stretch flex items-center justify-center border-r border-slate-100"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        title="Drag Panel"
                    >
                        <GripVertical size={16} />
                    </div>

                    {/* Step Back (disabled logically as engine goes forward only, just for UI symmetry right now OR implemented as negative step if we recorded state) */}
                    <button onClick={() => stepFrame(-20)} title="Rewind 20ms" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                        <StepBack size={18} />
                    </button>

                    <button onClick={togglePause} className={`p-3 rounded-full text-white shadow-md transition-all ${isPaused ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isPaused ? <Play size={20} className="ml-1" /> : <Pause size={20} />}
                    </button>

                    <button onClick={() => stepFrame(20)} title="Forward 20ms" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                        <StepForward size={18} />
                    </button>

                    <div className="w-px h-8 bg-slate-200 mx-2"></div>

                    <label className="flex flex-col items-center cursor-pointer min-w-[50px] group">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Loop</span>
                        <input
                            type="checkbox"
                            checked={isLoop}
                            onChange={(e) => setIsLoop(e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                    </label>

                    <div className="w-px h-8 bg-slate-200 mx-2"></div>

                    <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Speed: {speed.toFixed(1)}x</span>
                        <input
                            type="range" min="0.1" max="2.0" step="0.1" value={speed}
                            onChange={handleSpeedChange}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    <div className="w-px h-8 bg-slate-200 mx-2"></div>

                    {/* Camera Control */}
                    <div className="flex flex-col items-center min-w-[60px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Height</span>
                        <div className="flex gap-1">
                            <button onClick={() => adjustCameraHeight(2)} className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors" title="Move Camera Up">
                                <ChevronUp size={14} />
                            </button>
                            <button onClick={() => adjustCameraHeight(-2)} className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors" title="Move Camera Down">
                                <ChevronDown size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3D Canvas */}
                <div className="flex-1 relative">
                    <Canvas shadows camera={{ position: [10, 12, 10], fov: 55 }} onPointerMissed={() => setSelectedServo(null)}>
                        <color attach="background" args={['#f8fafc']} />
                        <ambientLight intensity={0.8} />
                        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
                        <pointLight position={[-10, -10, -10]} intensity={0.5} />

                        <Robot3D
                            animator={animator}
                            disableTranslation={true} // Keep robot in place
                            hoveredServo={hoveredServo}
                            selectedServo={selectedServo}
                            onHoverServo={setHoveredServo}
                            onSelectServo={setSelectedServo}
                        />

                        <ContactShadows position={[0, -0.1, 0]} opacity={0.4} scale={20} blur={2} far={4} />
                        <gridHelper args={[50, 50, '#cbd5e1', '#e2e8f0']} position={[0, -0.01, 0]} />

                        {/* Allowed free camera angle fully (removed maxPolarAngle) */}
                        <OrbitControls ref={controlsRef} target={[0, 0, 0]} makeDefault enableDamping dampingFactor={0.05} />
                    </Canvas>

                    {/* Global Phase Radar Overlay */}
                    <GlobalPhaseRadar servos={currentServos} t={time} />
                </div>

                {/* Bottom Parameter Data Panel (Grouped by Leg) */}
                <div className="bg-white border-t border-slate-200 shadow-2xl overflow-y-auto p-4 flex-shrink-0">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span>Live Spatial Deformation</span>
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px]">悬浮交互: 鼠标指向卡片或3D模型对应部位可高亮</span>
                        </h3>
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500 text-xs font-bold">t: {(time / 1000).toFixed(2)}s</span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {legGroups.map(leg => (
                            <div key={leg.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col">
                                <div
                                    className="text-xs font-bold mb-3 pb-2 border-b-2"
                                    style={{ color: leg.colorObj.hip, borderColor: `${leg.colorObj.hip}40` }}
                                >
                                    {leg.title}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {leg.servos.map(svo => {
                                        const servoData = currentServos[svo.idx];
                                        const isHovered = hoveredServo === svo.key;
                                        const isSelected = selectedServo === svo.key;
                                        const cColor = svo.isHip ? leg.colorObj.hip : leg.colorObj.knee;
                                        const isActiveUI = isHovered || isSelected;

                                        return (
                                            <div
                                                key={svo.key}
                                                onMouseEnter={() => setHoveredServo(svo.key)}
                                                onMouseLeave={() => setHoveredServo(null)}
                                                onClick={(e) => { e.stopPropagation(); setSelectedServo(isSelected ? null : svo.key); }}
                                                className={`bg-white rounded p-2 border transition-all duration-200 cursor-pointer ${isActiveUI ? 'shadow-md scale-[1.02] ring-2' : 'shadow-sm'}`}
                                                style={{ borderColor: isActiveUI ? cColor : `${cColor}40`, '--tw-ring-color': `${cColor}60` } as React.CSSProperties}
                                            >
                                                <div className="text-[10px] font-bold text-slate-700 truncate mb-2 flex justify-between items-center">
                                                    <span>{svo.label}</span>
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cColor }}></span>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-500">Amp</span>
                                                        <span className="text-slate-800 font-mono font-bold">{servoData.A.toFixed(1)}°</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-500">Offset</span>
                                                        <span className="text-slate-800 font-mono font-bold">{servoData.O.toFixed(1)}°</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-500">Phase</span>
                                                        <span className="text-slate-800 font-mono font-bold">{(servoData.Ph * 180 / Math.PI).toFixed(0)}°</span>
                                                    </div>
                                                </div>

                                                {/* Spatial Viz Graph */}
                                                <SpatialGraph servo={servoData} t={time} color={cColor} />

                                                {/* Physical Position Output */}
                                                <div className="mt-2 text-[10px] text-center bg-slate-50 rounded py-1 border border-slate-100 transition-colors"
                                                    style={isActiveUI ? { backgroundColor: `${cColor}15`, borderColor: `${cColor}40` } : {}}>
                                                    <span className="font-mono font-bold" style={{ color: cColor }}>Pos: {servoData.pos.toFixed(1)}°</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
