
-- Track team membership changes so agents get a one-time notice on next login.
ALTER TABLE public.lead_team_members
  ADD COLUMN IF NOT EXISTS previous_team_id uuid REFERENCES public.lead_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notice_seen_at timestamptz;

-- Allow each agent to mark their own team-change notice as seen.
DROP POLICY IF EXISTS "Agents can ack their own team change notice" ON public.lead_team_members;
CREATE POLICY "Agents can ack their own team change notice"
  ON public.lead_team_members
  FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());
