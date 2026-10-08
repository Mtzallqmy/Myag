# Beta Release Checklist

| Gate | Status | Notes |
|---|---|---|
| A Auth/RLS | PASS (automated) | RLS on all tables; security linter run |
| B Providers/Models/Chat | PASS (code + tests) | Needs a real provider token for live E2E |
| C Projects/Agent | PASS (code + tests) | Live job needs a provider |
| D GitHub | BLOCKED | Requires user PAT; branch workflow requires runtime |
| E MCP | PASS | Tested against public DeepWiki server in stage 2 |
| F Multi-agent | PASS (unit) | Bounded pipelines tested; live run needs a provider |
| G Memory/Usage | PASS (unit) | Validator + quota logic tested |
| H Admin RBAC | PASS (unit) | Server-side role checks on every admin function |
| I Security | PASS | See SECURITY.md |
| J PWA | PASS | Manifest, icons, guarded SW, offline shell |
| K Mobile responsive | Manual check pending | 360/390/430/768/1024 |
| L GitHub sync | User action | Connect the project to GitHub in Lovable |

## Before inviting testers
- [ ] Sign up, confirm email, claim SUPER_ADMIN in /admin.
- [ ] Add a provider, discover models, chat in Arabic and English.
- [ ] Upload a project, run SUGGEST in each agent mode, approve/reject a WORKSPACE patch.
- [ ] Toggle each kill switch and confirm the action is refused.
- [ ] Verify no tokens in localStorage/sessionStorage or repository.
- [ ] Publish and install the PWA on Android Chrome.
