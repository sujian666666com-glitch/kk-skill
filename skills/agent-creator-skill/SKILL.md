---
name: create_agent
description: Automatically create a new OpenClaw agent, translate its name, and initialize its persona/system prompt based on user requests.
parameters:
  type: object
  properties:
    agent_name_en:
      type: string
      description: "The translated English short ID for the agent. Snake_case, lowercase only. Example: 'java_expert'."
    agent_name_cn:
      type: string
      description: "The friendly Chinese display name for the agent. Example: 'Java高级专家'."
    identity_prompt:
      type: string
      description: "A highly detailed persona description and system prompt."
  required:
    - agent_name_en
    - agent_name_cn
    - identity_prompt
---

# Agent Creator Skill (自动化创建代理工具)

When a user asks you to create a new agent, assistant, or proxy (e.g., "创建一个Java高级开发的代理", "Help me build a product manager agent"), you MUST use this skill to accomplish the task.

## SOP (Standard Operating Procedure):

1. **Translation**: Translate the requested role into a short English snake_case string. This will be the `<agent_name_en>`.
2. **Persona Generation**: Generate a professional, highly detailed Chinese system prompt for this specific role. This will be the `<identity_prompt>`.
3. **Execution**: Use your bash/terminal execution capability:
   ```bash
   bash {baseDir}/create_agent.sh "<agent_name_en>" "<agent_name_cn>" "<identity_prompt>"
