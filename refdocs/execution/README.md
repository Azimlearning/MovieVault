# Execution Plans

> **MANDATORY:** Every plan in `refdocs/plans/` that moves to implementation must have a matching execution document here.
> An execution plan covers **how** and **in what order** — phases, steps, file paths, commands, and checkpoints.
> Do not start coding a feature if no execution plan exists for it — create one first.

## Naming convention
`EXEC_<FEATURE_NAME>.md` — mirrors the plan name, e.g. `EXEC_WEB_V2_PORT.md`

## Required sections in every execution plan
1. **Companion plan** — link to the plan doc in `refdocs/plans/`
2. **Status at authoring** — what's already done, what's blocked
3. **Phases** — ordered, self-contained phases each with:
   - Files to create / modify
   - Exact steps or commands
   - Checkpoint — how to verify the phase is complete
4. **Rollback notes** — what to undo if a phase goes wrong

## Existing execution plans
| File | Companion Plan | Status |
|------|---------------|--------|
| [V2_EXECUTION_PLAN.md](V2_EXECUTION_PLAN.md) | IMPROVEMENT_PLAN_V2.md | P4+P5+P6 complete |
| [EXEC_UI_REDESIGN_V3.md](EXEC_UI_REDESIGN_V3.md) | PLAN_UI_REDESIGN_V3.md | Not started |
