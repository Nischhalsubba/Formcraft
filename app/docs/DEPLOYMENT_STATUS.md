# Deployment status

Formcraft production is connected to its dedicated Supabase project.

- Supabase project: `Formcraft`
- Supabase region: `ap-northeast-1`
- Netlify project: `formcraftnischhal`
- Database migrations: applied
- Row-Level Security: enabled
- Private file storage: configured
- Realtime workspace state: enabled
- `invite-member` Edge Function: deployed with JWT verification
- Netlify runtime variables: verified in the production context
- Production rebuild requested after environment verification: `2026-07-30T04:22:00Z`

This status record triggers the production rebuild that embeds the verified Supabase URL and publishable key into Formcraft's generated runtime configuration.
