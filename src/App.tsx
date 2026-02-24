import React, { useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Play, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Activity, Hand, ShieldAlert, Footprints, GraduationCap, Sparkles, Edit } from 'lucide-react';
import { RobotAnimator } from './lib/RobotAnimator';
import { Robot3D } from './components/Robot3D';
import { GaitVisualizer } from './pages/GaitVisualizer';
import { ActionGeneratorModal } from './components/ActionGeneratorModal';
import { ActionParser } from './lib/ActionParser';
import type { ActionScript } from './lib/ActionParser';

export default function App() {
  const [currentView, setCurrentView] = useState<'simulator' | 'visualizer'>('simulator');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<{ id: string, name: string, prompt: string } | null>(null);

  const animator = useMemo(() => {
    const anim = new RobotAnimator();
    anim.isInfiniteLoop = false;
    return anim;
  }, []);
  const [activeAction, setActiveAction] = useState<string>('home');
  const [dynamicActions, setDynamicActions] = useState<any[]>([]);

  const actions = [
    { id: 'home', label: 'Home', icon: RotateCcw, fn: () => animator.home() },
    { id: 'forward', label: 'Forward', icon: ArrowUp, fn: () => animator.forward() },
    { id: 'backward', label: 'Backward', icon: ArrowDown, fn: () => animator.backward() },
    { id: 'turn_L', label: 'Turn Left', icon: ArrowLeft, fn: () => animator.turn_L() },
    { id: 'turn_R', label: 'Turn Right', icon: ArrowRight, fn: () => animator.turn_R() },
    { id: 'walk', label: 'Walk (Step)', icon: Footprints, fn: () => animator.walk() },
    { id: 'walk1', label: 'Walk (Smooth)', icon: Footprints, fn: () => animator.walk1() },
    { id: 'omni_walk', label: 'Omni Walk', icon: Activity, fn: () => animator.omni_walk() },
    { id: 'front_back', label: 'Front Back', icon: ArrowUp, fn: () => animator.front_back() },
    { id: 'moonwalk_L', label: 'Moonwalk L', icon: ArrowLeft, fn: () => animator.moonwalk_L() },
    { id: 'up_down', label: 'Up Down', icon: Activity, fn: () => animator.up_down() },
    { id: 'dance', label: 'Dance', icon: Activity, fn: () => animator.dance() },
    { id: 'push_up', label: 'Push Up', icon: Footprints, fn: () => animator.push_up() },
    { id: 'hello', label: 'Hello', icon: Hand, fn: () => animator.hello() },
    { id: 'wave_hand', label: 'Wave Hand', icon: Hand, fn: () => animator.wave_hand() },
    { id: 'hide', label: 'Hide', icon: ShieldAlert, fn: () => animator.hide() },
    { id: 'scared', label: 'Scared', icon: ShieldAlert, fn: () => animator.scared() },
    { id: 'frog_jump', label: 'Frog Jump', icon: ArrowUp, fn: () => animator.frog_jump() },
    { id: 'relax', label: 'Relax', icon: ArrowDown, fn: () => animator.relax() },
    { id: 'relax2', label: 'Relax 2', icon: ArrowDown, fn: () => animator.relax2() },
  ];

  const handleAction = (action: any) => {
    setActiveAction(action.id);
    action.fn();
  };

  const handleNewActionGenerated = (actionData: { name: string, script: ActionScript, prompt: string, id?: string }) => {
    try {
      // Step 1: Translate semantic DSL → raw servo JS via ActionParser (sandboxed)
      const rawJsCode = ActionParser.generateAnimScript(actionData.script);
      console.log("ActionParser generated JS:", rawJsCode);

      // Step 2: Wrap into an executable function
      const actionFn = new Function('animator', rawJsCode);

      if (actionData.id) {
        // Update existing action
        setDynamicActions(prev => prev.map(a =>
          a.id === actionData.id
            ? { ...a, label: actionData.name, prompt: actionData.prompt, fn: () => actionFn(animator) }
            : a
        ));
        // Re-trigger the updated action if it was active
        if (activeAction === actionData.id) {
          actionFn(animator);
        }
      } else {
        // Add new action
        const newAction = {
          id: `custom_${Date.now()}`,
          label: actionData.name,
          prompt: actionData.prompt,
          icon: Sparkles,
          fn: () => actionFn(animator)
        };
        setDynamicActions(prev => [...prev, newAction]);
        handleAction(newAction);
      }
      setEditingAction(null);
    } catch (e) {
      console.error("Failed to parse/execute generated action:", e);
      alert("执行生成的代码时出错：" + e);
    }
  };

  if (currentView === 'visualizer') {
    return <GaitVisualizer onGoBack={() => setCurrentView('simulator')} />;
  }

  // --- Main Simulator View ---
  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-[#1e293b] overflow-hidden font-sans">
      {/* Sidebar Controls */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col z-10 shadow-xl">
        <div className="p-6 border-b border-slate-100 relative">
          <h1 className="text-xl font-bold tracking-tight mb-1 text-slate-900">QuadBot Sim</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">8-Servo Kinematics</p>

          <button
            onClick={() => setCurrentView('visualizer')}
            className="mt-4 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors border border-indigo-200 shadow-sm"
          >
            <GraduationCap size={16} />
            <span>Gait Lab & Visualizer</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all font-semibold"
          >
            <Sparkles size={18} />
            <span>AI 新增动作</span>
          </button>

          {dynamicActions.length > 0 && (
            <div className="mt-6 mb-2">
              <div className="text-[10px] text-blue-500 uppercase tracking-widest mb-3 font-bold">Generated Actions</div>
              <div className="space-y-2">
                {dynamicActions.map((action) => {
                  const Icon = action.icon;
                  const isActive = activeAction === action.id;
                  return (
                    <div
                      key={action.id}
                      className={`group w-full flex items-center justify-between rounded-lg transition-all duration-200 border border-blue-100 ${isActive
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                        }`}
                    >
                      <button
                        onClick={() => handleAction(action)}
                        className="flex-1 flex items-center space-x-3 px-4 py-3 text-left overflow-hidden uppercase"
                      >
                        <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="text-sm font-semibold truncate">{action.label}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAction({ id: action.id, name: action.label, prompt: action.prompt });
                          setIsModalOpen(true);
                        }}
                        className="p-3 text-slate-400 hover:text-blue-600 transition-colors"
                        title="编辑动作描述"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-4 mt-6 font-bold">Default Commands</div>
          {actions.map((action) => {
            const Icon = action.icon;
            const isActive = activeAction === action.id;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span className="text-sm font-semibold">{action.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Status</span>
            <span className="flex items-center text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              Online
            </span>
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas shadows camera={{ position: [10, 8, 10], fov: 45 }}>
          <color attach="background" args={['#f8fafc']} />
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          <Robot3D animator={animator} />

          <ContactShadows position={[0, -0.1, 0]} opacity={0.3} scale={20} blur={2.5} far={4.5} />

          {/* Grid floor */}
          <gridHelper args={[50, 50, '#cbd5e1', '#e2e8f0']} position={[0, -0.01, 0]} />

          <OrbitControls
            makeDefault
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2 - 0.05}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>

        {/* Overlay UI */}
        <div className="absolute top-6 right-6 pointer-events-none">
          <div className="bg-white/80 backdrop-blur border border-slate-200 p-4 rounded-xl shadow-lg">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Current Action</div>
            <div className="text-lg font-bold text-blue-600">
              {actions.find(a => a.id === activeAction)?.label ||
                dynamicActions.find(a => a.id === activeAction)?.label ||
                'None'}
            </div>
          </div>
        </div>
      </div>

      <ActionGeneratorModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAction(null);
        }}
        onActionGenerated={handleNewActionGenerated}
        initialData={editingAction}
      />
    </div>
  );
}
