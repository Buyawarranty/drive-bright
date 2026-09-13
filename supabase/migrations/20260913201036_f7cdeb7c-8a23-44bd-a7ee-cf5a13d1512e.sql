create policy "Management can delete pending whatsapp auto queue rows"
on public.whatsapp_auto_message_queue
for delete
to authenticated
using (public.can_manage_lead_routing(auth.uid()) and status = 'pending');