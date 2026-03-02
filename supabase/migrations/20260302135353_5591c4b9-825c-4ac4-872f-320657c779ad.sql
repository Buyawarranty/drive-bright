-- Rebalance 173 unassigned leads across agents in strict round-robin order
-- Starting from Ash (sort_order 3, next after Isobel who was last assigned)
-- Rotation: Ash → James → Isobel → Ash → James → Isobel ...

DO $$
DECLARE
  v_agents uuid[] := ARRAY[
    '7083d831-4634-47a4-b3e2-61ac9908bf85'::uuid,  -- Ash (sort_order 3)
    '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5'::uuid,  -- James (sort_order 1)
    '2acbba10-6e7d-48f8-876c-63f607f06368'::uuid   -- Isobel (sort_order 2)
  ];
  v_lead_ids uuid[];
  v_count int;
  v_agent_idx int;
  v_now timestamptz := now();
BEGIN
  -- Get all unassigned leads ordered by created_at
  SELECT array_agg(id ORDER BY created_at ASC) INTO v_lead_ids
  FROM public.sales_leads
  WHERE assigned_to IS NULL
    AND status NOT IN ('lost', 'fake_lead');

  v_count := coalesce(array_length(v_lead_ids, 1), 0);
  
  RAISE NOTICE 'Rebalancing % unassigned leads', v_count;
  
  -- Assign each lead in rotation
  FOR i IN 1..v_count LOOP
    v_agent_idx := ((i - 1) % 3) + 1;  -- cycles 1,2,3,1,2,3...
    
    UPDATE public.sales_leads
    SET assigned_to = v_agents[v_agent_idx],
        updated_at = v_now
    WHERE id = v_lead_ids[i];
  END LOOP;

  -- Update round_robin_state to point to the last assigned agent
  IF v_count > 0 THEN
    v_agent_idx := ((v_count - 1) % 3) + 1;
    UPDATE public.round_robin_state
    SET last_assigned_user_id = v_agents[v_agent_idx],
        updated_at = v_now;
  END IF;

  RAISE NOTICE 'Rebalance complete. Last agent index: %', v_agent_idx;
END $$;