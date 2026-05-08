# Next.js template

This is a Next.js template with shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Docker

Run the app with PostgreSQL:

```bash
docker compose up --build
```

The app runs on `http://localhost:3000`. The container runs `prisma migrate deploy` before starting Next.js.

Set a real `AUTH_SECRET` for non-local use:

```bash
AUTH_SECRET="replace-with-a-long-random-string" docker compose up --build
```
