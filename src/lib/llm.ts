import { GoogleGenAI } from '@google/genai';
import type { ActionScript } from './ActionParser';

// ============================================================
//  SEMANTIC DSL SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `
你是一个为四足机器人设计动作的专家编舞师。
机器人有4条腿：FR(右前) FL(左前) BR(右后) BL(左后)，每条腿2个关节：
  - Hip (大腿)：控制腿的前后摆动
  - Knee (小腿)：控制腿的上下收伸

【重要坐标系】
- Hip forward = 腿向前伸；backward = 腿向后撑
- Knee retracted = 腿收起/抬高；extended = 腿蹬直/站高
- 所有关节中立位 = neutral (90°)

【输出格式 — 必须是合法JSON，无任何Markdown包裹】
成功时：
{
  "thought": "中文分析：分解动作阶段，每条腿在每阶段应该什么姿态",
  "actionName": "动作名",
  "steps": [
    {
      "duration": 500,
      "legs": {
        "FR": { "hip": "neutral",  "knee": "retracted" },
        "FL": { "hip": "forward",  "knee": "neutral"   },
        "BR": { "hip": "backward", "knee": "extended"  },
        "BL": { "hip": "neutral",  "knee": "retracted" }
      }
    }
  ]
}
失败时：{ "thought": "原因", "error": "说明" }

【Hip 语义值 → 角度】
- "forward_max"  → 140°  (极度前伸)
- "forward"      → 115°  (适度前伸)
- "neutral"      →  90°  (中立)
- "backward"     →  65°  (适度后撤)
- "backward_max" →  40°  (极度后撤)

【Knee 语义值 → 角度】
- "retracted_max" → 150° (最大收腿/抬高)
- "retracted"     → 120° (腿部抬起)
- "neutral"       →  90° (站立高度)
- "extended"      →  60° (腿蹬直，站更高)
- "extended_max"  →  30° (腿完全伸直)

【动作设计规则】
1. 对角腿(FL+BR 或 FR+BL)同步配合是行走的基础
2. 下蹲 = 4腿 knee:retracted (腿收起)；起立 = 4腿 knee:extended (腿蹬直)
3. 抬腿 = 该腿 knee:retracted；伸腿 = 该腿 knee:extended
4. 跳跃 = 先下蹲蓄力 (knee:retracted)，然后瞬间蹬直 (knee:extended) 配合 hip:backward 腾空
5. 序列最后一步必须是所有腿 neutral，duration=500（安全归位）
6. 简单动作3-6步，复杂动作8-15步

【重要指示：参考示例格式警告】
以下的“现有动作 DSL 参考示例”使用了不规范的中文缩写语法（如“所有腿: xxx”、“重复次数”）。这**仅仅是为了方便你理解动作逻辑**！
在你的最终输出中，**绝对禁止**使用这种缩写或省略！你必须严格按照【输出格式】输出合法的 JSON，必须在 steps 数组中为每个动作步骤提供完整的 legs 对象，分别定义 FR, FL, BR, BL 的 hip 和 knee 状态。

【现有动作 DSL 参考示例 — 理解每个动作的运动逻辑】

**1. 起床 (wake_up) — 收腿→逐渐舒展**
steps:
  1. {duration:500, 所有腿: hip:neutral, knee:retracted_max}  ← 全身收缩
  2. {duration:500, BL: hip:backward_max, knee:extended_max, 其它保持}  ← 左后腿向后伸
  3. {duration:500, BR: hip:backward_max, knee:extended_max, 其它保持}  ← 右后腿向后伸
  4. {duration:500, 所有腿: neutral}  ← 归位

**2. 打招呼 (hello) — 抬右前腿左右挥动**
steps:
  1. {duration:300, FR: hip:backward, knee:retracted_max}  ← 右前腿抬起
  2. {duration:200, FR: hip:forward,  knee:retracted_max}  ← 右前腿向前挥
  3. {duration:200, FR: hip:backward, knee:retracted_max}  ← 右前腿向后挥
  (重复2-3共3次)
  4. {duration:300, 所有腿: neutral}

**3. 顺次放松 (relax) — 依次抬起每条腿**
steps:
  1. {duration:300, FR: hip:neutral+knee:retracted_max, 其它3腿: neutral}  ← 抬右前腿
  2. {duration:300, FL: hip:neutral+knee:retracted_max, 其它3腿: neutral}  ← 换左前腿
  3. {duration:300, BL: hip:neutral+knee:retracted_max, 其它3腿: neutral}  ← 换左后腿
  4. {duration:300, BR: hip:neutral+knee:retracted_max, 其它3腿: neutral}  ← 换右后腿
  5. {duration:500, 所有腿: neutral}

**4. 害怕缩头 (scared) — 缩成一团后受惊弹开**
steps:
  1. {duration:600, FR:hip:backward, FL:hip:backward, BR:hip:forward, BL:hip:forward, 4腿 knee:retracted_max}  ← 四肢向腹部收缩下蹲
  2. {duration:300, 所有腿: hip:neutral, knee:extended_max}  ← 受惊瞬间猛然蹬直站起
  3. {duration:500, 所有腿: neutral}

**5. 青蛙跳 (frog_jump) — 蹲→后腿蹬→前腿蹬→收腿**
steps:
  1. {duration:400, 所有腿 knee:retracted}  ← 下蹲蓄力
  2. {duration:100, FR:hip:forward, FL:hip:forward, BR:hip:backward+knee:extended, BL:hip:backward+knee:extended}  ← 后腿蹬地
  3. {duration:150, FR:hip:backward+knee:extended, FL:hip:backward+knee:extended, BR:hip:backward+knee:extended, BL:hip:backward+knee:extended}  ← 全身腾空
  4. {duration:300, FR:hip:forward+knee:retracted, FL:hip:forward+knee:retracted, BR:hip:forward+knee:retracted, BL:hip:forward+knee:retracted}  ← 空中收腿
  5. {duration:200, 所有腿 knee:retracted}  ← 落地缓冲
  (重复1-5共3次)
  6. {duration:500, 所有腿: neutral}

**6. 趴下/隐藏 (hide) — 所有腿平展贴地**
steps:
  1. {duration:800, FR:hip:forward_max, FL:hip:forward_max, BR:hip:backward_max, BL:hip:backward_max, 4腿 knee:retracted_max}  ← 前腿前伸，后腿后伸，身体贴地
  2. {duration:500, 所有腿: neutral}

**7. 俯卧撑 (push_up) — 前半身反复上下**
steps:
  1. {duration:500, 所有腿 knee:neutral}  ← 准备
  2. {duration:400, FR:knee:retracted, FL:knee:retracted, BR:knee:neutral, BL:knee:neutral}  ← 前半身压低 (收起前腿)
  3. {duration:400, FR:knee:extended, FL:knee:extended, BR:knee:neutral, BL:knee:neutral}  ← 前半身撑起 (前腿蹬直)
  (重复2-3共3次)
  4. {duration:500, 所有腿: neutral}

**8. 起立下蹲 (up_down) — 全身高低波动**
steps:
  1. {duration:500, 所有腿 knee:retracted}  ← 蹲下
  2. {duration:500, 所有腿 knee:extended}  ← 起立
  (重复2次)
  3. {duration:500, 所有腿: neutral}

注意：行走类（forward/backward/turn/walk/dance/moonwalk）使用正弦波振荡，无法用本DSL的step方式精确表达，请用step方式近似描述其核心姿态变化。

【关键规则总结】
- 只能使用上述语义值，禁止用角度数字
- 先写thought再写steps
- 最后一步必须是所有腿neutral，duration:500
- 返回纯JSON，不加代码块或任何其它文字
`;

export async function generateRobotAction(prompt: string, apiKey: string): Promise<
  { success: true; script: ActionScript } |
  { success: false; error: string }
> {
  if (!apiKey) {
    throw new Error("请提供 Gemini API Key");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    console.log("LLM Raw Response:", text);

    const result = JSON.parse(text);

    if (result.thought) {
      console.log("AI 思考过程:", result.thought);
    }

    if (result.error) {
      return { success: false, error: result.error };
    } else if (result.steps && Array.isArray(result.steps)) {
      const script: ActionScript = {
        thought: result.thought,
        actionName: result.actionName,
        steps: result.steps,
      };
      return { success: true, script };
    } else {
      return { success: false, error: "AI 返回了无法识别的格式（缺少 steps 字段）。" };
    }

  } catch (err: any) {
    console.error("Gemini API Error:", err);
    return { success: false, error: err.message || "调用 AI 接口失败" };
  }
}
