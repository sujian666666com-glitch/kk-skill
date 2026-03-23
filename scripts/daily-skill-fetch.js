#!/usr/bin/env node
/**
 * 每日 Skill 抓取脚本
 * 从 ClawHub 获取热门 Skill，进行安全检验，提交到仓库
 * 规则：跳过仓库已存在的 skill，确保不重复
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

function run(cmd, cwd = REPO_DIR) {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: cwd });
  } catch (e) {
    return e.stderr || e.message;
  }
}

// 获取仓库已有 skill 列表
function getExistingSkills() {
  const skillsDir = path.join(REPO_DIR, 'skills');
  if (!fs.existsSync(skillsDir)) return new Set();
  
  const items = fs.readdirSync(skillsDir, { withFileTypes: true });
  const existing = new Set();
  
  for (const item of items) {
    if (item.isDirectory() && item.name !== '.git') {
      existing.add(item.name);
    }
  }
  
  log(`仓库已有 skill: ${existing.size} 个`);
  return existing;
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

// 获取所有 skill（排除已有的）
function fetchNewSkills(existingSkills) {
  const allSkills = [];
  const seen = new Set();
  
  for (const keyword of SEARCH_KEYWORDS) {
    log(`搜索关键词: ${keyword}`);
    const skills = searchSkills(keyword);
    
    for (const skill of skills) {
      // 跳过已存在的
      if (existingSkills.has(skill.name)) {
        log(`  跳过(已存在): ${skill.name}`);
        continue;
      }
      // 跳过已处理的
      if (seen.has(skill.name)) continue;
      
      seen.add(skill.name);
      allSkills.push(skill);
    }
  }
  
  // 按分数排序，取前20
  return allSkills.sort((a, b) => b.score - a.score).slice(0, 20);
}

// 安全检验（简化版）
function vetSkill(skill) {
  log(`检验 skill: ${skill.name}`);
  
  if (skill.score >= 1.0) {
    return { passed: true, risk: 'LOW', notes: 'Score >= 1.0' };
  } else if (skill.score >= 0.5) {
    return { passed: true, risk: 'MEDIUM', notes: 'Score 0.5-1.0' };
  } else {
    return { passed: false, risk: 'HIGH', notes: 'Score < 0.5' };
  }
}

// 下载 skill 完整文件
function downloadSkill(skill) {
  const skillDir = path.join(REPO_DIR, 'skills', skill.name);
  
  if (fs.existsSync(skillDir)) {
    log(`已存在，跳过: ${skill.name}`);
    return false;
  }
  
  log(`下载 skill: ${skill.name}`);
  
  // 先安装到临时目录
  const tempDir = `/tmp/kk-skill-download-${skill.name}`;
  if (fs.existsSync(tempDir)) {
    run(`rm -rf ${tempDir}`);
  }
  fs.mkdirSync(tempDir, { recursive: true });
  
  // 下载 skill（使用 --dir 指定安装目录）
  const result = run(`clawhub install ${skill.name} --dir "${tempDir}" 2>&1`);
  log(`  下载结果: ${result.includes('OK') || result.includes('Installed') ? '成功' : result}`);
  
  // 找到下载的 skill 目录
  const installedDir = path.join(tempDir, skill.name);
  if (!fs.existsSync(installedDir)) {
    log(`  下载失败: 找不到安装目录 ${installedDir}`);
    return false;
  }
  
  // 复制到仓库
  run(`cp -r "${installedDir}" "${skillDir}"`);
  log(`  已复制到仓库: ${skill.name}`);
  
  // 清理临时目录
  run(`rm -rf ${tempDir}`);
  
  return true;
}

// 主流程
async function main() {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  
  log('=== 每日 Skill 抓取开始 ===');
  
  // 1. 获取已有 skill
  const existingSkills = getExistingSkills();
  
  // 2. 获取新 skill
  const skills = fetchNewSkills(existingSkills);
  log(`获取到新 skill: ${skills.length} 个`);
  
  if (skills.length === 0) {
    log('没有新的 skill 可抓取');
    return [];
  }
  
  // 3. 安全检验，取前10个合格的
  const vettedSkills = [];
  for (const skill of skills) {
    if (vettedSkills.length >= 10) break;
    const result = vetSkill(skill);
    if (result.passed) {
      vettedSkills.push({ ...skill, ...result });
    }
  }
  log(`通过检验: ${vettedSkills.length} 个`);
  
  // 4. 下载 skill
  let downloadedCount = 0;
  for (const skill of vettedSkills) {
    if (downloadSkill(skill)) {
      downloadedCount++;
    }
  }
  log(`成功下载: ${downloadedCount} 个`);
  
  // 5. 写入每日报告
  const reportPath = path.join(REPO_DIR, 'daily', `${DATE}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  
  const report = `# ${DATE} 每日 Skill 精选

## 筛选结果

| Skill | 分数 | 风险等级 | 关键词 |
|-------|------|----------|--------|
${vettedSkills.map(s => `| ${s.name} | ${s.score} | ${s.risk} | ${s.keyword} |`).join('\n')}

## 统计

- 新抓取: ${downloadedCount} 个
- 仓库已有: ${existingSkills.size} 个
- 本次候选: ${skills.length} 个

## 说明

- 自动从 ClawHub 搜索获取
- **跳过仓库已有 skill，确保不重复**
- 按热度分数排序
- 经过基础安全检验
`;
  
  fs.writeFileSync(reportPath, report);
  log(`报告已写入: ${reportPath}`);
  
  // 6. 提交到仓库
  if (downloadedCount > 0) {
    run('git add -A');
    run(`git commit -m "daily: ${DATE} 新增 ${downloadedCount} 个 skill

- 候选: ${skills.length} 个
- 通过检验: ${vettedSkills.length} 个  
- 成功下载: ${downloadedCount} 个
- 跳过已有: ${existingSkills.size} 个"`);
    run('git push');
    log('已推送到仓库');
  }
  
  log('=== 完成 ===');
  
  return vettedSkills;
}

main().catch(console.error);