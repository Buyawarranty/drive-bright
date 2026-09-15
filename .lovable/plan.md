# WhatsApp button and reply notifications

## What will change

- Restyle the New Leads WhatsApp button as a solid dark-green control with white text and its existing arrow.
- Add a CRM-wide alert for every inbound WATI reply, shown to the agent who owns that lead.
- Keep WhatsApp conversation data management-only; sales agents receive only the reply details for leads assigned to them.
- Let the alert open the matching lead in New Leads, and allow each alert to be dismissed.

## Technical details

- Add a narrowly scoped database function that returns recent inbound WhatsApp messages only when the caller is the assigned lead owner, or is management.
- Poll the lightweight notification function while the CRM is open and preserve seen message IDs per staff account to avoid duplicate alerts.
- Render notifications in the existing shared alert rail and use the existing New Leads deep-link pattern.

## Verification

- Confirm the button uses a dark-green fill and white label/icon states.
- Confirm an inbound reply produces one alert for the correct owner, does not repeat after dismissal, and opens the matching lead.
- Run the project checks after implementation.