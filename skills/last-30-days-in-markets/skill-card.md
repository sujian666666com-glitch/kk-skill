## Description:

This skill helps agents generate an auditable last-30-days US equities market brief from read-only SentiSense API data, including market mood, clustered story themes, sentiment, signals, current standing, and upcoming earnings.

This skill is ready for commercial/non-commercial use.

## Publisher:

[thesentitrader](https://clawhub.ai/user/thesentitrader)

### License/Terms of Use:

MIT-0

## Use Case:

Developers and market-research users use this skill to fetch SentiSense data and synthesize an auditable month-in-review brief for US equities. It is intended for research and education, not investment advice or trading execution.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: Market-research output may be mistaken for investment advice.

Mitigation: Keep the required disclaimer in the brief and state that the output is for research and education only, not a recommendation to buy or sell securities.

Risk: Using the skill sends market-research requests to SentiSense with an API key.

Mitigation: Use a SentiSense API key only when that data sharing is acceptable, keep the key in SENTISENSE_API_KEY, and avoid logging or committing it.

Risk: API quota, rate limits, or preview-tier limits may reduce coverage.

Mitigation: Honor Retry-After for per-minute limits, stop on quota exhaustion, and state missing or preview-limited layers in the output coverage line.

Risk: A generated recap can overstate causality or include claims not supported by fetched data.

Mitigation: Use only fetched SentiSense response fields, report actual coverage windows, and avoid stronger causal language than the data supports.

## Reference(s):

- [ClawHub skill page](https://clawhub.ai/thesentitrader/skills/last-30-days-in-markets)
- [SentiSense website](https://sentisense.ai)
- [SentiSense API reference](https://sentisense.ai/skill.md)
- [SentiSense API key](https://app.sentisense.ai/get-api-key)

## Skill Output:

**Output Type(s):** [Text, Markdown, Shell commands, Guidance]

**Output Format:** [Markdown market brief with dated sections, tables, coverage notes, and a disclaimer; may include inline shell commands for SentiSense API calls.]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Requires SENTISENSE_API_KEY and read-only HTTPS calls to SentiSense; output should state actual coverage windows, preview-tier limits, and that it is not investment advice.]

## Skill Version(s):

1.0.2 (source: server release metadata)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
