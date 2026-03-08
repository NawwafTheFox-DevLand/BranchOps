# Branch Ops MVP (Supabase + Next.js)

## Run locally

1) **Install deps**

```bash
npm install
```

2) **Create your env file**

```bash
cp .env.example .env.local
```

Fill:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)

3) **Start dev server**

```bash
npm run dev
```

Open:
- http://localhost:3000

## Routes

- `/login` — login / optional signup
- `/log` — branch daily logging (batch / waste / stockout)
- `/dashboard` — ops dashboard (real data)
- `/admin/users` — admin: assign roles + branch to users
- `/import` — admin: import Purchases.xlsx + Sales.xlsx

## Notes

- This app assumes your Supabase schema includes the tables in `schema_v3.sql`.
- RLS must be enabled as in the schema. Admin pages use the **service role key** on the server but are gated by admin role.

