

# Add Organic Traffic Highlighting to Page Analytics

## Overview
Add a prominent "Organic Reach" KPI card and an "Organic" column to the pages table so you can instantly see how many visitors found your site naturally through search engines (SEO) -- without any paid ads or UTM-tagged campaigns.

## How Organic Traffic Is Identified
A visit is classified as **organic** when:
- No `gclid` (Google Ads click ID)
- No `utm_source`, `utm_medium`, `utm_campaign` parameters
- Either no referrer (direct/bookmark) OR referrer is from a known search engine (google, bing, yahoo, duckduckgo, etc.)

This separates truly organic/SEO visitors from paid ad clicks and social/email campaigns.

## Changes to `PageAnalyticsTab.tsx`

### 1. New KPI Card -- "Organic Reach"
- Add a 5th KPI card (green, with a leaf/sprout icon) showing total organic page views and unique organic visitors
- Positioned prominently alongside Total Views, Unique Visitors, Sessions, and Google Ads

### 2. Daily Trend Chart -- Organic vs Paid Line
- Add a second line to the daily trend chart showing organic views in green alongside total views in orange
- Makes it easy to see organic growth over time

### 3. Pages Table -- New "Organic" Column
- Add an "Organic" column next to the existing "Google Ads" column
- Organic counts shown with a green badge to visually stand out
- Each page row shows how many of its views were purely organic

### 4. Traffic Source Pie Chart Enhancement
- The existing source classification already shows "direct" -- this will be refined to separate "organic search" (from search engine referrers) from "direct" (no referrer at all)

## Technical Details
- All changes are in a single file: `src/components/admin/PageAnalyticsTab.tsx`
- No database changes needed -- organic status is computed from existing `gclid`, `utm_source`, `utm_medium`, `utm_campaign`, and `referrer` fields already stored in `page_views`
- A helper function `isOrganic(pageView)` will classify each row
- Search engine detection uses hostname matching against common engines (google, bing, yahoo, duckduckgo, baidu, ecosia)
