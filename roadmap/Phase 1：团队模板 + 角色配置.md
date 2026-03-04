## Phase 1：团队模板 + 角色配置

> **目标**：让每个 ClawInstance 拥有独特的角色定位和技能配置

### 数据模型

- [ ] 新增 **Team** 数据模型（包含名称、描述、成员角色列表）
- [ ] 新增 **ClawRole** 角色系统（persona / skills / tools 配置）
- [ ] 每个 Instance 支持绑定角色，配置独立的 system prompt 和技能标签

### 团队模板

- [ ] 提供预设团队模板：**全栈开发组**（Architect + Coder + Reviewer + Tester）
- [ ] 提供预设团队模板：**内容创作组**（Researcher + Writer + Editor）
- [ ] 提供预设团队模板：**数据分析组**（Analyst + Visualizer + Reporter）
- [ ] 支持用户自定义团队模板

### 前端

- [ ] 团队创建 / 管理界面，一键从模板创建整个团队
- [ ] Instance 卡片展示角色信息和技能标签
- [ ] 团队列表视图，展示已创建的团队及成员概览
