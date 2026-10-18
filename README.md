# Tasky

Task organizer with reminders, account sync, cloud backup, and task sharing.

## Cloud setup

1. Create a Supabase project and copy its project URL and anon/publishable key into `.env` using `.env.example` as the template. Keep `.env` out of Git. These two public client settings are also configured in the EAS `preview` and `production` environments for native builds.
2. In the Supabase SQL Editor, run `supabase/schema.sql` once. Apply repository migrations with `npx supabase db push` after linking the CLI; these add secure task sharing and schedule server reminders every minute.
3. Deploy the scheduled notification function with an authenticated Supabase CLI:

	```powershell
	npx supabase login
	npx supabase link --project-ref <project-ref>
	npx supabase functions deploy send-due-notifications --no-verify-jwt
	```

4. The database migration stores a generated invocation secret in Supabase Vault and creates the Cron schedule. The function checks that secret using its service-role client. Do not add the service-role key or cron secret to the app, EAS client variables, or Git.
5. Build an APK with `npx eas-cli@latest build --platform android --profile preview`.

## Accounts and data

Tasks, profile, and settings are stored under the signed-in account. Signing in on a replacement device restores that account's cloud data. Existing device-only tasks can be copied into the signed-in account from Settings > Back up local tasks. This action clears the local task copy only after the cloud insert succeeds.

Task owners can share an individual task with an existing Tasky account by email and grant view-only or edit access. Supabase row-level security enforces those permissions. Shared tasks sync in realtime, and scheduled server reminders are delivered to the owner and shared participants who have registered push tokens.

## Local development

```powershell
npx expo start
npm run lint
npx tsc --noEmit
```
