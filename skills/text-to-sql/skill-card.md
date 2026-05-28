## Description: <br>
Converts a provided database schema and natural-language data request into a syntactically correct SQL query. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[wangjipeng977](https://clawhub.ai/user/wangjipeng977) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
External users, developers, and data practitioners use this skill to draft SQL from plain-English requests when they can provide table and column schema. It is intended for query writing and explanation, not for executing SQL or analyzing returned data. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: Generated SQL may be incorrect, inefficient, or too broad for a production database. <br>
Mitigation: Review the query against the provided schema and test it in a safe environment before using it on live data. <br>
Risk: Queries that modify data or touch sensitive tables can cause business or privacy impact if run without oversight. <br>
Mitigation: Require human approval before executing generated SQL, especially for write operations or sensitive datasets. <br>


## Reference(s): <br>
- [Skill reference index](references/index.md) <br>
- [Skill metadata source](https://github.com/MiniMax-AI/skills) <br>
- [ClawHub skill page](https://clawhub.ai/wangjipeng977/text-to-sql) <br>


## Skill Output: <br>
**Output Type(s):** [text, markdown, code, guidance] <br>
**Output Format:** [Markdown with SQL code blocks and concise explanatory text] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [May include inline SQL comments or alternative query approaches depending on the selected mode.] <br>

## Skill Version(s): <br>
999.0.0 (source: ClawHub release metadata) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
