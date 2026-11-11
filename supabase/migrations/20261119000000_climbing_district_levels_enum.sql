-- Climbing District's numbered bouldering levels 1–12 (value only; used by the next migration).
-- A new enum value cannot be used in the transaction that adds it, hence its own file.
alter type public.grade_system add value if not exists 'CLIMBING_DISTRICT_LEVEL';
