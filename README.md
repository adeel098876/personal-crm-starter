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

- Node.js
- npm
- A Supabase project
- An AI provider/API key if AI features are enabled

### 1. Clone

```bash
git clone https://github.com/adeel098876/bond-insight-keeper.git
cd bond-insight-keeper
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in the required values.

**Never commit `.env` or production credentials.**

### 4. Run the development server

```bash
npm run dev
```

Then open the local development URL shown by Vite.

### 5. Build

```bash
npm run build
```

## 🗄️ Supabase Setup

Personal CRM Starter uses Supabase for authentication and database functionality.

Create a Supabase project and configure the required environment variables.

The project uses Supabase security controls to isolate user data.

For production deployments, ensure your Supabase authentication, database policies, and environment variables are configured correctly before exposing the application publicly.

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
