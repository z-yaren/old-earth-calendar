A small web slop calendar where our D&D group marks the days they are available and sees which dates work for everyone since we cannot agree on a day

**Stack:** vanilla JS, Cloudflare Workers, Cloudflare KV

## Deploy your own

1. Create a Workers KV namespace and put its ID in `wrangler.jsonc` (keep the binding name `DND_KV`).
2. In Cloudflare, go to Workers & Pages -> Create -> Import a repository and deploy this repo.
3. In the Worker's Settings -> Variables and Secrets, add two secrets:
   - `GROUP_PASSWORD`: shared password
   - `PLAYERS`: comma-separated names, no space between items: e.g. `Alice,Bob,Oscar`
4. Enable the `workers.dev` URL under Domains & Routes.
