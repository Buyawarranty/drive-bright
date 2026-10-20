export function canManageGateway(role: string, active: boolean) {
  return active && (role === 'admin' || role === 'super_admin');
}

export function validGatewayPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}