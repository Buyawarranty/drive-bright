---
name: Single rotation cursor
description: One global round_robin_state cursor for team and global leads — never re-introduce per-team cursors
type: feature
---
Round robin uses ONE cursor row in `round_robin_state` (team_id IS NULL), enforced by unique index `round_robin_state_single_cursor`. Both `pick_agent_for_distribution` and `pick_agent_for_distribution_legacy` read/write that single row, so team-routed and global leads advance the same one-at-a-time queue.

Candidate filtering still respects team membership, caps, pause/ON-OFF switch and workstreams. Sticky ownership (`same_customer_sticky`) still bypasses rotation by design.

Never re-add per-team cursors — it splits the sequence and makes distribution look random.
