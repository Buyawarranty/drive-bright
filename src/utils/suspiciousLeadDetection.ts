// Suspicious lead detection utility
// Flags leads with test/fake patterns so agents don't waste time calling them

export interface SuspiciousFlag {
  type: 'test_account' | 'invalid_phone' | 'junk_email' | 'spam_name';
  reason: string;
}

// Known test reg plates
const TEST_REG_PLATES = ['B11 CSD', 'B11CSD'];

// Known test/junk email patterns
const JUNK_EMAIL_DOMAINS = [
  '@1.com', '@hotnk.com', '@rtygbn.com', '@blank.com', '@na.com',
  '@test.com', '@fake.com', '@example.com', '@idjd.com',
];

// Known dummy phone numbers
const DUMMY_PHONES = [
  '01234567890', '0700000000', '0777777777', '0790000000', '0796000000',
  '07000000000', '07777777777',
];

// Junk name patterns
const JUNK_NAMES = ['test', 'blank', 'na', 'n/a', 'asdf', 'qwerty', 'xxx', 'zzz'];

export function detectSuspiciousLead(lead: {
  phone?: string | null;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  vehicle_reg?: string | null;
}): SuspiciousFlag[] {
  const flags: SuspiciousFlag[] = [];

  // 1. Check for test reg plates
  const reg = (lead.vehicle_reg || '').replace(/\s/g, '').toUpperCase();
  if (TEST_REG_PLATES.some(r => r.replace(/\s/g, '') === reg)) {
    flags.push({ type: 'test_account', reason: 'Known test reg plate' });
  }

  // 2. Check phone number validity
  if (lead.phone) {
    const cleanPhone = lead.phone.replace(/\D/g, '');
    
    // Check dummy numbers
    if (DUMMY_PHONES.includes(lead.phone.replace(/\s/g, '')) || DUMMY_PHONES.includes(cleanPhone)) {
      flags.push({ type: 'invalid_phone', reason: 'Known dummy number' });
    }
    // UK mobiles starting with 07 must be exactly 11 digits
    else if (lead.phone.trim().startsWith('07') && cleanPhone.length !== 11) {
      flags.push({ type: 'invalid_phone', reason: `Mobile has ${cleanPhone.length} digits (needs 11)` });
    }
    // UK landlines starting with 01/02/03 must be 10-11 digits
    else if ((lead.phone.trim().startsWith('01') || lead.phone.trim().startsWith('02') || lead.phone.trim().startsWith('03')) && (cleanPhone.length < 10 || cleanPhone.length > 11)) {
      flags.push({ type: 'invalid_phone', reason: `Landline has ${cleanPhone.length} digits (needs 10-11)` });
    }
    // All repeated digits
    else if (/^(\d)\1+$/.test(cleanPhone)) {
      flags.push({ type: 'invalid_phone', reason: 'Repeated digits' });
    }
    // Not a valid UK number format at all
    else if (cleanPhone.length > 0 && cleanPhone.length < 10) {
      flags.push({ type: 'invalid_phone', reason: `Only ${cleanPhone.length} digits — not a valid UK number` });
    }
  }

  // 3. Check junk emails
  if (lead.email) {
    const emailLower = lead.email.toLowerCase();
    if (JUNK_EMAIL_DOMAINS.some(d => emailLower.endsWith(d))) {
      flags.push({ type: 'junk_email', reason: 'Suspicious email domain' });
    }
    const localPart = emailLower.split('@')[0];
    if (localPart && (localPart === '1' || localPart === 'test' || localPart === 'na' || localPart === 'blank')) {
      flags.push({ type: 'junk_email', reason: 'Test/placeholder email' });
    }
  }

  // 4. Check junk names
  const firstName = (lead.first_name || '').toLowerCase().trim();
  if (firstName && JUNK_NAMES.includes(firstName)) {
    flags.push({ type: 'spam_name', reason: 'Suspicious name' });
  }

  return flags;
}

export function isSuspicious(flags: SuspiciousFlag[]): boolean {
  return flags.length > 0;
}
