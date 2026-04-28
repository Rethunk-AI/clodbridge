# Security Policy

## Reporting Security Vulnerabilities

**DO NOT** open a public GitHub issue for security vulnerabilities. Instead, please report them responsibly to:

**Email:** security@rethunk.tech  
**Response SLA:** We aim to respond to security reports within 24 hours.

When reporting a vulnerability, please include:
- Description of the vulnerability
- Affected component(s) and version(s)
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (optional)

## Scope

clodbridge is an MCP server that loads and executes custom rules, skills, and agents from the `.cursor/` directory. Security considerations include:

- **Rule Execution** — Rules are YAML+Markdown and do not execute code directly; they configure Claude Code behavior
- **Skill/Agent Discovery** — clodbridge discovers skill definitions but does not execute them; Claude Code is responsible for loading and executing
- **File Parsing** — YAML, Markdown, and JSON parsing may be vulnerable to injection or DoS attacks
- **MCP Protocol** — Communication with Claude Code uses standard MCP transport (stdio/TCP)

## Supported Versions

The following versions of clodbridge are currently supported with security updates:

| Version | Release Date | Support Status | End of Support |
|---------|--------------|---|---|
| 2.x | April 2026 | Active | April 2027 |
| 1.x | 2025 | Maintenance | April 2026 |

Only the current major version receives active security patches. Users are encouraged to upgrade to the latest version.

## Security Practices

### Input Validation
- YAML and JSON parsing use safe parsers with configurable limits
- File paths are validated to prevent directory traversal
- Skill/rule names sanitized to prevent injection

### Code Execution
- clodbridge loads rules/skills as data structures, not executable code
- No eval, exec, or dynamic code generation
- All code in this repository is reviewed before merge

### Dependency Management
- Dependencies regularly audited via `npm audit`
- CI/CD pipeline includes security scanning
- Known vulnerabilities addressed promptly
- Major version updates reviewed before upgrade

## Known Vulnerabilities

None currently known. Reports are welcome via security@rethunk.tech.

## Testing & Validation

- All code changes go through CI/CD (lint, type-check, tests, 80%+ coverage)
- Security scanning runs on every push
- File parsing tested with edge cases and malformed input
- MCP protocol compliance verified

## Third-Party Dependencies

clodbridge depends on external libraries. Security advisories are monitored via:
- `npm audit` — regular dependency audits
- GitHub Dependabot — automated vulnerability scanning
- Manual review of major version updates

## Incident Response

In the event of a confirmed security vulnerability:
1. Impact assessment and triage
2. Fix development in private branch
3. Security update release
4. Public disclosure (after patch availability)
5. Post-incident review

## Contact

- **Security Issues:** security@rethunk.tech
- **General Support:** support@rethunk.tech
- **Website:** https://rethunk.tech

---

**Last updated:** 2026-04-27
