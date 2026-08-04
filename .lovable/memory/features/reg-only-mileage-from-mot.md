---
name: Reg-only Quote Journey
description: Step 1 is reg-only across homepage, brand and warranty-type landing pages; mileage comes from latest MOT, confirmed at Step 4
type: feature
---
Pricing is mileage based, so mileage is never asked for up front.

- Step 1 collects the registration only. Mileage is read from the vehicle's latest MOT odometer reading.
- The old "Under/Over 120,000 miles" band cards are removed everywhere. `MileageQuickSelect` is now a reg-only CTA that looks up MOT mileage itself and passes the EXACT mileage to the parent via `onAutoSubmit(mileage)`.
- Parents must use the `mileageOverride` argument (not their local band state) when building `vehicleData`.
- When no MOT reading exists, the customer is asked for mileage inline (amber card), and `baw_mileage_source` is set to `customer`; otherwise `mot` plus `baw_mot_mileage`/`baw_mot_mileage_date`.
- Applies to: homepage HeroQuoteForm, HomepageB, QuoteFormInline, BrandLandingPage, HomepageLandingTemplate, all `src/pages/landing/*ExtendedWarrantyLanding` and all `src/pages/warranty-types/*WarrantyLanding` pages, plus EditVehicleDialog.
- Price shown at Step 1 is honoured; Step 4 only confirms the mileage.
