export const LIVE_CHAT_KEY = 'website_live_chat_enabled';
export function liveChatAllowed(enabled: unknown, hasFreshSpecialist: boolean) {
  return enabled === true && hasFreshSpecialist;
}
export async function readLiveChatEnabled(admin: any): Promise<boolean> {
  const { data, error } = await admin.from('admin_config').select('config_value').eq('config_key', LIVE_CHAT_KEY).maybeSingle();
  return !error && data?.config_value === true;
}
