# Contributing

Thanks for helping improve Personal CRM Starter!

## Getting set up
Follow the "Getting Started" steps in the README to run the app locally
with your own Supabase project.

## Making changes
1. Fork the repo and create a branch: `git checkout -b my-change`
2. Keep changes small and focused on one thing.
3. Run `npm run lint` and `npm run build` before committing.
4. Open a pull request describing what changed and why.

## Project principles
- This is a **personal** relationship manager, not a sales CRM. Features should
  help someone remember, understand, or maintain their relationships.
- AI is an optional layer on top, never required for the core app to work.
- Keep the Supabase security model intact: Row Level Security on every table,
  and privileged keys (`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`) used only
  on the server.

## Security
Never commit secrets, API keys, or a real `.env` file. If you find a security
issue, please open a private report via the repository's Security tab instead
of a public issue.