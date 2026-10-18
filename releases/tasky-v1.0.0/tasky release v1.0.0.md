# Tasky Release v1.0.0

## Downloads

- [Download the APK from this GitHub release folder](tasky-v1.0.0.apk)
- [Download the APK from Expo EAS](https://expo.dev/artifacts/eas/v7L9g7a9OFzBKkP-LxaLFe07QH5mfYub00JQmIFqKdI.apk)
- [View the EAS build](https://expo.dev/accounts/adigun91/projects/tasky/builds/ea5c4b67-ea2d-4d5e-8f03-4ddd86b69509)
- [View the EAS build configuration](../../eas.json)

## Release summary

Tasky v1.0.0 is an Android preview APK with account-backed task storage, cross-device sync, task backup/restore, task sharing, and scheduled server notifications.

## Included

- Email/password account registration and sign-in through Supabase Auth.
- Cloud task, profile, and settings storage; signing into the same account on another device restores its cloud data and keeps task changes synchronized.
- A Settings action to copy existing device-local tasks into the signed-in account. The local copy is cleared only after the cloud insert succeeds.
- Per-task sharing with another existing Tasky account by email, with view-only or edit permission enforced by Supabase row-level security.
- Local notifications plus server-scheduled push notifications for due tasks. Shared task notifications target the owner and shared participants with registered device push tokens.
- Supabase database migrations and a Vault-backed, one-minute scheduled invocation for the notification function.

## Build details

- Version: `1.0.0`
- Platform/artifact: Android APK
- EAS profile: `preview` (internal distribution)
- Build status: `FINISHED`
- EAS build ID: `ea5c4b67-ea2d-4d5e-8f03-4ddd86b69509`
- EAS-reported source commit: `9e8f51a2d149f97289c3008b7ce68923d23e9431`
- Artifact size: 98,747,464 bytes
- Artifact SHA-256: see [`build-info.json`](build-info.json)
- Supabase project: `xbheuldreytlwxcnfkxb`

## Install

Download the APK to an Android device and open it. Android may ask you to allow installation from the app used to download the file. This is an EAS internal-distribution build, not a Google Play Store release.

Create an account or sign in to use cloud sync and sharing. To share a task, the recipient must already have a Tasky account. Allow notifications on each device to receive reminders. Existing local-only tasks are not automatically moved into the cloud; use **Settings > Back up local tasks** after signing in.

## Backend deployment

The sharing and scheduling migrations are applied to Supabase. The `send-due-notifications` Edge Function is deployed, and the `tasky-send-due-notifications` Cron job is active on a one-minute schedule. The function requires its private Vault-backed invocation secret; the service-role key and cron secret are not included in the APK or this repository.
