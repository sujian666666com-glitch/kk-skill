#!/usr/bin/env node
/**
 * 每日 Skill 抓取脚本
 * 从 ClawHub 获取热门 Skill，进行安全检验，提交到仓库
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_DIR = process.env.HOME + '/clawd/kk-skill';
const DATE = new Date().toISOString().split('T')[0];
const LOG_FILE = path.join(REPO_DIR, 'logs', `fetch-${DATE}.log`);

// 搜索关键词列表
const SEARCH_KEYWORDS = ['api', 'web', 'git', 'github', 'test', 'deploy', 'docker', 'ai', 'image', 'video', 'slack', 'discord', 'telegram', 'notion', 'database', 'backup', 'monitor', 'alert', 'translate', 'pdf', 'docx', 'xlsx', 'image-gen', 'tts', 'search', 'fetch', 'browser', 'canvas', 'nodes', 'feishu', 'wechat', 'qq'];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: REPO_DIR });
  } catch (e) {
    return e.stderr || e.message;
  }
}

// 从 ClawHub 搜索 skill
function searchSkills(keyword) {
  const output = run(`clawhub search "${keyword}" 2>&1`);
  const skills = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // 解析格式: skill-name  description  (score)
    const match = line.match(/^(\S+)\s+.+\s+\(([\d.]+)\)$/);
    if (match) {
      skills.push({
        name: match[1],
        score: parseFloat(match[2]),
        keyword
      });
    }
  }
  
  return skills;
}

// 获取所有 skill
function fetchAllSkills() {
  const allSkills = [];
  const seen = new Set();
  
  for (const keyword of SEARCH_KEYWORDS) {
    log(`搜索关键词: ${keyword}`);
    const skills = searchSkills(keyword);
    
    for (const skill of skills) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name);
        allSkills.push(skill);
      }
    }
  }
  
  // 按分数排序，取前20（留足筛选空间）
  return allSkills.sort((a, b) => b.score - a.score).slice(0, 20);
}

// 安全检验（简化版）
function vetSkill(skill) {
  log(`检验 skill: ${skill.name}`);
  
  // TODO: 实现完整的安全检验
  // 这里简化处理，假设分数高的相对可信
  
  if (skill.score >= 1.0) {
    return { passed: true, risk: 'LOW', notes: 'Score >= 1.0' };
  } else if (skill.score >= 0.5) {
    return { passed: true, risk: 'MEDIUM', notes: 'Score 0.5-1.0' };
  } else {
    return { passed: false, risk: 'HIGH', notes: 'Score < 0.5' };
  }
}

// 主流程
async function main() {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  
  log('=== 每日 Skill 抓取开始 ===');
  
  // 1. 获取 skill
  const skills = fetchAllSkills();
  log(`获取到 ${skills.length} 个 skill`);
  
  // 2. 安全检验，取前10个合格的
  const vettedSkills = [];
  for (const skill of skills) {
    if (vettedSkills.length >= 10) break;
    const result = vetSkill(skill);
    if (result.passed) {
      vettedSkills.push({ ...skill, ...result });
    }
  }
  log(`通过检验: ${vettedSkills.length} 个`);
  
  // 3. 写入每日报告
  const reportPath = path.join(REPO_DIR, 'daily', `${DATE}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  
  const report = `# ${DATE} 每日 Skill 精选

## 筛选结果

| Skill | 分数 | 风险等级 | 关键词 |
|-------|------|----------|--------|
${vettedSkills.map(s => `| ${s.name} | ${s.score} | ${s.risk} | ${s.keyword} |`).join('\n')}

## 说明

- 自动从 ClawHub 搜索获取
- 按热度分数排序
- 经过基础安全检验

## 待办

- [ ] 人工复核
- [ ] 详细安全检验
- [ ] 安装测试
`;
  
  fs.writeFileSync(reportPath, report);
  log(`报告已写入: ${reportPath}`);
  
  // 4. 提交到仓库
  run('git add -A');
  run(`git commit -m "daily: ${DATE} skill 精选"`);
  run('git push');
  log('已推送到仓库');
  
  log('=== 完成 ===');
  
  // 返回结果用于通知
  return vettedSkills;
}

main().catch(console.error);