# Frontend

OctoPOS frontend — Next.js 14 App Router + shadcn/ui (new-york) + TanStack Query.

## Pages

- `/login` — sign in (OCT-11)
- `/dashboard` — sanity check + nav
- `/inventory` — stock dashboard (OCT-16)
- `/pos` — register (WIP)
- `/products` — catalog list with search/filter/sort/paginate + create dialog + delete confirm (OCT-12)
- `/products/new` — create form (OCT-12)
- `/products/[id]` — edit form with pre-fill + delete (OCT-12)

## Dev

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to point at the Go backend (defaults to
`http://localhost:8080`).
