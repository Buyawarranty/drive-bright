export function careerContactError(input: { email?: string; phone?: string; warrantySalesExperience?: boolean }): string | null {
  if (!input.email?.trim()) return 'Please enter your email address';
  if (!input.phone?.trim()) return 'Please enter your phone number';
  if (input.warrantySalesExperience !== true) return 'Please confirm you have experience of selling vehicle warranties';
  return null;
}
