---
Status: Draft | In Review | Approved
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
---

# Workflow: <Feature> — <Action>

## Summary

<One sentence describing what this workflow accomplishes.>

## Trigger

<What initiates this workflow?>

## Actors

- **Primary:** <User Role>
- **System:** <Application Name>

## Preconditions

- <What must be true before this workflow can start?>
- <Required permissions>

## Steps

### Happy Path

1. **User:** <Action>
2. **System:** <Response>
3. **User:** <Action>
4. **System:** <Response>
5. **Result:** <Outcome>

### Alternative Paths

#### Path A: <Scenario Name>

**When:** <Condition>

1. <Step>
2. <Step>

#### Path B: <Scenario Name>

**When:** <Condition>

1. <Step>
2. <Step>

## Failure Scenarios

### Scenario 1: <Name>

- **Trigger:** <What causes this>
- **System Response:** <What happens>
- **User Recovery:** <How user can fix it>

### Scenario 2: <Name>

- **Trigger:** <What causes this>
- **System Response:** <What happens>
- **User Recovery:** <How user can fix it>

## Notifications

| Event | Channel | Recipient | Message |
|-------|---------|-----------|---------|
| <Event> | Email | <Who> | <What> |
| <Event> | In-App | <Who> | <What> |

## Permissions

| Role | Can Execute? | Notes |
|------|--------------|-------|
| Admin | Yes | Full access |
| User | Yes | Own items only |
| Guest | No | — |

## Exit Conditions

### Success

- <What state indicates success>
- <Expected outcome>

### Failure

- <No changes made>
- <User informed of issue>

## Data Changes

### Created

- <What records are created>

### Updated

- <What records are modified>

### Deleted

- <What records are removed>

## Related

- **Feature:** [feature-<name>](../features/feature-<name>.md)
- **API:** [api-<name>](../api/api-<name>.md)
- **Related Workflows:** [workflow-<name>](./workflow-<name>.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |
