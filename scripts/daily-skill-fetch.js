#!/usr/bin/env node
/**
 * 每日 Skill 抓取脚本
 * 从 ClawHub trending 拉取热门 skill，做基础安全扫描，安装通过项并写入日报。
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REPO_DIR = process.env.HOME + '/clawd/kk-skill';
const DATE = new Date().toISOString().split('T')[0];
const LOG_FILE = path.join(REPO_DIR, 'logs', `fetch-${DATE}.log`);
const DAILY_DIR = path.join(REPO_DIR, 'daily');
const SKILLS_DIR = path.join(REPO_DIR, 'skills');
const TREND_LIMIT = 60;
const INSTALL_LIMIT = 4;
const EXCLUDED_SLUGS = new Set([
  '1password',
  'imsg',
  'camsnap',
  'food-order',
  'ordercli',
  'auto-updater',
  'proactive-agent',
  'self-improving-agent',
]);
const HIGH_RISK_KEYWORDS = [
  'password', 'credential', 'secret', 'token', 'sms', 'imessage', 'camera',
  'rtsp', 'order', 'payment', 'autonomous', 'self-improving', 'self improving',
  'updater', 'update clawdbot', 'memory', 'browser cookies', '.ssh', '.aws',
];
const RED_FLAG_PATTERNS = [
  /~\/.ssh/i,
  /~\/.aws/i,
  /MEMORY\.md/i,
  /USER\.md/i,
  /SOUL\.md/i,
  /IDENTITY\.md/i,
  /eval\(/i,
  /sudo\b/i,
  /base64\.b64decode/i,
  /curl\s+https?:\/\//i,
  /wget\s+https?:\/\//i,
];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function run(cmd, cwd = REPO_DIR, options = {}) {
  return execSync(cmd, {
    encoding: 'utf-8',
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
}

function runSafe(cmd, cwd = REPO_DIR) {
  try {
    return { ok: true, output: run(cmd, cwd) };
  } catch (e) {
    return { ok: false, output: e.stderr || e.stdout || e.message };
  }
}

function getExistingSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return new Set();
  return new Set(
    fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((item) => item.isDirectory() && item.name !== '.git')
      .map((item) => item.name),
  );
}

function fetchTrendingSkills(existingSkills) {
  log(`拉取 ClawHub trending（limit=${TREND_LIMIT}）`);
  const raw = run(`clawhub explore --sort trending --limit ${TREND_LIMIT} --json`);
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];

  return items
    .map((item) => ({
      slug: item.slug,
      summary: item.summary || '',
      owner: item.metadata?.ownerHandle || item.ownerHandle || 'unknown',
      updatedAt: item.updatedAt,
      version: item.latestVersion?.version || 'unknown',
      installsAllTime: item.stats?.installsAllTime ?? 0,
      downloads30d: item.stats?.downloads30d ?? 0,
      rating: item.stats?.averageRating ?? null,
    }))
    .filter((item) => item.slug && !existingSkills.has(item.slug));
}

function getRiskFromText(text) {
  const lowered = text.toLowerCase();
  if (HIGH_RISK_KEYWORDS.some((keyword) => lowered.includes(keyword))) return 'HIGH';
  if (lowered.includes('api') || lowered.includes('network') || lowered.includes('youtube')) return 'MEDIUM';
  return 'LOW';
}

function inspectFiles(slug) {
  const filesRaw = run(`clawhub inspect ${slug} --files`);
  const files = [];
  for (const line of filesRaw.split('\n')) {
    const match = line.match(/^([^\s].*?)\s{2,}\d/);
    if (match && !match[1].includes('Summary:')) files.push(match[1].trim());
  }
  return files.filter((file) => file !== 'Files:' && file !== slug);
}

function fetchFile(slug, file) {
  const result = runSafe(`clawhub inspect ${slug} --file ${JSON.stringify(file)}`);
  return result.ok ? result.output : '';
}

function vetSkill(skill) {
  if (EXCLUDED_SLUGS.has(skill.slug)) {
    return { ...skill, passed: false, risk: 'HIGH', verdict: 'REJECT', notes: '命中排除名单' };
  }

  const files = inspectFiles(skill.slug).slice(0, 12);
  const reviewed = [];
  const redFlags = [];
  let combinedText = `${skill.slug}\n${skill.summary}`;

  for (const file of files) {
    if (!/^(SKILL\.md|package\.json|scripts\/.*|snippets\/.*)$/i.test(file)) continue;
    const content = fetchFile(skill.slug, file);
    reviewed.push(file);
    combinedText += `\n${content}`;
    for (const pattern of RED_FLAG_PATTERNS) {
      if (pattern.test(content)) redFlags.push(`${file}: ${pattern}`);
    }
  }

  let risk = getRiskFromText(combinedText);
  if (redFlags.length > 0) risk = 'HIGH';

  const passed = risk !== 'HIGH';
  const verdict = passed ? (risk === 'LOW' ? 'SAFE' : 'CAUTION') : 'REJECT';
  return {
    ...skill,
    filesReviewed: reviewed,
    redFlags,
    risk,
    passed,
    verdict,
    notes:
      verdict === 'SAFE'
        ? '未发现明显红旗'
        : verdict === 'CAUTION'
          ? '存在明确外部依赖/网络调用，但用途可解释'
          : '存在高风险能力或命中红旗/排除规则',
  };
}

function installSkill(slug) {
  const result = runSafe(`clawhub install ${slug} --dir skills`);
  if (!result.ok) throw new Error(result.output);
  return result.output;
}

function writeReport({ existingCount, candidates, approved, rejected, installed }) {
  fs.mkdirSync(DAILY_DIR, { recursive: true });
  const reportPath = path.join(DAILY_DIR, `${DATE}.md`);
  const lines = [
    `# ${DATE} 每日 Skill 精选`,
    '',
    '## 本次收录',
    '',
    '| Skill | installsAllTime | 风险等级 | 结论 | 说明 |',
    '|---|---:|---|---|---|',
    ...approved.map((s) => `| ${s.slug} | ${s.installsAllTime} | ${s.risk === 'LOW' ? '🟢 LOW' : '🟡 MEDIUM'} | 收录 | ${s.notes} |`),
    '',
    '## 明确排除',
    '',
    '| Skill | 原因 |',
    '|---|---|',
    ...rejected.map((s) => `| ${s.slug} | ${s.notes} |`),
    '',
    '## 统计',
    '',
    `- 仓库已有：${existingCount} 个`,
    `- 趋势池检查：${candidates.length} 个`,
    `- 通过基础 vetting：${approved.length} 个`,
    `- 明确排除：${rejected.length} 个`,
    `- 实际安装：${installed.length} 个`,
    '',
    '## 安装列表',
    '',
    ...installed.map((slug) => `- ${slug}`),
    '',
    '## 说明',
    '',
    '- 数据源：`clawhub explore --sort trending`',
    '- 安全检验：排除名单 + 文件抽样 + 红旗模式扫描',
    '- 高风险（凭证/隐私/自动执行）热门项默认不收录',
  ];
  fs.writeFileSync(reportPath, lines.join('\n'));
  return reportPath;
}

async function main() {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  log('=== 每日 Skill 抓取开始 ===');

  const existingSkills = getExistingSkills();
  log(`仓库已有 skill: ${existingSkills.size} 个`);

  const candidates = fetchTrendingSkills(existingSkills);
  log(`新候选: ${candidates.length} 个`);

  const vetted = candidates.map(vetSkill).sort((a, b) => b.installsAllTime - a.installsAllTime);
  const approved = vetted.filter((item) => item.passed).slice(0, INSTALL_LIMIT);
  const rejected = vetted.filter((item) => !item.passed).slice(0, 12);

  const installed = [];
  for (const skill of approved) {
    log(`安装 skill: ${skill.slug} (${skill.risk})`);
    installSkill(skill.slug);
    installed.push(skill.slug);
  }

  const reportPath = writeReport({
    existingCount: existingSkills.size,
    candidates,
    approved,
    rejected,
    installed,
  });
  log(`报告已写入: ${reportPath}`);

  log('=== 完成 ===');
}

main().catch((error) => {
  log(`ERROR: ${error.stack || error.message}`);
  process.exit(1);
});
