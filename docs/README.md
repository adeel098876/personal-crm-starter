# Personal CRM Starter
![CI](https://github.com/adeel098876/personal-crm-starter/actions/workflows/ci.yml/badge.svg)
An open-source personal CRM starter for building applications that help people organize, remember, and maintain meaningful relationships.

Built with **React, TypeScript, TanStack Start, and Supabase**.

> Not a sales CRM. This project is designed around people, relationships, interactions, notes, reminders, and personal context.

## ✨ Features

- 🔐 Authentication
- 👥 Contact and people management
- 📝 Rich relationship profiles
- 💬 Interaction history
- 📌 Notes
- 🤝 Promises and commitments
- 🔔 Reminders
- 📅 Daily dashboard
- 💪 Relationship strength
- 🤖 AI meeting briefs
- ✨ AI summaries
- 🔎 AI-powered smart search
- 📊 Relationship analytics
- 🔍 Global search
- 📱 Progressive Web App support
- 🔒 Supabase Row Level Security
- ⚡ Modern React/TypeScript architecture

## 🎯 Why a Personal CRM?

Traditional CRMs are generally designed around **sales, leads, accounts, and pipelines**.

A personal CRM is different.

It focuses on remembering the people behind those relationships:

- What did we talk about?
- When did I last contact them?
- Did I promise to do something?
- What are they interested in?
- When should I follow up?
- What important context should I remember?

Personal CRM Starter provides a foundation for building that kind of application.

## 🧠 AI Layer

AI functionality is designed as an additional layer over the relationship data.

Possible workflows include:

- **Meeting Briefs** — prepare context before talking to someone
- **Summaries** — condense interaction and relationship history
- **Smart Search** — search relationship data using natural language
- **Drafting** — generate context-aware communication drafts

The AI layer is intended to remain configurable so developers can adapt it to different providers and use cases.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React | UI |
| TypeScript | Application language |
| TanStack Start | Full-stack React framework |
| TanStack Router | Routing |
| Supabase | Authentication & database |
| PostgreSQL | Data storage |
| Vite | Development/build tooling |
| Vercel | Deployment |
| PWA | Installable web application |

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project
- *(Optional)* A [Groq](https://console.groq.com) API key for the AI features

### 1. Clone and install

```bash
git clone https://github.com/adeel098876/personal-crm-starter.git
cd personal-crm-starter
npm install
```

### 2. Set up the database

1. Create a new project at [supabase.com](https://supabase.com).
2. Create the tables and security rules. Choose one:
   - **SQL Editor (easiest):** open `supabase/migrations/20260710000000_initial_schema.sql`, paste it into the Supabase SQL Editor, and click **Run**.
   - **Supabase CLI:**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
3. In **Project Settings → API**, copy the project URL, the publishable (anon) key, and the secret (service-role) key.

The schema turns on Row Level Security for every table, so each user can only read and write their own data. Run it **once, on a fresh project**.

### 3. Configure environment variables

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

| Variable | Used by | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Yes |
| `VITE_SUPABASE_ANON_KEY` | Browser | Yes |
| `SUPABASE_URL` | Server only | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes |
| `GROQ_API_KEY` | Server only (AI features) | Optional |
| `DISPATCH_REMINDERS_SECRET` | Server only (push reminders) | Optional |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` bypasses all security rules and `GROQ_API_KEY` costs money. Never prefix them with `VITE_`, never expose them to the browser, and never commit your `.env`.

### 4. Run it

```bash
npm run dev
```

Open the local URL shown in the terminal, create an account, and add your first person.

### 5. Build for production

```bash
npm run build
```

## 🤖 AI Features (optional)

AI meeting briefs, summaries, and smart search run **on the server** through `src/lib/ai.functions.ts`, using Groq (`llama-3.3-70b-versatile`). Set `GROQ_API_KEY` to enable them. Without it, the rest of the app works normally.

**Privacy note:** when you use an AI feature, the relevant people, notes, and interaction text are sent to the AI provider. Leave it disabled if you are not comfortable with that. To use a different provider, change the request in `src/lib/ai.functions.ts`.

## 🔔 Push Reminders (optional)

The app works without this. Push notifications for due reminders come from a scheduled job that calls `/api/public/dispatch-reminders` every 5 minutes. The endpoint rejects any request that doesn't carry your secret.

1. Deploy the app (see below).
2. Generate a long random secret (`openssl rand -hex 32`) and set it as `DISPATCH_REMINDERS_SECRET` in your server environment (for example, in Vercel).
3. Open `supabase/optional/push-reminders-cron.sql`, replace `YOUR-DOMAIN.example.com` and `REPLACE_WITH_YOUR_SECRET` with your domain and the same secret, then run it in the Supabase SQL Editor.

To turn it off later, run `SELECT cron.unschedule('dispatch-reminder-push');`.

## 🚢 Deploying to Vercel

1. Import the repository in Vercel (the framework is detected from `vercel.json`).
2. Add the environment variables from the table above under **Project Settings → Environment Variables**.
3. Deploy, then add your production URL in **Supabase → Authentication → URL Configuration**.

## 🔐 Security

Security is especially important for a personal CRM because relationship data can contain sensitive personal context.

Never commit:

- API keys
- Service-role/secret keys
- Passwords
- Private VAPID keys
- Production `.env` files
- Other privileged credentials

Use `.env.example` only for **placeholder configuration**.

Privileged server-side keys should never be exposed through client-side `VITE_` variables.

## 📁 Project Structure

```text
src/
├── components/       # Reusable UI components
├── integrations/     # Supabase and external integrations
├── lib/               # Application logic and server functions
├── routes/            # Application routes
└── ...

supabase/
├── migrations/        # Database migrations
└── ...

public/                # Static assets and PWA resources
```

The exact structure may evolve as the starter develops.

## 🧩 Customization

Personal CRM Starter is intended to be customized.

You can adapt it for:

- Personal relationship management
- Professional networking
- Client relationship tracking
- Freelance client management
- Mentor/mentee management
- Family relationship tracking
- Community management
- Custom CRM-style applications

You can also replace or extend individual parts of the system, including:

- AI providers
- Authentication
- Database schema
- Relationship scoring
- Search
- Analytics
- Integrations

## 🗺️ Roadmap

Potential future extensions include:

- Calendar integration
- Email integration
- Contact import/export
- Additional AI providers
- Advanced relationship analytics
- Automation workflows
- Browser extension
- Native mobile application
- Plugin architecture

These are not required for the current starter.

## 🤝 Contributing

Contributions are welcome.

If you'd like to improve the project:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test the application.
5. Open a pull request.

Please keep changes focused and avoid committing secrets or environment-specific configuration.

## ⭐ About

Personal CRM Starter is an open-source foundation for developers who want to build relationship-focused applications without starting the architecture from scratch.

If you find the project useful, consider giving it a ⭐ on GitHub.
