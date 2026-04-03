# OpenClaw Agent Creator Skill

A lightweight skill for OpenClaw. Once installed, you can use natural language to command the Main Agent (Lobster) to automatically create, configure, and initialize other **independent Agents (not sub-agents)**.

## 💡 How It Works
1. **Command:** The Main Agent receives a natural language instruction (e.g., "Use agent-creator to create an agent expert in Python web scraping").
2. **Design:** The Main Agent consults the specifications in `SKILL.md`, automatically formats the name (e.g., `python_spider_expert`), and creatively writes a detailed, multi-hundred-word system prompt for the new expert.
3. **Execution:** The Main Agent automatically calls the terminal tool in the background: `bash create_agent.sh "python_spider_expert" "You are a senior..."`.
4. **Initialization:** The shell script executes `openclaw agents add` and `openclaw agent --message`, instantly completing the environment setup and memory injection for the new Agent.

## 🚀 Installation

### Option 1: Conversational Online Installation (Recommended)
As long as this project is hosted on GitHub, you can simply send a command to your OpenClaw Main Agent:
> "Help me install this skill: https://github.com/freesaber/agent-creator-skill"

The Main Agent will automatically pull the code, configure it, and enable the skill.

### Option 2: Manual Offline Installation
If you are developing or debugging locally:
1. Place this folder into the `~/.openclaw/workspace/skills/` directory.
2. Enter the directory in your terminal and ensure the script has execution permissions: `chmod +x create_agent.sh`
3. Restart OpenClaw or wait for the Main Agent to reload its skills.

## 💬 Usage Examples & Notes

Due to the inherent logic of many Large Language Models, they may sometimes assume they are creating "sub-agents" under themselves. To ensure the command executes accurately, it is recommended to be explicit during the conversation:

✅ **Recommended Phrases:**
> "Use the agent-creator skill to create an agent proficient in Java Senior Development. Note: create an **independent peer agent**, do not create a sub-agent."

> "Help me build a Product Manager agent. It must be an **independent agent**, not your sub-agent."

Once execution is successful, the Main Agent will report the new Agent's name and its workspace path. You can then begin working with your new Agent immediately!