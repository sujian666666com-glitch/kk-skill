## Description:

Scaffold a new full-stack app on the latest version of Nuxt, deployable to Cloudflare Workers via Wrangler, with NuxtHub for D1/KV/Blob bindings.

This skill is ready for commercial/non-commercial use.

## Publisher:

[techvoyage51](https://clawhub.ai/user/techvoyage51)

### License/Terms of Use:

MIT-0

## Use Case:

Developers and engineers use this skill to scaffold a production-oriented Nuxt application for Cloudflare Workers, including module selection, Nuxt and Wrangler configuration, testing setup, and optional Cloudflare resources such as D1, KV, and Blob storage.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The skill may create a production-oriented Nuxt project, install npm packages, and guide Wrangler commands that operate against a user's Cloudflare account.

Mitigation: Review the generated project, package choices, Wrangler commands, Cloudflare resource names, and account context before installing dependencies or deploying.

Risk: Placeholder domains, Cloudflare resource identifiers, analytics, ads, or consent settings may be inappropriate for the target release if copied unchanged.

Mitigation: Replace placeholders with verified project values and include analytics, ads, or consent modules only when the application explicitly requires them.

## Reference(s):

- [ClawHub skill page](https://clawhub.ai/techvoyage51/skills/scaffold-nuxt-cloudflare-app-skill)
- [Reference directory structure](artifact/references/directory-structure.md)
- [Nuxt config example](artifact/references/nuxt.config.example.ts)
- [Wrangler config example](artifact/references/wrangler.example.jsonc)
- [Package example](artifact/references/package.example.json)
- [Content config example](artifact/references/content.config.example.ts)
- [NuxtHub deployment specifics](artifact/references/nuxthub-deployment.md)
- [Nuxt UI documentation](https://ui.nuxt.com)
- [Antdv Next documentation](https://www.antdv-next.com)
- [Nuxt Content documentation](https://content.nuxt.com)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Antdv Next GitHub repository](https://github.com/antdv-next/antdv-next)

## Skill Output:

**Output Type(s):** [text, markdown, code, shell commands, configuration, guidance]

**Output Format:** [Markdown guidance with inline code, shell commands, and configuration examples]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Produces scaffold decisions and project files for a Nuxt application targeting Cloudflare Workers; no runtime service is bundled with the skill.]

## Skill Version(s):

1.0.0 (source: ClawHub release metadata)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
