# MVP Migration Skill - Conservative Conversion Guardrails

This skill provides guardrails for safe Classic-to-Lightning migration, minimizing user disruption while ensuring code quality and rollback capability.

## When to Use This Skill

Trigger this skill when:

- Converting Aura or Visualforce components to LWC
- Planning a migration batch or sprint
- Assessing whether a component is ready for conversion
- Reviewing converted code before deployment

---

## 1. Conversion Mode Enforcement

**ALWAYS use scaffolding mode (no `--full` flag) for MVP phase.**

```bash
# CORRECT - MVP approach
node dist/index.js aura AccountCard
node dist/index.js vf ContactList --controller ContactListController

# AVOID during MVP - full automation
node dist/index.js aura AccountCard --full  # Only after validation gates pass
```

**Why scaffolding first:**

- Generates TODO comments requiring human review
- Highlights areas needing manual attention
- Prevents silent conversion errors from reaching production
- Full automation only after component has passed all validation gates

---

## 2. Component Triage Matrix

Classify each component before conversion:

| Risk Level | Criteria | Action |
|------------|----------|--------|
| **GREEN** (Convert Now) | Display-only, <5 event handlers, no Apex DML, standalone component | Convert in MVP |
| **YELLOW** (Phase 2) | Simple forms, single Apex call, <10 handlers, minimal state | Queue for review |
| **RED** (Defer) | RemoteActions, complex state management, cross-component events, iframes | Requires manual assessment |

### GREEN Examples

- Read-only data display cards
- Static navigation components
- Simple button groups
- Icon/badge display components

### YELLOW Examples

- Single-field edit forms
- Components with one `@wire` data fetch
- Simple modals with confirm/cancel

### RED Examples

- Multi-step wizards
- Components using `$A.enqueueAction` chains
- Anything with ViewState manipulation
- Components embedded in Visualforce pages via `<apex:includeLightning>`

---

## 3. Risk Pattern Flags

When these patterns are detected, **flag for manual review**:

### High-Risk Aura Patterns

| Pattern | Risk | Mitigation |
|---------|------|------------|
| `$A.enqueueAction` chains | Callback dependency hell | Refactor to async/await before converting |
| `aura:registerEvent` / `aura:handler` (cross-component) | Event coupling breaks | Map event flow first, consider pub/sub |
| `component.find()` with dynamic names | Runtime errors | Ensure refs exist before conversion |
| `$A.getCallback()` | Timing issues | Review all callback usage |
| `force:navigateToComponent` | Navigation model differs | Use `NavigationMixin` |

### High-Risk Visualforce Patterns

| Pattern | Risk | Mitigation |
|---------|------|------------|
| `apex:actionFunction` with `rerender` | Complex partial page refresh | Break into smaller components |
| `apex:actionSupport` | Implicit AJAX behavior | Make explicit in LWC |
| `apex:inputHidden` for state | ViewState dependency | Move to component state |
| `{!$CurrentPage.parameters.*}` | URL parameter handling differs | Use `CurrentPageReference` |
| `apex:actionRegion` | Partial form submission | Redesign form architecture |
| `window.location` / URL hacking | Navigation issues | Use proper navigation service |

### Universal Red Flags

- Any use of `eval()` or dynamic code execution
- Direct DOM manipulation (`document.getElementById`)
- `setTimeout`/`setInterval` without cleanup
- Global variable dependencies
- Cross-origin iframe communication

---

## 4. Validation Gates

**All gates must pass before MVP deployment.**

### Pre-Conversion Gates

- [ ] **Documentation exists**: Component purpose and behavior documented
- [ ] **User count identified**: Components with <10 active users are lower risk
- [ ] **Business criticality assessed**: Non-critical components only for MVP
- [ ] **Existing bugs documented**: Do not convert broken code (fix first or defer)
- [ ] **Dependencies mapped**: Know what calls this component and what it calls
- [ ] **Test data available**: Have scenarios to validate conversion

### Post-Conversion Gates

- [ ] **Developer review complete**: Human reviewed all generated code
- [ ] **TODO items addressed**: No unresolved TODO comments remain
- [ ] **Jest tests written**: Cover key user interactions and data flows
- [ ] **Side-by-side comparison done**: Tested in sandbox alongside original
- [ ] **Original component preserved**: Rollback-ready (not deleted/modified)
- [ ] **Accessibility verified**: ARIA labels, keyboard navigation work
- [ ] **Stakeholder sign-off obtained**: Business owner approved

### Deployment Gates

- [ ] **Sandbox validated**: Works in full sandbox for 48+ hours
- [ ] **Pilot users identified**: 1-3 champions for initial rollout
- [ ] **Rollback plan documented**: Know exactly how to revert
- [ ] **Monitoring in place**: Can detect issues quickly
- [ ] **Not during freeze**: No deploys during release freeze periods
- [ ] **Not on Friday**: Block end-of-week deploys for new conversions

---

## 5. Rollback Strategy

### MVP Rollback Protocol

```
1. PRESERVE: Keep original Aura/VF component intact (do not delete)
2. PARALLEL: Deploy LWC alongside original
3. CONTROL: Use permission sets to control who sees LWC
4. REVERT: If issues arise, revoke permission set - users see original
5. DEPRECATE: Only remove original after 2-week stable period
```

### Implementation

```xml
<!-- Permission set for LWC access -->
<PermissionSet>
    <label>LWC Early Adopter - AccountCard</label>
    <description>Enables new LWC version of AccountCard</description>
    <!-- Tab visibility, component access, etc. -->
</PermissionSet>
```

### Rollback Timeline

| Day | Action |
|-----|--------|
| Day 0 | Deploy LWC, enable for pilot users only |
| Day 1-3 | Monitor, gather feedback |
| Day 4-7 | Fix any issues discovered |
| Day 8 | Expand to broader user group |
| Day 14 | If stable, begin deprecation of original |
| Day 21 | Remove original (if no issues) |

---

## 6. Team Capacity Guidelines

### MVP Velocity Limits

```
Constraints:
- Max 2 components in active conversion at a time
- Each component needs a dedicated reviewer (not the converter)
- No new conversions during release freeze windows
- No Friday deploys of newly converted components
- Allow 1 week buffer between component deployments
```

### Capacity Planning

| Team Size | Components/Sprint | Review Time/Component |
|-----------|-------------------|----------------------|
| 1-2 devs | 1 component | 2-3 days |
| 3-4 devs | 2 components | 1-2 days each |
| 5+ devs | 3 components max | 1 day each |

### When to Pause

Stop new conversions if:

- More than 2 issues reported on recently deployed LWC
- Team member unavailable for review
- Upcoming major release or demo
- Production incident in progress

---

## 7. User Disruption Controls

### Pilot Approach (Required for MVP)

```
Phase 1 - Internal Champions (Week 1)
├── Enable LWC for 1-3 internal power users
├── Daily check-ins for feedback
├── Fix any issues immediately
└── Document all feedback

Phase 2 - Expanded Pilot (Week 2)
├── Add 5-10 more users
├── Include less technical users
├── Monitor support tickets
└── Refine based on feedback

Phase 3 - Full Rollout (Week 3+)
├── Enable for all users
├── Keep original available for 2 weeks
├── Monitor adoption metrics
└── Celebrate success!
```

### Communication Template

```
Subject: New [Component Name] Experience Available

Hi [User/Team],

We've modernized [Component Name] to improve your experience.

What's new:
- [Benefit 1]
- [Benefit 2]

What to expect:
- You may notice [minor UI difference]
- Same functionality, refreshed look

Need help?
- Quick reference: [link]
- Questions: [contact]
- Prefer the old version? Let us know.

Thanks for your patience during this improvement!
```

---

## 8. Integration with Other Skills

This skill works alongside:

| Skill | Purpose |
|-------|---------|
| `migration/aura-to-lwc.md` | Detailed Aura conversion patterns |
| `migration/vf-to-lwc.md` | Detailed VF conversion patterns |
| `lwc/component-architecture.md` | LWC best practices |
| `lwc/wire-adapters.md` | Data fetching patterns |
| `lwc/event-handling.md` | Event handling patterns |

Reference commands:

- `/migration-checklist` - Generate detailed checklist for specific component
- `/security-check` - Validate security of converted component

---

## 9. Conversion Output Template

When running a conversion, output should include:

```
═══════════════════════════════════════════════════════════════
MVP MIGRATION STATUS
═══════════════════════════════════════════════════════════════

Component: [ComponentName]
Source Type: [Aura/Visualforce]
Classification: [GREEN/YELLOW/RED]

Risk Patterns Detected:
  [x] $A.enqueueAction (callback chain)
  [ ] Cross-component events
  [x] Dynamic component.find()

Conversion Mode: SCAFFOLDING (MVP compliant)

═══════════════════════════════════════════════════════════════
REQUIRED BEFORE DEPLOYMENT
═══════════════════════════════════════════════════════════════

Pre-Conversion:
  [ ] Component documented
  [ ] User count identified
  [ ] Business criticality assessed
  [ ] Existing bugs documented

Post-Conversion:
  [ ] Developer review complete
  [ ] TODO items addressed
  [ ] Jest tests written
  [ ] Side-by-side comparison done
  [ ] Original preserved for rollback
  [ ] Stakeholder sign-off

═══════════════════════════════════════════════════════════════
```

---

## Quick Reference

### Go / No-Go Decision

```
Can I convert this component for MVP?

START
  │
  ├─ Is it GREEN tier? ─── No ──→ DEFER (not MVP)
  │         │
  │        Yes
  │         │
  ├─ Are all pre-conversion gates met? ─── No ──→ WAIT (complete gates)
  │         │
  │        Yes
  │         │
  ├─ Is team capacity available? ─── No ──→ QUEUE (wait for bandwidth)
  │         │
  │        Yes
  │         │
  └─────→ CONVERT (proceed with scaffolding mode)
```

### Emergency Rollback

```bash
# Immediate rollback steps:
1. Remove user from LWC permission set
2. Clear browser cache / hard refresh
3. User now sees original component
4. Document issue for review
5. Do NOT delete the LWC (analyze first)
```

---

## Success Metrics

Track these to validate MVP approach:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Conversion success rate | >90% | Components deployed without rollback |
| User-reported issues | <2 per component | Support tickets first 2 weeks |
| Time to rollback | <5 minutes | From issue report to user restored |
| Developer confidence | High | Survey after each conversion |
| Stakeholder satisfaction | Positive | Feedback after pilot phase |
