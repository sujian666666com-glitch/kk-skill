# Verification Method

## Functional Verification

Run the skill's own test script:

```bash
bash scripts/test-cli-commands.sh {skill-path} --executor cli   # CLI priority
bash scripts/test-cli-commands.sh {skill-path} --executor sdk   # SDK fallback
```

## Specification Compliance Verification

```bash
bash scripts/validate-skill.sh {skill-path}
```

The validation checks, among others:

- SKILL.md exists with YAML frontmatter (`name`, `description`, no `version`)
- Required sections present: Overview, Prerequisites, Workflow, Core Commands, Parameter Confirmation, Reference Documents
- `references/iam-policies.md` and `references/cli-installation-guide.md` exist
- No credential hardcoding
- File count <= 30, SKILL.md lines <= 500

## Expected Output

A successful query returns the DCS (Redis/Memcached) instance count, e.g.:

```text
DCS instance count: 15
```

When using the count-only CLI lookup, a single number is returned:

```text
15
```

When using the per-engine breakdown, engine and status counts are returned:

```text
Redis: 15 | Memcached: 0 | Running: 15
```

When using the per-status breakdown, counts per status are returned:

```text
running_count: 15
```

## Error Cases

| Scenario | Expected behavior |
|----------|-------------------|
| Invalid `--status` value | hcloud returns a clear API/usage error, not a masked PASS |
| Invalid region in SDK helper | Friendly `ERROR: DCS query failed for region '...'` message, no raw traceback |
| AK/SK missing | `ERROR: HUAWEI_ACCESS_KEY / HUAWEI_SECRET_KEY not set`, exit code 2 |
