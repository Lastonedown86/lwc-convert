---
description: Comprehensive strategy and framework for migrating from Salesforce Classic to Lightning Experience
---

# Classic to Lightning Migration Strategy

A robust framework for migrating legacy Salesforce implementations to Lightning Experience (LEX). This guide covers strategy, assessment, and technical feature mapping.

## Migration Phases

### 1. Assessment & Readiness
Before writing code, evaluate the current state:
- **Lightning Readiness Check**: Run this built-in tool (Setup > Lightning Experience > Check Readiness) to identify incompatible features.
- **Salesforce Optimizer**: Run the Optimizer App to find unused metadata, limits usage, and legacy API versions.
- **Manual Audit**:
    - Inventory all Visualforce pages and JavaScript buttons.
    - Identify hardcoded URLs (e.g., `/apex/MyPage`, `/servlet/servlet.FileDownload`).
    - Review `window.location` and `document` usage in JavaScript.

### 2. Strategy Selection
Choose a rollout strategy based on complexity:
- **Pilot**: Enable LEX for a small group of power users. Good for low-risk feedback.
- **Hybrid**: Users switch between Classic and Lightning. *Not recommended long-term* due to context switching costs.
- **Full Cutover**: Move entire teams or profiles to LEX at once. Best for maintaining data integrity and adoption.

## Feature Mapping & Modernization

Map legacy features to their Lightning equivalents.

| Classic Feature | Lightning Replacement | Skill Reference |
|-----------------|-----------------------|-----------------|
| Visualforce Pages | Lightning Web Components (LWC) | [vf-to-lwc.md](vf-to-lwc.md) |
| Aura Components | Lightning Web Components (LWC) | [aura-to-lwc.md](aura-to-lwc.md) |
| JavaScript Buttons | Quick Actions / Screen Flows | [js-button-replacement.md](js-button-replacement.md) |
| URL Hacks | NavigationMixin / Page References | [js-button-replacement.md](js-button-replacement.md) |
| Attachments | Salesforce Files | N/A (Data Migration) |
| Classic Notes | Enhanced Notes | N/A (Data Migration) |

### UI/UX Modernization
Don't just "lift and shift." Re-imagine the experience:
- **App Builder**: Use standard components (Tabs, Accordions, Related Lists) to reduce custom code.
- **Utility Bar**: Move persistent tools (Softphone, Notes, History) to the utility bar.
- **Console Apps**: Use Split View and Workspace Tabs for high-volume users.

## Technical Considerations

### Navigation & URL Management
Classic relies on URL manipulation. Lightning uses state-based navigation.
- **DO NOT** use `window.location.href = '/...'`.
- **DO** use `NavigationMixin` in LWC.
- **DO** use `PageReference` types (`standard__recordPage`, `standard__navItemPage`).

### Communication Patterns
- **Classic**: `window.opener`, direct DOM access.
- **Lightning**:
    - **LWC to LWC**: Custom Events (bubbling).
    - **Across DOM/Visualforce**: Lightning Message Service (LMS).
    - **Visualforce to LWC**: `window.postMessage` (if IFramed).

### Security (Locker Service / LWS)
Lightning Web Security (LWS) enforces strict isolation.
- **No** arbitrary DOM access (e.g., jQuery selectors on other components).
- **No** calling private APIs or global variables not whitelisted.
- **Strict** Content Security Policy (CSP) for external scripts/images.

## Adoption & Change Management

Technical success does not equal project success.
- **In-App Guidance**: Use Prompts and Walkthroughs to train users within the flow of work.
- **Feedback Loop**: Create a "Lightning Feedback" global action for users to report gaps immediately.
- **Performance**: Monitor EPT (Experienced Page Time). If > 3s, optimize LWC and reduce component density.
