WITH pairs(slug, a_url, a_label, b_url, b_label) AS (VALUES
 ('are-car-warranties-worth-it-best-car-warranty-uk-2026','/car-extended-warranty/','car extended warranty','/warranty-types/bmw-warranty/','bmw extended warranty'),
 ('auto-warranty-vs-extended-warranty-insurance-uk-2026','/warranty-types/audi-warranty/','audi extended warranty','/thewarrantyhub/uk-car-repair-costs-2026-without-warranty/','UK car repair costs without a warranty'),
 ('car-warranty-vs-breakdown-cover-vs-insurance-uk-2026','/warranty-types/mercedes-warranty/','mercedes benz extended warranty','/warranty-types/vans-warranty/','van warranty uk'),
 ('cheap-car-warranty-in-the-uk-what-is-covered-what-is-not-how-to-choose-smartly','/warranty-types/kia-warranty/','kia extended warranty','/warranty-types/hyundai-warranty/','hyundai extended warranty'),
 ('dealership-vs-independent-cover-protect-used-car-uk-2026','/warranty-types/ford-warranty/','ford extended warranty','/warranty-types/vauxhall-warranty/','vauxhall extended warranty'),
 ('good-mileage-used-car-uk-2026-buyers-guide','/warranty-types/toyota-warranty/','toyota extended warranty','/warranty-types/skoda-warranty/','skoda extended warranty'),
 ('uk-car-repair-costs-2026-without-warranty','/warranty-types/volkswagen-warranty/','volkswagen extended warranty','/car-extended-warranty/','car extended warranty'),
 ('uk-car-theft-hotspots-2026-riskiest-areas-and-protection','/warranty-types/tesla-warranty/','tesla extended warranty uk','/warranty-types/suv-warranty/','suv warranty uk'),
 ('used-car-warranty-uk-2026-whats-covered-when-to-buy','/warranty-types/nissan-warranty/','nissan extended warranty','/warranty-types/volvo-warranty/','volvo extended warranty')
)
UPDATE blog_posts b
SET content = jsonb_set(b.content, '{html}', to_jsonb(
  (b.content->>'html') ||
  '\n\n<p>Related reading: <a href="' || p.a_url || '">' || p.a_label || '</a> and <a href="' || p.b_url || '">' || p.b_label || '</a>.</p>\n'
))
FROM pairs p
WHERE b.slug = p.slug
  AND (b.content->>'html') NOT LIKE '%Related reading:%';