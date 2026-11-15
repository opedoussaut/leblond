-- Two more gyms' own bouldering scales (values only; used by the next migration).
-- Le Labo (Grenoble) and MROC Laennec (Lyon) publish their colours, easiest
-- first, on their Arkose-hosted statistics pages.
alter type public.grade_system add value if not exists 'LELABO_COLOR';
alter type public.grade_system add value if not exists 'MROC_COLOR';
