export class RobotAnimator {
    servos: any[];
    timeMs: number;
    actionQueue: any[];
    currentAction: any;
    resetBase: boolean;
    playbackSpeed: number;
    isPaused: boolean;
    isInfiniteLoop: boolean;

    constructor() {
        this.servos = Array(8).fill(0).map(() => ({
            mode: 'stop',
            pos: 90,
            target: 90,
            startPos: 90,
            A: 0, O: 0, T: 2000, Ph: 0,
            moveStartTime: 0,
            movePeriod: 0,
        }));
        this.timeMs = 0;
        this.actionQueue = [];
        this.currentAction = null;
        this.resetBase = false;
        this.playbackSpeed = 1.0;
        this.isPaused = false;
        this.isInfiniteLoop = true;
    }

    stepAhead(ms: number = 20) {
        if (this.isPaused) {
            this.timeMs += ms;
            this.tick();
        }
    }

    update(deltaMs: number) {
        if (!this.isPaused) {
            this.timeMs += deltaMs * this.playbackSpeed;
            this.tick();
        }
        return {
            positions: this.servos.map(s => s.pos),
            velocity: this.isPaused ? { x: 0, z: 0, rY: 0 } : (this.currentAction?.velocities || { x: 0, z: 0, rY: 0 }),
            resetBase: this.resetBase
        };
    }

    private tick() {
        if (!this.currentAction && this.actionQueue.length > 0) {
            this.currentAction = this.actionQueue.shift();
            this.currentAction.start(this.timeMs);
        }

        if (this.currentAction) {
            const done = this.currentAction.update(this.timeMs, this.servos);
            if (done) {
                this.currentAction = null;
            }
        }

        this.servos.forEach(s => {
            if (s.mode === 'oscillate') {
                const elapsed = this.timeMs - s.moveStartTime;
                const phase = (elapsed / s.T) * 2 * Math.PI;
                s.pos = s.A * Math.sin(phase + s.Ph) + s.O + 90;
            } else if (s.mode === 'move') {
                const elapsed = this.timeMs - s.moveStartTime;
                if (elapsed >= s.movePeriod) {
                    s.pos = s.target;
                    s.mode = 'stop';
                } else {
                    const t = elapsed / s.movePeriod;
                    s.pos = s.startPos + (s.target - s.startPos) * t;
                }
            }
        });
    }

    enqueueMove(period: number, targets: number[], velocities: { x: number, z: number, rY: number } = { x: 0, z: 0, rY: 0 }) {
        this.actionQueue.push({
            velocities,
            start: (t: number) => {
                targets.forEach((target, i) => {
                    this.servos[i].mode = 'move';
                    this.servos[i].startPos = this.servos[i].pos;
                    this.servos[i].target = target;
                    this.servos[i].moveStartTime = t;
                    this.servos[i].movePeriod = period;
                });
            },
            update: (t: number, servos: any[]) => t >= servos[0].moveStartTime + period
        });
    }

    enqueueOscillate(amplitude: number[], offset: number[], period: number[], phase: number[], cycles: number, velocities: { x: number, z: number, rY: number } = { x: 0, z: 0, rY: 0 }) {
        const maxPeriod = Math.max(...period);
        let currentTotalTime = maxPeriod * cycles;
        this.actionQueue.push({
            velocities,
            start: (t: number) => {
                amplitude.forEach((_, i) => {
                    this.servos[i].mode = 'oscillate';
                    this.servos[i].A = amplitude[i];
                    this.servos[i].O = offset[i];
                    this.servos[i].T = period[i];
                    this.servos[i].Ph = phase[i];
                    this.servos[i].moveStartTime = t;
                });
            },
            update: (t: number, servos: any[]) => {
                const elapsed = t - servos[0].moveStartTime;

                // If loop is checked, dynamically extend the total time so it seamlessly continues
                if (this.isInfiniteLoop && elapsed > currentTotalTime - maxPeriod) {
                    currentTotalTime += maxPeriod;
                }

                if (elapsed >= currentTotalTime) {
                    servos.forEach(s => {
                        s.mode = 'stop';
                    });
                    return true;
                }
                return false;
            }
        });
    }

    clearQueue() {
        this.actionQueue = [];
        this.currentAction = null;
    }

    home() {
        this.clearQueue();
        this.enqueueMove(500, Array(8).fill(90));
        this.resetBase = true;
    }

    forward(steps = 3, t = 800) {
        this.clearQueue();
        const x_amp = 15, z_amp = 15, ap = 10, hi = 15, front_x = 6;
        const period = Array(8).fill(t);
        const amplitude = [x_amp, x_amp, z_amp, z_amp, x_amp, x_amp, z_amp, z_amp];
        const offset = [ap - front_x, -ap + front_x, -hi, hi, -ap - front_x, ap + front_x, hi, -hi];
        const phase = [0, 0, 90, 90, 180, 180, 90, 90].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps, { x: 0, z: 2.5, rY: 0 });
        this.enqueueMove(500, Array(8).fill(90));
    }

    backward(steps = 3, t = 800) {
        this.clearQueue();
        const x_amp = 15, z_amp = 15, ap = 10, hi = 15, front_x = 6;
        const period = Array(8).fill(t);
        const amplitude = [x_amp, x_amp, z_amp, z_amp, x_amp, x_amp, z_amp, z_amp];
        const offset = [ap - front_x, -ap + front_x, -hi, hi, -ap - front_x, ap + front_x, hi, -hi];
        const phase = [180, 180, 90, 90, 0, 0, 90, 90].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps, { x: 0, z: -2.5, rY: 0 });
        this.enqueueMove(500, Array(8).fill(90));
    }

    turn_L(steps = 3, t = 1000) {
        this.clearQueue();
        const x_amp = 15, z_amp = 15, ap = 5, hi = 23;
        const period = Array(8).fill(t);
        const amplitude = [x_amp, x_amp, z_amp, z_amp, x_amp, x_amp, z_amp, z_amp];
        const offset = [ap, -ap, -hi, hi, -ap, ap, hi, -hi];
        const phase = [180, 0, 90, 90, 0, 180, 90, 90].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps, { x: 0, z: 0, rY: 1.2 });
        this.enqueueMove(500, Array(8).fill(90));
    }

    turn_R(steps = 3, t = 1000) {
        this.clearQueue();
        const x_amp = 15, z_amp = 15, ap = 5, hi = 23;
        const period = Array(8).fill(t);
        const amplitude = [x_amp, x_amp, z_amp, z_amp, x_amp, x_amp, z_amp, z_amp];
        const offset = [ap, -ap, -hi, hi, -ap, ap, hi, -hi];
        const phase = [0, 180, 90, 90, 180, 0, 90, 90].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps, { x: 0, z: 0, rY: -1.2 });
        this.enqueueMove(500, Array(8).fill(90));
    }

    dance(steps = 3, t = 2000) {
        this.clearQueue();
        const x_amp = 0, z_amp = 30, ap = 0, hi = 20;
        const period = Array(8).fill(t);
        const amplitude = [x_amp, x_amp, z_amp, z_amp, x_amp, x_amp, z_amp, z_amp];
        const offset = [ap, -ap, -hi, hi, -ap, ap, hi, -hi];
        const phase = [0, 0, 0, 270, 0, 0, 90, 180].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps);
        this.enqueueMove(500, Array(8).fill(90));
    }

    push_up(steps = 3, t = 400) {
        this.clearQueue();

        // 1. Preparation stand (all neutral)
        this.enqueueMove(500, [90, 90, 90, 90, 90, 90, 90, 90]);

        // Push up cycle
        for (let i = 0; i < steps; i++) {
            // 2. Lower front body (hips forward to stretch, knees retracted to lower to ground)
            // FR, FL hips forward (115), knees retracted (120). Back neutral (90).
            this.enqueueMove(t, [115, 115, 120, 120, 90, 90, 90, 90]);

            // 3. Push up front body (hips backward to thrust chest up, knees extended to push up)
            // FR, FL hips backward (65), knees extended (60). Back neutral (90).
            this.enqueueMove(t, [65, 65, 60, 60, 90, 90, 90, 90]);
        }

        // 4. Return to home
        this.enqueueMove(500, Array(8).fill(90));
    }

    hello() {
        this.clearQueue();
        const a = 50, b = 30, c = 20, d = 70;
        const state1 = [90 - a, 90, 90 + c, 90 - c, 90 + c, 90 - c, 90 - d, 90 + d];
        const state2 = [90 - a, 90 + b, 90 + c, 90 + d, 90 + c, 90 - c, 90 - d, 90 + d];
        const state3 = [90 - a, 90 - b, 90 + c, 90 + d, 90 + c, 90 - c, 90 - d, 90 + d];
        const state4 = Array(8).fill(90);

        this.enqueueMove(300, state1);
        for (let i = 0; i < 3; i++) {
            this.enqueueMove(200, state2);
            this.enqueueMove(200, state3);
        }
        this.enqueueMove(300, state4);
    }

    scared() {
        this.clearQueue();
        const ap = 10, hi = 40;
        const sentado = [90 - 15, 90 + 15, 90 - hi, 90 + hi, 90 - 20, 90 + 20, 90 + hi, 90 - hi];
        const salto = [90 - ap, 90 + ap, 160, 20, 90 + ap * 3, 90 - ap * 3, 20, 160];

        this.enqueueMove(600, sentado);
        this.enqueueMove(1000, salto);
        this.enqueueMove(500, Array(8).fill(90));
    }

    relax() {
        this.clearQueue();
        const step1 = [30, 90, 160, 90, 90, 90, 90, 90];
        const step2 = [30, 150, 160, 20, 90, 90, 90, 90];
        const step3 = [30, 150, 160, 20, 90, 30, 90, 160];
        const step4 = [30, 150, 160, 20, 150, 30, 20, 160];

        this.enqueueMove(300, step1);
        this.enqueueMove(100, step1);
        this.enqueueMove(300, step2);
        this.enqueueMove(100, step2);
        this.enqueueMove(300, step3);
        this.enqueueMove(100, step3);
        this.enqueueMove(300, step4);
        this.enqueueMove(100, step4);
    }

    relax2() {
        this.clearQueue();
        const t = 100;
        const delay = 100;

        const rf_retract = [30, 90, 160, 90, 90, 90, 90, 90];
        const rf_extend = [90, 90, 90, 90, 90, 90, 90, 90];

        const lf_retract = [90, 150, 160, 20, 90, 90, 90, 90];
        const lf_extend = [90, 90, 90, 90, 90, 90, 90, 90];

        const lb_retract = [90, 90, 90, 90, 90, 30, 90, 160];
        const lb_extend = [90, 90, 90, 90, 90, 90, 90, 90];

        const rb_retract = [90, 90, 90, 90, 150, 90, 20, 90];
        const rb_extend = [90, 90, 90, 90, 90, 90, 90, 90];

        // RF
        this.enqueueMove(t, rf_retract);
        this.enqueueMove(delay, rf_retract);
        this.enqueueMove(t, rf_extend);
        this.enqueueMove(delay, rf_extend);

        // LF
        this.enqueueMove(t, lf_retract);
        this.enqueueMove(delay, lf_retract);
        this.enqueueMove(t, lf_extend);
        this.enqueueMove(delay, lf_extend);

        // LB
        this.enqueueMove(t, lb_retract);
        this.enqueueMove(delay, lb_retract);
        this.enqueueMove(t, lb_extend);
        this.enqueueMove(delay, lb_extend);

        // RB
        this.enqueueMove(t, rb_retract);
        this.enqueueMove(delay, rb_retract);
        this.enqueueMove(t, rb_extend);
        this.enqueueMove(delay, rb_extend);
    }

    frog_jump(steps = 3) {
        this.clearQueue();
        const hi = 40; // Squat amount
        const thrust_back_z = 50; // Back thrust 
        const thrust_front_z = 70; // Front thrust (higher)

        // 1. Squat down
        const squat = [
            90, 90,             // front x
            90 - hi, 90 + hi,   // front z lowered
            90, 90,             // back x
            90 + hi, 90 - hi    // back z lowered
        ];

        // 2. Back legs thrust (front stays squatted)
        const thrust_1 = [
            100, 80,                        // front x minor shift
            90 - hi, 90 + hi,               // front z stays low
            110, 70,                        // back x pushed back slightly
            90 - thrust_back_z, 90 + thrust_back_z    // back z extended
        ];

        // 3. Front legs thrust (full jump)
        const thrust_2 = [
            110, 70,                                 // front x pushed back
            90 + thrust_front_z, 90 - thrust_front_z,// front z fully extended
            110, 70,                                 // back x pushed back slightly
            90 - thrust_back_z, 90 + thrust_back_z   // back z extended
        ];

        // 4. Tuck in mid-air
        const tuck = [
            70, 110,            // front x forward
            90 - hi, 90 + hi,   // front z tucked
            70, 110,            // back x forward
            90 + hi, 90 - hi    // back z tucked
        ];

        for (let i = 0; i < steps; i++) {
            this.enqueueMove(400, squat);
            // Back thrusts first
            this.enqueueMove(100, thrust_1, { x: 0, z: 1.0, rY: 0 });
            // Front thrusts (main jump)
            this.enqueueMove(150, thrust_2, { x: 0, z: 5.0, rY: 0 });
            // Mid air tuck
            this.enqueueMove(300, tuck, { x: 0, z: 3.0, rY: 0 });
            // Land back to squat
            this.enqueueMove(200, squat, { x: 0, z: 0.5, rY: 0 });
        }

        this.enqueueMove(500, Array(8).fill(90));
    }

    wave_hand(steps = 3, t = 2000) {
        this.clearQueue();
        const period = Array(8).fill(t);
        const amplitude = [20, 0, 0, 30, 0, 0, 0, 0];
        const offset = [-50, 0, 20, 60, 0, 0, 0, 0];
        const phase = Array(8).fill(0);
        this.enqueueOscillate(amplitude, offset, period, phase, steps);
        this.enqueueMove(500, Array(8).fill(90));
    }

    hide(steps = 1.0, t = 2000) {
        this.clearQueue();
        const a = 60, b = 70;
        const period = Array(8).fill(t);
        const amplitude = Array(8).fill(0);
        const offset = [-a, a, b, -b, a, -a, -b, b];
        const phase = Array(8).fill(0);
        this.enqueueOscillate(amplitude, offset, period, phase, steps);
        this.enqueueMove(500, Array(8).fill(90));
    }

    up_down(steps = 2, t = 2000) {
        this.clearQueue();
        const x_amp = 0, z_amp = 35, ap = 10, hi = 15, front_x = 0;
        const period = Array(8).fill(t);
        const amplitude = [x_amp, x_amp, z_amp, z_amp, x_amp, x_amp, z_amp, z_amp];
        const offset = [ap - front_x, -ap + front_x, -hi, hi, -ap - front_x, ap + front_x, hi, -hi];
        const phase = [0, 0, 90, 270, 180, 180, 270, 90].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps);
        this.enqueueMove(500, Array(8).fill(90));
    }

    moonwalk_L(steps = 4, t = 2000) {
        this.clearQueue();
        const z_amp = 25, o = 5;
        const period = Array(8).fill(t);
        const amplitude = [0, 0, z_amp, z_amp, 0, 0, z_amp, z_amp];
        const offset = [0, 0, -z_amp - o, z_amp + o, 0, 0, z_amp + o, -z_amp - o];
        const phase = [0, 0, 0, 80, 0, 0, 160, 290].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps, { x: -1.5, z: 0, rY: 0 });
        this.enqueueMove(500, Array(8).fill(90));
    }

    front_back(steps = 2, t = 1000) {
        this.clearQueue();
        const x_amp = 30, z_amp = 20, ap = 15, hi = 30;
        const period = Array(8).fill(t);
        const amplitude = [x_amp, x_amp, z_amp, z_amp, x_amp, x_amp, z_amp, z_amp];
        const offset = [ap, -ap, -hi, hi, -ap, ap, hi, -hi];
        const phase = [0, 180, 270, 90, 0, 180, 90, 270].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps);
        this.enqueueMove(500, Array(8).fill(90));
    }

    omni_walk(steps = 2, t = 1000, side = true, turn_factor = 2) {
        this.clearQueue();
        const x_amp = 15, z_amp = 15, ap = 0, hi = 23;
        const front_x = 6 * (1 - Math.pow(turn_factor, 2));
        const period = Array(8).fill(t);
        const amplitude = [x_amp, x_amp, z_amp, z_amp, x_amp, x_amp, z_amp, z_amp];
        const offset = [
            ap - front_x, -ap + front_x, -hi, hi,
            -ap - front_x, ap + front_x, hi, -hi
        ];
        let phase;
        if (side) {
            const phase1 = [0, 0, 90, 90, 180, 180, 90, 90];
            const phase2R = [0, 180, 90, 90, 180, 0, 90, 90];
            phase = phase1.map((p1, i) => (p1 * (1 - turn_factor) + phase2R[i] * turn_factor) * Math.PI / 180);
        } else {
            const phase1 = [0, 0, 90, 90, 180, 180, 90, 90];
            const phase2L = [180, 0, 90, 90, 0, 180, 90, 90];
            phase = phase1.map((p1, i) => (p1 * (1 - turn_factor) + phase2L[i] * turn_factor) * Math.PI / 180);
        }
        this.enqueueOscillate(amplitude, offset, period, phase, steps, { x: side ? 1.0 : -1.0, z: 1.0, rY: turn_factor * 0.4 });
        this.enqueueMove(500, Array(8).fill(90));
    }

    walk1(steps = 3, t = 1000) {
        this.clearQueue();
        const period = [t, t, t / 2, t / 2, t, t, t / 2, t / 2];
        const amplitude = [15, 15, 20, 20, 15, 15, 20, 20];
        const offset = Array(8).fill(0);
        const phase = [90, 90, 270, 90, 270, 270, 90, 270].map(p => p * Math.PI / 180);
        this.enqueueOscillate(amplitude, offset, period, phase, steps, { x: 0, z: 1.5, rY: 0 });
        this.enqueueMove(500, Array(8).fill(90));
    }

    walk(t = 360) {
        this.clearQueue();
        const a = 16, ao = 50, b = 5, c = -30, co = 10;
        const step1 = [90 + 2.0 * a - ao, 90 - 4.0 * a + ao, 90 + c + 5 * b, 90 - c - 4 * b, 90 + 3.0 * a - co, 90 - 1.0 * a + co, 90 - c - 4 * b - 10, 90 + c + 6 * b];
        const step2 = [90 + 2.3 * a - ao, 90 - 2.0 * a + ao, 90 + c + 5 * b, 90 - c - 0 * b, 90 + 3.3 * a - co, 90 - 1.3 * a + co, 90 - c - 4 * b - 10, 90 + c + 6 * b];
        const step3 = [90 + 3.0 * a - ao, 90 - 1.0 * a + ao, 90 + c + 4 * b, 90 - c - 6 * b, 90 + 4.0 * a - co, 90 - 2.0 * a + co, 90 - c - 4 * b - 10, 90 + c + 5 * b];
        const step4 = [90 + 3.3 * a - ao, 90 - 1.3 * a + ao, 90 + c + 4 * b, 90 - c - 6 * b, 90 + 2.0 * a - co, 90 - 2.3 * a + co, 90 - c - 0 * b - 10, 90 + c + 5 * b];
        const step5 = [90 + 4.0 * a - ao, 90 - 2.0 * a + ao, 90 + c + 4 * b, 90 - c - 5 * b, 90 + 1.0 * a - co, 90 - 3.0 * a + co, 90 - c - 6 * b - 10, 90 + c + 4 * b];
        const step6 = [90 + 2.0 * a - ao, 90 - 2.3 * a + ao, 90 + c + 0 * b, 90 - c - 5 * b, 90 + 1.3 * a - co, 90 - 3.3 * a + co, 90 - c - 6 * b - 10, 90 + c + 4 * b];
        const step7 = [90 + 1.0 * a - ao, 90 - 3.0 * a + ao, 90 + c + 6 * b, 90 - c - 4 * b, 90 + 2.0 * a - co, 90 - 4.0 * a + co, 90 - c - 5 * b - 10, 90 + c + 4 * b];
        const step8 = [90 + 1.3 * a - ao, 90 - 3.3 * a + ao, 90 + c + 6 * b, 90 - c - 4 * b, 90 + 2.3 * a - co, 90 - 2.0 * a + co, 90 - c - 5 * b - 10, 90 + c + 0 * b];

        const v = { x: 0, z: 1.5, rY: 0 };
        this.enqueueMove(t, step1, v);
        this.enqueueMove(t / 3, step2, v);
        this.enqueueMove(t, step3, v);
        this.enqueueMove(t / 3, step4, v);
        this.enqueueMove(t, step5, v);
        this.enqueueMove(t / 3, step6, v);
        this.enqueueMove(t, step7, v);
        this.enqueueMove(t / 3, step8, v);
        this.enqueueMove(500, Array(8).fill(90));
    }
}
