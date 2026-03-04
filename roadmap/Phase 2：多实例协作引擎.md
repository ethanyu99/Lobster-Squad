## Phase 2：多实例协作引擎

> **目标**：实现多 OpenClaw 实例的智能协作，由 Lead 实例规划任务、平台调度执行、Git 共享工作产物、反馈回路驱动迭代
>
> _（合并原 Phase 2「编排器 + 实例间任务委派」与 Phase 3「共享上下文 + 反馈回路」）_

---

### 核心设计原则

- **Lead 实例负责思考和决策，平台负责执行和记账**
- **角色通用化**：平台不预设角色语义，角色的能力、职责、协作方式全部由用户定义或团队模板提供，Lead 实例（LLM）动态理解并编排
- **双通道上下文传递**：Prompt 注入传递轻量语义信息，Git 仓库传递重量级工作产物
- **对 OpenClaw Gateway 零侵入**：所有协作能力在平台层实现，不改造 Gateway 内部

---

### 2.1 编排模式：Lead 实例 + 自感知团队

> 不设专职"分配者"角色，由用户指定的 Team Lead 兼任规划职责，其他成员感知团队但专注执行
>
> **Lead 不是固定角色**：开发团队中 Architect 可以是 Lead，创作团队中策划可以是 Lead——由用户在创建团队时指定

#### 通用角色模型

- [ ] 角色定义完全由用户/模板提供，平台不预设任何角色语义
- [ ] 每个角色包含：`name`（名称）、`description`（职责描述）、`capabilities`（能力标签）、`isLead`（是否为 Lead）
- [ ] Lead 角色额外具备规划职责，其 System Prompt 自动追加团队编排指引

```typescript
interface ClawRole {
  name: string;              // 如 "用户分析师"、"文案"、"发布运营"
  description: string;       // 职责描述，用自然语言即可
  capabilities: string[];    // 能力标签，如 ["用户调研", "数据分析", "画像构建"]
  isLead: boolean;           // 是否担任 Team Lead
}
```

#### 团队感知（System Prompt 动态生成）

- [ ] **Lead 实例**的 System Prompt 自动注入完整团队信息：所有成员名称、职责、能力
- [ ] **Worker 实例**的 System Prompt 注入团队概况：知道队友是谁，但不负责任务拆解
- [ ] Lead 完成规划后输出 **结构化执行计划（JSON）**，平台解析并执行
- [ ] 执行计划中由 Lead 指定每个步骤需要的上游上下文（`contextNeeds`），**平台不硬编码角色间的上下文路由规则**

#### 执行计划格式

```json
{
  "plan": [
    {
      "step": 1,
      "assignTo": "用户分析师",
      "task": "分析目标用户画像和内容偏好",
      "dependencies": [],
      "contextNeeds": []
    },
    {
      "step": 2,
      "assignTo": "文案",
      "task": "根据用户画像撰写小红书种草文案",
      "dependencies": [1],
      "contextNeeds": [
        { "fromStep": 1, "need": "full", "hint": "需要完整的用户画像报告来把握调性" }
      ]
    },
    {
      "step": 3,
      "assignTo": "发布运营",
      "task": "将文案适配各平台格式并发布",
      "dependencies": [2],
      "contextNeeds": [
        { "fromStep": 1, "need": "summary", "hint": "了解目标受众即可" },
        { "fromStep": 2, "need": "full", "hint": "需要完整文案内容" }
      ]
    }
  ]
}
```

> `contextNeeds.need` 取值：`"full"` = 完整交付物，`"summary"` = 摘要，`"decisions"` = 仅关键决策，`"none"` = 不需要
>
> 这样**上下文路由的智能在 Lead（LLM）而不是平台代码**——换一种团队类型不需要改任何平台逻辑

#### 团队模板示例

| 团队类型 | Lead | 成员 |
|---------|------|------|
| 全栈开发组 | 架构师 | 开发者、测试、代码审查 |
| 内容创作组 | 内容策划 | 用户分析师、文案、发布运营 |
| 数据分析组 | 分析主管 | 数据分析师、可视化、报告撰写 |
| 自定义 | 用户指定 | 用户自定义 |

---

### 2.2 双通道上下文传递

> 代码不是靠"压缩成文字"就能传递的——它是工作空间状态

#### 通道 1：Prompt 注入（轻量语义信息）

- [ ] 实现 **Context Injection Layer**：在 dispatch 前组装 enriched prompt
- [ ] 注入内容包括：团队目标、子任务描述、上游关键决策、约束条件、评审反馈
- [ ] 对 Gateway 透明——组装后的 prompt 作为普通用户消息发送

#### 通道 2：共享工作空间（重量级工作产物）

- [ ] 平台为每个 TeamTask 创建 **共享工作目录**
- [ ] 代码类团队：使用 **Git 仓库**，实例 dispatch 前自动 `git clone / pull`，完成后 `commit + push`
- [ ] 内容类团队：使用 **共享文件目录**，通过 Sandbox API 在实例间同步文件（文档、素材等）
- [ ] 下游实例直接在本地文件系统读取完整产出物，无 token 限制

#### 效果

```
下游实例 = Prompt 里的语义上下文 + 本地工作空间的完整文件
         → 像真实的团队成员一样：读任务说明 + 看产出物原件
```

---

### 2.3 Team Context Store（共享上下文存储）

- [ ] 新增 **TeamContext** 数据模型，持久化到 PostgreSQL
- [ ] 新增 **Artifact** 数据模型，存储每个实例的任务产出物

#### 数据结构

```typescript
interface TeamContext {
  id: string;
  teamId: string;
  goal: string;                  // 用户输入的原始目标
  plan: SubTask[];               // Lead 拆解的执行计划
  artifacts: Artifact[];         // 各实例的产出物
  decisions: Decision[];         // 关键决策记录
  feedback: Feedback[];          // 反馈记录
  status: TeamTaskStatus;
}

interface Artifact {
  id: string;
  instanceId: string;
  taskId: string;
  role: string;                  // 产出者的角色名（如 "文案"、"开发者"）
  tags: string[];                // 自由标签，由 LLM 提取（如 ["用户画像", "Z世代"]）
  rawOutput: string;             // 原始对话输出（归档用，不直接注入下游）
  structured: {
    deliverable: string;         // 核心交付物
    summary: string;             // LLM 生成的简短摘要
    keyDecisions: string[];      // 关键决策点
    constraints: string[];       // 发现的约束条件
  };
  timestamp: string;
}
```

- [ ] 实例完成任务后，平台调用 LLM 对 rawOutput 做 **结构化提取**（deliverable / summary / keyDecisions / constraints）
- [ ] Team Context 持久化存储，支持回溯和审计

---

### 2.4 智能上下文裁剪

> 三层过滤：依赖图（给谁）→ Lead 指定的 contextNeeds（给什么）→ 体积控制（给多少）
>
> **关键设计**：上下文路由规则不硬编码在平台——由 Lead 实例在执行计划中通过 `contextNeeds` 指定，平台只执行

- [ ] **依赖图裁剪**：根据执行计划的 `dependencies` 确定上下游关系
- [ ] **Lead 驱动的路由**：平台根据每个步骤的 `contextNeeds` 决定注入什么
  - `"full"` → 注入 `artifact.structured.deliverable` 完整交付物
  - `"summary"` → 注入 `artifact.structured.summary` 摘要
  - `"decisions"` → 仅注入 `artifact.structured.keyDecisions`
  - `"none"` → 不注入
- [ ] **体积控制**：即使 Lead 指定 `"full"`，超出 token 预算时自动降级为 `"summary"`
- [ ] Lead 还可通过 `contextNeeds.hint` 补充自然语言说明，作为 prompt 的一部分注入下游

---

### 2.5 状态流转

#### TeamTask 状态机

```
用户输入目标
    ↓
 planning        Lead 设计方案 + 拆解任务，输出 ExecutionPlan
    ↓
 scheduled       平台解析 Plan，构建依赖图，初始化 Git 仓库
    ↓
 executing  ←─── 按依赖顺序逐步派发 SubTask
    ↓         ↑
 reviewing    │  有任务需返工
    ├─ 满意 ──→ completed（汇总产出物，通知用户）
    └─ 不满意 → 修订计划，回到 executing
```

#### SubTask 状态机

```
pending → ready → dispatched → in_progress → completed
                                   ↓              ↓
                                 failed      needs_revision
                                                ↓
                                          re_dispatched → in_progress → ...
```

- [ ] 平台层实现 TeamTask 和 SubTask 的 **状态机管理**
- [ ] 状态变更通过 WebSocket **实时推送**给前端
- [ ] 依赖任务全部 completed 后，自动将后续任务标记为 ready 并 dispatch

---

### 2.6 反馈回路

> 反馈本质是"重调度 + 上下文追加"，复用正向 Handoff 的同一套机制

- [ ] 成员间 **Feedback**：任何成员的修改意见写入 TeamContext，Lead 决定是否返工
- [ ] 返工时注入增量上下文：原始任务 + 上次产出 + 评审反馈
- [ ] **Broadcast 广播**：关键决策通知所有团队成员（更新 System Prompt 或发送通知消息）
- [ ] **人工介入**：用户可随时插入指令，平台传递给 Lead 实例重新评估计划

---

### 2.7 通信协议

- [ ] 统一定义 **TeamMessage** 消息协议，所有协作消息流经平台：

```typescript
type TeamMessage =
  | { type: 'delegate';  from: 'lead';   to: string; task: SubTask }
  | { type: 'handoff';   from: string;   to: string; artifact: Artifact }
  | { type: 'feedback';  from: string;   to: string; feedback: Feedback }
  | { type: 'broadcast'; from: string;   to: 'all';  content: string }
  | { type: 'status';    from: string;   status: SubTaskStatus }
  | { type: 'revision';  from: 'lead';   to: string; task: SubTask; feedback: Feedback };
```

---

### 2.8 前端

- [ ] **协作时间线视图**：可视化展示 任务拆解 → 分发 → 执行 → 汇总 全过程
- [ ] **团队总览视图**：成员状态 + 成员间通信连线动画 + 依赖图可视化
- [ ] **任务派发支持"团队模式"**：输入目标 → Lead 自动规划 → 可视化执行
- [ ] **共享白板视图**：实时展示 Team Context 的变化（目标、计划、决策、产出物）
- [ ] **成果汇总页**：最终产出物的统一展示和导出（工作空间链接 + Artifact 摘要）
- [ ] **反馈交互**：支持查看成员间的反馈意见、人工介入修正团队方向

---

### 实施优先级

| 子阶段 | 内容 | 优先级 |
|--------|------|--------|
| 2.1 | Lead 实例 + 自感知团队 System Prompt 设计 | P0 |
| 2.2 | Git 共享仓库 + 自动 clone/pull/push | P0 |
| 2.3 | Team Context Store + Artifact 数据模型 + 持久化 | P0 |
| 2.4 | 智能上下文裁剪（依赖图 / 角色规则 / 体积控制） | P1 |
| 2.5 | 状态机管理 + 依赖图调度引擎 | P0 |
| 2.6 | Feedback 反馈回路 + 返工重调度 | P1 |
| 2.7 | TeamMessage 统一通信协议 | P1 |
| 2.8 | 前端：协作时间线 + 团队总览 + 成果汇总 | P1 |
