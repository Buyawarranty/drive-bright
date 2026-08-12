---
name: Northern Ireland vehicles
description: NI plates can buy online whenever make and model are recognised; unrecognised NI plates get a callback, never a manual price
type: feature
---

There is no Northern Ireland vehicle/MOT API we can read (NI testing is DVA, not
DVSA), so NI vehicles never return an MOT odometer reading.

Rules:
- If the lookup returns a real **make and model**, the customer completes Step 1
  to Step 4 and checks out as normal. Mileage is typed in by the customer (the
  "no MOT reading" mileage field) and confirmed at Step 4.
- If make or model can't be confirmed, no price is ever shown. The customer gets
  the NI wording on `VehicleNotRecognisedCard` — we call them back, confirm the
  vehicle and complete the order on the phone. Never offer a self-service
  make/model entry that produces a price.
- A missing year of manufacture must never be treated as an old vehicle. Only
  apply the 15-year age check when a plausible year (> 1950) is returned.
- Quotes & Orders shows the same NI note on the "Vehicle not fully recognised"
  banner: agent confirms make/model/year/mileage with the customer, then a
  manager authorises before quoting or selling.
- NI orders keep the "⚠ VERIFY vehicle (NI)" badge in Customer Management until
  staff tick `ni_verified`.
