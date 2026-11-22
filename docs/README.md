# Personal CRM Starter

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

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Apply the database schema. Choose one:
   - **SQL Editor:** open each file in `supabase/migrations/` in filename order and run it.
   - **Supabase CLI:**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
3. In **Project Settings → API**, copy your project URL, the publishable (anon) key, and the secret (service-role) key.

The schema enables Row Level Security on every table, so each user can only read and write their own data.

### 3. Configure environment variables

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

| Variable | Where it's used | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Yes |
| `VITE_SUPABASE_ANON_KEY` | Browser | Yes |
| `SUPABASE_URL` | Server only | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes |
| `GROQ_API_KEY` | Server only (AI features) | Optional |
| `DISPATCH_REMINDERS_SECRET` | Server only (push reminders) | Optional |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` bypass security or cost money. Never prefix them with `VITE_`, never expose them to the browser, and never commit your `.env`.

### 4. Run it

```bash
npm run dev
```

Open the local URL shown in the terminal, create an account on the sign-in page, and add your first person.

### 5. Build for production

```bash
npm run build
```

## 🤖 AI Features (optional)

AI meeting briefs, summaries, and smart search run **on the server** through `src/lib/ai.functions.ts`, using Groq (`llama-3.3-70b-versatile`). Set `GROQ_API_KEY` to enable them. Without it, the rest of the app works normally.

**Privacy note:** when you use an AI feature, the relevant people, notes, and interaction text are sent to the AI provider. Don't enable it if you're not comfortable with that. To use a different provider, change the request in `src/lib/ai.functions.ts`.

## 🔔 Push Reminders (optional)

Push notifications for due reminders are sent by a scheduled job that calls `/api/public/dispatch-reminders` every 5 minutes. The endpoint rejects any request without the shared secret.

1. Generate a long random secret and set it as `DISPATCH_REMINDERS_SECRET` in your server environment (for example, in Vercel).
2. In the Supabase SQL Editor, point the cron job at your deployed app:
   ```sql
   ALTER DATABASE postgres SET app.dispatch_url = 'https://<your-domain>/api/public/dispatch-reminders';
   ALTER DATABASE postgres SET app.dispatch_reminders_secret = '<the same secret>';
   ```
3. Make sure the `pg_cron` extension is enabled for your project.

If you skip this, reminders still show up in the app, you just won't get push notifications.

## 🚢 Deploying to Vercel

1. Import the repository in Vercel (the framework is detected from `vercel.json`).
2. Add all environment variables from the table above in **Project Settings → Environment Variables**.
3. Deploy, then add your production URL to **Supabase → Authentication → URL Configuration**.

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
