-- 0015 — Optional contact email on accounts (for notifications). Nullable; phone
-- stays the identity. Stored lowercased by the app.
alter table public.account add column if not exists email text;
