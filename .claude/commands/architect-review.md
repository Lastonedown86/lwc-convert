# Solution Architect Review

Perform an architectural review of the code/design with these perspectives:

## Architecture Assessment

### Component Design
- Is the component properly scoped (single responsibility)?
- Are dependencies minimized and explicit?
- Is state management appropriate (local vs shared)?
- Are public APIs (`@api`) well-defined?

### Data Flow
- Is data flowing in the right direction (parent → child)?
- Are events used correctly for child → parent communication?
- Is the wire service used appropriately for reactive data?
- Are there unnecessary data transformations?

### Performance Considerations
- Are there N+1 query patterns?
- Is data being fetched at the right level?
- Are there unnecessary re-renders?
- Is caching used effectively (`cacheable=true`)?

### Scalability
- Will this work with large data sets?
- Are there governor limit concerns?
- Is pagination implemented where needed?
- Are bulk operations handled correctly?

### Maintainability
- Is the code self-documenting?
- Are there clear separation of concerns?
- Is error handling consistent?
- Are there any code smells?

## Recommendations Format

For each issue found, provide:
1. **Issue**: What's wrong
2. **Impact**: Why it matters
3. **Recommendation**: How to fix it
4. **Priority**: High/Medium/Low

## Architecture Patterns to Recommend

### Service Layer Pattern
```
Component → Service → Apex Controller → Database
```

### Event-Driven Communication
```
Child --CustomEvent--> Parent --@api--> Other Children
```

### State Management
- Local state: Component properties
- Shared state: LMS (Lightning Message Service)
- Persistent state: Custom Settings / Platform Cache

Provide actionable architectural feedback.
