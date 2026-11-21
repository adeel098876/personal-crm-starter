# Personal CRM Starter — Product Requirements Document

## 1. Product Overview

**Personal CRM Starter** is an open-source starter template for building a personal relationship management application.

It provides a foundation for helping people organize and maintain meaningful relationships with:

- Family
- Friends
- Coworkers
- Clients
- Mentors
- Business partners
- Professional contacts

Unlike traditional sales CRMs such as Salesforce or HubSpot, Personal CRM Starter is focused on **people and relationships rather than sales pipelines**.

The project provides a ready-to-customize foundation that developers can use, extend, self-host, and adapt to their own relationship-management workflows.

---

## 2. Target Users

### End Users

- Professionals
- Entrepreneurs
- Students
- Freelancers
- Consultants
- People managing large personal or professional networks

### Developers

- Developers looking for a personal CRM foundation
- Developers learning modern full-stack React development
- Developers building their own relationship-management products
- Developers who want to customize an open-source CRM-style application

---

## 3. Problem

People often struggle to maintain relationships because important information becomes scattered or forgotten.

Examples include:

- When they last spoke with someone
- Important conversations
- Personal preferences
- Promises and commitments
- Follow-ups
- Birthdays and important dates
- Relationship history
- Notes and context

A personal CRM provides a structured place to preserve this context and turn it into useful reminders and insights.

---

## 4. Product Goal

Provide a reusable, open-source foundation for building a personal CRM that makes relationship information easy to:

1. Store
2. Organize
3. Search
4. Review
5. Remember
6. Act upon

The application should reduce the mental effort required to maintain important relationships.

---

# 5. Core Features

## 5.1 Authentication

- User registration
- Login
- Logout
- Session persistence
- Protected application routes
- User-specific data isolation

---

## 5.2 Contacts / People

Users can create and manage people in their network.

Each person can contain information such as:

- Name
- Contact information
- Relationship type
- Company
- Role
- Location
- Tags
- Important dates
- Personal preferences
- Notes

---

## 5.3 Rich Profiles

Each person has a dedicated profile containing their relationship context.

Profiles can display:

- Basic information
- Interaction history
- Notes
- Promises
- Reminders
- Relationship strength
- Important dates
- Recent activity
- AI-generated insights

---

## 5.4 Interaction History

Users can record interactions with people.

Examples:

- Meetings
- Calls
- Messages
- Emails
- Events
- Informal conversations

Each interaction can contain:

- Date
- Type
- Summary
- Notes
- Follow-up information

---

## 5.5 Notes

Users can store persistent context about a person.

Examples:

- Interests
- Preferences
- Important information
- Conversation details
- Personal context
- Professional context

---

## 5.6 Promises and Commitments

Users can record things they promised to do.

Examples:

- Send a document
- Follow up next week
- Make an introduction
- Share a resource

Promises can be connected to reminders to reduce forgotten commitments.

---

## 5.7 Reminders

Users can create reminders related to people and relationships.

Examples:

- Follow up with someone
- Check in with a friend
- Remember a birthday
- Complete a promise

---

## 5.8 Daily Dashboard

The dashboard provides a daily overview of relationship-related actions.

It can surface:

- Upcoming reminders
- Overdue follow-ups
- Promises
- Important dates
- Recent interactions
- Relationship insights

The goal is to make the application useful as a **daily relationship-management tool**.

---

## 5.9 Relationship Strength

The application can provide a relationship-strength indicator based on available interaction and activity data.

Possible factors include:

- Interaction frequency
- Recency of interaction
- Follow-up activity
- Relationship history
- User-defined context

Relationship strength is intended as an **indicator**, not an objective measurement of a relationship.

---

## 5.10 Search

Global search allows users to quickly find:

- People
- Notes
- Interactions
- Promises
- Reminders

Search should make stored relationship context accessible without requiring users to navigate through multiple screens.

---

# 6. AI Features

AI functionality is designed as an optional assistant layer on top of the personal CRM.

### AI Meeting Briefs

Generate useful context before interacting with someone.

Possible information includes:

- Previous interactions
- Notes
- Open promises
- Recent activity
- Relevant relationship context

### AI Summaries

Summarize:

- Conversations
- Interaction history
- Notes
- Relationship activity

### AI Smart Search

Allow users to search relationship data using natural language.

Examples:

> "Who did I promise to send something to?"

> "Who haven't I talked to recently?"

> "What did I discuss with Ahmed last time?"

### AI Drafting

Generate drafts for relationship-related communication using available context.

---

# 7. Analytics

Analytics can provide an overview of relationship-management activity.

Examples:

- Number of contacts
- Interaction frequency
- Follow-up activity
- Completed promises
- Outstanding reminders
- Relationship-strength distribution
- Activity trends

Analytics should focus on **relationship activity and maintenance**, rather than sales metrics.

---

# 8. Progressive Web App

The application should support PWA capabilities where practical.

Goals include:

- Installable application
- Responsive interface
- Mobile-friendly experience
- App-like navigation
- Offline support where appropriate

---

# 9. AI / Service Configuration

AI providers should be configurable rather than permanently tied to a single commercial provider.

The starter should make it possible for developers to replace or extend the AI layer with their preferred provider.

API keys and privileged credentials must remain server-side and must never be committed to the repository.

---

# 10. Security

Security is a core requirement for the starter.

The application should use:

- Authentication
- Database access controls
- Row Level Security where applicable
- Server-side handling of privileged API keys
- Environment variables for secrets
- Secure session management
- User-level data isolation

The repository must never contain real production credentials.

---

# 11. Open-Source Goals

Personal CRM Starter is intended to be:

- Free to use
- Self-hostable
- Customizable
- Developer-friendly
- Easy to fork
- Easy to deploy

The project should provide enough documentation for developers to configure the application and adapt it to their own requirements.

---

# 12. Out of Scope

The following are intentionally outside the current scope:

- Voice transcription
- Apple Watch integration
- Calendar synchronization
- Email synchronization
- LinkedIn synchronization
- Team workspaces
- Family workspaces
- Sales pipelines
- Lead management
- Sales forecasting
- Enterprise CRM functionality

These may be considered future extensions by developers building on the starter.

---

# 13. Monetization

The starter itself is **not dependent on a subscription model**.

Developers may add their own:

- AI usage limits
- Premium features
- Authentication providers
- Billing
- SaaS functionality
- Hosted services

The repository provides the technical foundation rather than requiring a specific business model.

---

# 14. Success Criteria

The starter is successful when a developer can:

- Clone the repository
- Configure environment variables
- Connect a Supabase project
- Run the application locally
- Authenticate a user
- Manage contacts
- Record interactions
- Create reminders
- Use the dashboard
- Configure AI functionality
- Customize the application for their own use case
- Deploy their own instance

The primary goal is **developer reuse and customization**, rather than maximizing subscriptions or commercial revenue.

---

# 15. Future Extensions

Potential extensions include:

- Calendar integrations
- Email integrations
- Messaging integrations
- Contact import/export
- Advanced AI agents
- Custom relationship scoring
- Automation workflows
- Additional AI providers
- Mobile applications
- Browser extensions
- Plugin architecture

These should remain optional extensions rather than requirements for the starter.
