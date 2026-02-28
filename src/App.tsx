import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { Play, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Activity, Hand, ShieldAlert, Footprints, GraduationCap, Sparkles, Edit, Wifi, Settings, CheckCircle, XCircle, FolderOpen } from 'lucide-react';
import { RobotAnimator } from './lib/RobotAnimator';
import { Robot3D } from './components/Robot3D';
import { GaitVisualizer } from './pages/GaitVisualizer';
import { ActionGeneratorModal } from './components/ActionGeneratorModal';
import { ActionParser } from './lib/ActionParser';
import type { ActionScript } from './lib/ActionParser';

// ----------------------------------------------------------------
// Toast helper
// ----------------------------------------------------------------
interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

let _toastId = 0;

export default function App() {
  const [currentView, setCurrentView] = useState<'simulator' | 'visualizer'>('simulator');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<{ id: string, name: string, prompt: string } | null>(null);

  // Robot URL
  const [robotUrl, setRobotUrl] = useState<string>(() => localStorage.getItem('robot_base_url') || 'http://192.168.4.1');
  const [showRobotSettings, setShowRobotSettings] = useState(false);
  const [robotUrlInput, setRobotUrlInput] = useState<string>('');

  // Robot global toggle and connection state
  const [robotEnabled, setRobotEnabled] = useState<boolean>(() => localStorage.getItem('robot_enabled') === 'true');
  const [isOnline, setIsOnline] = useState<boolean>(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const animator = useMemo(() => {
    const anim = new RobotAnimator();
    anim.isInfiniteLoop = false;
    return anim;
  }, []);

  const [activeAction, setActiveAction] = useState<string>('home');
  // dynamicActions now stores 'script' so we can send it to the robot
  const [dynamicActions, setDynamicActions] = useState<Array<{
    id: string;
    label: string;
    prompt: string;
    icon: any;
    fn: () => void;
    script: ActionScript;
  }>>([]);

  // Sending state per action (to show loading indicator on button)
  const [sendingId, setSendingId] = useState<string | null>(null);
  const loadFileRef = useRef<HTMLInputElement>(null);

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

  const handleAction = async (action: any) => {
    setActiveAction(action.id);
    action.fn(); // Animate simulator

    if (robotEnabled && robotUrl.trim()) {
      setSendingId(action.id);
      try {
        let payload;
        if (action.script) {
          payload = ActionParser.scriptToRobotPayload(action.script);
        } else {
          payload = { command: action.id };
        }

        const url = robotUrl.replace(/\/$/, '') + '/control';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.status !== '200') {
          addToast('error', `机器人错误: ${json.msg}`);
        }
      } catch (e: any) {
        addToast('error', `连接失败: ${e.message}`);
      } finally {
        setSendingId(null);
      }
    }
  };

  const handleNewActionGenerated = (actionData: { name: string, script: ActionScript, prompt: string, id?: string }) => {
    try {
      const rawJsCode = ActionParser.generateAnimScript(actionData.script);
      console.log("ActionParser generated JS:", rawJsCode);
      const actionFn = new Function('animator', rawJsCode);

      if (actionData.id) {
        setDynamicActions(prev => prev.map(a =>
          a.id === actionData.id
            ? { ...a, label: actionData.name, prompt: actionData.prompt, script: actionData.script, fn: () => actionFn(animator) }
            : a
        ));
        if (activeAction === actionData.id) actionFn(animator);
      } else {
        const newAction = {
          id: `custom_${Date.now()}`,
          label: actionData.name,
          prompt: actionData.prompt,
          icon: Sparkles,
          fn: () => actionFn(animator),
          script: actionData.script,
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

  const handleLoadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (!data.script || !data.script.steps) throw new Error('Invalid file');
        handleNewActionGenerated({ name: data.name || file.name, script: data.script, prompt: data.prompt || '' });
        addToast('success', `\u5df2\u52a0\u8f7d\u300c${data.name || file.name}\u300d`);
      } catch {
        addToast('error', '\u6587\u4ef6\u683c\u5f0f\u9519\u8bef\uff0c\u65e0\u6cd5\u52a0\u8f7d');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // send to robot is now natively grouped inside handleAction logic

  // ----------------------------------------------------------------
  // Robot URL settings
  // ----------------------------------------------------------------
  const saveRobotUrl = async () => {
    const url = robotUrlInput.trim();
    setRobotUrl(url);
    localStorage.setItem('robot_base_url', url);
    setShowRobotSettings(false);

    // Test connection with 'home' command
    try {
      const testUrl = url.replace(/\/$/, '') + '/control';
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'home' }),
      });
      const json = await res.json();
      if (json.status === '200') {
        setIsOnline(true);
        addToast('success', '已连接到机器人');
      } else {
        setIsOnline(false);
        addToast('error', `连接失败: ${json.msg}`);
      }
    } catch (e) {
      setIsOnline(false);
      addToast('error', '无法连接到机器人');
    }
  };

  const openRobotSettings = () => {
    setRobotUrlInput(robotUrl);
    setShowRobotSettings(true);
  };

  if (currentView === 'visualizer') {
    return <GaitVisualizer onGoBack={() => setCurrentView('simulator')} />;
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-[#1e293b] overflow-hidden font-sans">

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold backdrop-blur border pointer-events-auto transition-all duration-300
              ${t.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'}`}
          >
            {t.type === 'success'
              ? <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              : <XCircle size={16} className="text-red-500 shrink-0" />
            }
            {t.message}
          </div>
        ))}
      </div>

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
            <span>Gait Lab &amp; Visualizer</span>
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

          <input
            ref={loadFileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleLoadFromFile}
          />
          <button
            onClick={() => loadFileRef.current?.click()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all font-semibold text-sm"
          >
            <FolderOpen size={16} />
            <span>从文件加载</span>
          </button>

          {dynamicActions.length > 0 && (
            <div className="mt-6 mb-2">
              <div className="text-[10px] text-blue-500 uppercase tracking-widest mb-3 font-bold">Generated Actions</div>
              <div className="space-y-2">
                {dynamicActions.map((action) => {
                  const Icon = action.icon;
                  const isActive = activeAction === action.id;
                  const isSending = sendingId === action.id;
                  return (
                    <div
                      key={action.id}
                      className={`group w-full flex items-center justify-between rounded-lg transition-all duration-200 border border-blue-100 ${isActive
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                        }`}
                    >
                      {/* Action trigger button */}
                      <button
                        onClick={() => handleAction(action)}
                        className="flex-1 flex items-center space-x-3 px-4 py-3 text-left overflow-hidden uppercase"
                      >
                        <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="text-sm font-semibold truncate">{action.label}</span>
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAction({ id: action.id, name: action.label, prompt: action.prompt });
                          setIsModalOpen(true);
                        }}
                        className="p-3 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                        title="编辑动作描述"
                      >
                        <Edit size={15} />
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

        {/* Bottom: Robot URL setting */}
        <div className="border-t border-slate-100 bg-slate-50">
          {/* Settings panel (expandable) */}
          {showRobotSettings && (
            <div className="p-4 border-b border-slate-200 bg-white">
              <label className="block text-xs font-semibold text-slate-600 mb-1">机器人地址 (host:port)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={robotUrlInput}
                  onChange={e => setRobotUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveRobotUrl()}
                  placeholder="http://192.168.4.1"
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
                <button
                  onClick={saveRobotUrl}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    const nextState = !robotEnabled;
                    setRobotEnabled(nextState);
                    localStorage.setItem('robot_enabled', String(nextState));
                  }}
                  className={`px-2 py-1.5 rounded-lg transition-colors border ${robotEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                  title={robotEnabled ? "运行在机器人上 (开启)" : "仅在模拟器运行 (关闭)"}
                >
                  <Wifi size={16} />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">不含尾部斜线，端口默认80</p>
            </div>
          )}

          {/* Status bar with settings toggle */}
          <div className="p-4 flex items-center justify-between text-xs text-slate-500 font-medium">
            <button
              onClick={openRobotSettings}
              className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors"
              title="配置机器人地址"
            >
              <Settings size={13} />
              <span className="font-mono truncate max-w-[120px]">{robotUrl || '未配置'}</span>
            </button>
            <span className={`flex items-center shrink-0 ${isOnline ? 'text-emerald-600' : 'text-red-500'}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              {isOnline ? 'Online' : 'Offline'}
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
