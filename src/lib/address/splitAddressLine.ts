/**
 * Postcoder usually returns the whole first line together, e.g.
 * "66 Irene Hughes Drive" or "Flat 2, The Old Bakery, High Street".
 * The admin forms have separate "House/Building Number" and "Street" boxes,
 * so we split the line into the two parts the form expects.
 */
export interface SplitAddressParts {
  buildingNumberOrName: string;
  street: string;
}

const LEADING_NUMBER = /^([0-9]+[A-Za-z]?(?:\s*[-/]\s*[0-9]+[A-Za-z]?)?)\s+(.*)$/;

export function splitAddressLine(
  line1: string,
  line2 = '',
  buildingNumber = '',
  buildingName = '',
): SplitAddressParts {
  const l1 = (line1 || '').trim();
  const l2 = (line2 || '').trim();
  const num = (buildingNumber || '').trim();
  const name = (buildingName || '').trim();

  // Postcoder gave us the parts explicitly — trust them.
  if (num || name) {
    const building = [name, num].filter(Boolean).join(' ').trim();
    let street = l1;
    // Strip the building part from line 1 if it's repeated there.
    if (street && building) {
      const stripped = street
        .replace(new RegExp(`^${building.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,\\s]*`, 'i'), '')
        .trim();
      if (stripped) street = stripped;
      else street = l2;
    }
    return { buildingNumberOrName: building, street: street || l2 };
  }

  // "66 Irene Hughes Drive" → 66 + Irene Hughes Drive
  const m = l1.match(LEADING_NUMBER);
  if (m) {
    return { buildingNumberOrName: m[1].replace(/\s+/g, ''), street: m[2].trim() || l2 };
  }

  // "Flat 2, The Old Bakery, High Street" / "Rose Cottage" + line 2 street
  if (l1.includes(',')) {
    const parts = l1.split(',').map((p) => p.trim()).filter(Boolean);
    const street = parts.pop() || '';
    return { buildingNumberOrName: parts.join(', '), street: street || l2 };
  }

  // Named property with the street on line 2.
  if (l2) return { buildingNumberOrName: l1, street: l2 };

  // Nothing to split on — put it in the street box so nothing is lost.
  return { buildingNumberOrName: '', street: l1 };
}
