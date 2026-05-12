# Supabase Setup

Ruleaza migratia SQL din `supabase/migrations/20260512154000_create_vibecheck_tables.sql` in Supabase SQL Editor sau cu Supabase CLI.

Tabele create:
- `posts`: `id`, `content`, `created_at`
- `likes`: `post_id`, `like_count`
- `users`: `id`, `display_name`, `created_at`, `updated_at`

Politicile RLS sunt permisive intentionat pentru laboratorul de debugging. Pentru productie, inlocuieste-le cu politici bazate pe autentificare.
