---
name: Agents in training have no target
description: Scoreboard "In training" flag on admin_users.in_training removes an agent's revenue target and percentage
type: feature
---
- `admin_users.in_training` (boolean, default false) marks a sales agent as still in training.
- Set from the scoreboard Monthly revenue targets panel (management only) via `TrainingModeToggle`.
- Agents in training: no revenue target, no % of target, no progress bar, no "to go" gap; shown as "🎓 In training" on Team progress and Ranking. Their sales still count towards team totals.
- Save all skips agents in training; their target input is disabled.
- Scoreboard period/month filters (Today / This week / Last 30 days / This month / All time, month arrows, Jump to this month, date range) live INSIDE the Scoreboard accordion above Team progress, because that is where they apply. The team filter stays outside.
