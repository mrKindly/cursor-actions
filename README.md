# WanderSync

WanderSync is a modern, responsive web application for exploring and booking curated travel experiences. The current flagship experience is a beautifully designed Coastal Boat Trip booking interface. 

The application has been built from the ground up to provide a premium user experience, complete with dynamic pricing calculations, interactive components, and smooth animations.

## Features

- **Intuitive Booking Widget**: Dynamically calculate subtotal, taxes, and total pricing based on passenger count.
- **Premium UI/UX**: Built with a sleek glassmorphic navigation bar, subtle micro-animations, and high-quality destination imagery.
- **Responsive Layout**: Seamless transition between desktop viewing and a specialized mobile navigation tab bar.

## Tech Stack

This project is built with a modern edge stack:
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS v4 & PostCSS
- **Icons**: Lucide React
- **Animations**: Motion (Framer Motion)
- **Language**: TypeScript

## Getting Started

Follow these steps to run the application locally.

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone this repository to your local machine.
2. Install the necessary dependencies:

```bash
npm install
```

3. Register Git hooks (recommended once per clone): run `npm run prepare` so Git uses `.githooks` (the pre-commit script can refresh API documentation). GUI or IDE Git clients must be able to run `npm` from that hook; if commits fail with “npm not found”, extend `PATH` or commit from a shell where `npm` works.
4. Start the Next.js development server:

```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000` to interact with the application.

### Runtime configuration

Copy values from `.env.example` into `.env` as needed for local development.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCOUNT_CODES_ENABLED` | No | Set to `true` to enable `POST /api/trips/discount` (loyalty discount booking). If unset or not `true`, that endpoint returns `404`. |

### Optional: Jira ticket helper

There is an interactive CLI for drafting a Story in Jira via the Cursor agent (`npm run create-ticket`). It reads and writes `.env`; add credentials only if you use this helper.

| Variable | Required | Purpose |
| --- | --- | --- |
| `CURSOR_API_KEY` | Yes (for helper) | Authenticates Cursor agent prompts |
| `CURSOR_MODEL` | No | Agent model ID (defaults to `composer-2`) |
| `JIRA_HOST` | Yes (when creating tickets) | Jira host (`https://` optional, e.g. `your-org.atlassian.net`) |
| `JIRA_EMAIL` | Yes (when creating tickets) | Account email for Jira REST API |
| `JIRA_API_TOKEN` | Yes (when creating tickets) | Jira API token for basic auth |
| `JIRA_PROJECT_KEY` | Yes (when creating tickets) | Project key for new issues |


## Building for Production

To create an optimized production build of the application:

```bash
npm run build
```

And then start the production server:

```bash
npm start
```
