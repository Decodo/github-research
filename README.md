# GitHub Research

[![](https://dcbadge.vercel.app/api/server/Ja8dqKgvbZ)](https://discord.gg/Ja8dqKgvbZ)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
![Bun](https://img.shields.io/badge/bun-%3E%3D1.2.5-black)
![License](https://img.shields.io/badge/license-MIT-green)

<p align="center">
  <a href="https://dashboard.decodo.com/scrapers/pricing?utm_source=github&utm_medium=social&utm_campaign=github-research"><img src="https://github.com/user-attachments/assets/13b08523-32b0-4c85-8e99-580d7c2a9055" alt="Decodo Web Scraping API" /></a>
</p>

**GitHub Research** is an open-source tool for researching GitHub trending repositories, newly emerging projects, and keyword-driven repository activity. It uses Decodo's [Web Scraping API](https://decodo.com/scraping/web) to retrieve public GitHub pages and your chosen LLM provider to turn normalized repository data into structured research reports.

Unlike leaderboard-style trending trackers, GitHub Research can start from a keyword or concept and return recurring themes, notable repositories, and historical changes instead of only a ranked list.

> GitHub Research is not affiliated with or endorsed by GitHub, Inc.

<p align="center">
  <img src="https://github.com/user-attachments/assets/628b80b2-2d48-49f6-80fd-297473e85cc5" alt="GitHub Research main research screen" width="800" />
</p>

<p align="center"><sub>Choose Trending, Emerging, or Keyword research from the main screen.</sub></p>

## Quick navigation

- [Why GitHub Research?](#why-github-research)
- [How it works](#how-it-works)
- [Installation](#installation)
- [Research modes](#find-trending-github-repositories-by-language-and-timeframe)
- [FAQ](#faq)

## Why GitHub Research?

GitHub Research turns public repository activity into a structured research report instead of stopping at a leaderboard.

- **Three research modes**. Explore GitHub Trending, discover newly created repositories that meet traction filters, or start from a keyword or concept.
- **LLM-synthesized findings**. Get a research summary, recurring themes, notable repositories, and deterministic repository metrics in one report.
- **Longitudinal monitoring**. Save any research configuration as a recurring monitor and compare later snapshots with earlier runs.
- **Verifiable outputs**. Keep GitHub source links and repository-level data visible while deterministic metrics remain separate from LLM interpretation.
- **Portable reports**. Export completed research as Markdown or JSON, with every run stored in History for later review.

<p align="center">
  <img src="https://github.com/user-attachments/assets/fe5b048b-36df-44f3-b168-ae123c76d4ec" alt="GitHub Research emerging repositories report" width="800" />
</p>

<p align="center"><sub>Example Emerging report generated on September 18, 2026.</sub></p>

## How it works

1. **Choose a research mode.** Select Trending, Emerging, or Keyword and configure the relevant filters.
2. **Build the GitHub research request.** The backend converts the configuration into GitHub Trending or repository-search URLs.
3. **Retrieve public GitHub pages.** [Decodo Web Scraping API](https://decodo.com/scraping/web) retrieves the page HTML used for the research run.
4. **Normalize repository data.** Deterministic parsers extract repository metadata into a shared repository-snapshot format.
5. **Generate the research report.** Your selected LLM provider receives the normalized current dataset, deterministic metrics, and relevant previous snapshots to produce themes and notable findings.
6. **Store the run.** MongoDB stores the configuration, repository snapshots, and generated report for History and later comparisons.
7. **Review or export the result.** Open the report in the UI or download it as Markdown or JSON.

The current research flow does **not** use the GitHub REST API as its data source. It retrieves public GitHub pages through Decodo Web Scraping API.

## Prerequisites

Before installing the project, make sure you have:

- [Bun](https://bun.sh) 1.2.5 or newer
- [Docker](https://docker.com) or another Docker-compatible runtime
- A Decodo Web Scraping API Basic Auth token – [create a Decodo account](https://dashboard.decodo.com/register?page=scrapers/pricing)
- At least one supported LLM provider API key:
  - Anthropic
  - OpenAI
  - Google Gemini

> If you've just installed Bun, open a new terminal window or reload your shell configuration before running `bun install`.
>
> Examples:
> - zsh: `source ~/.zshrc`
> - bash: `source ~/.bashrc`

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Decodo/github-research.git
cd github-research
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

Create a local `.env` file from the included example:

```bash
cp .env.example .env
```

Files beginning with a dot may be hidden by default. If you don't see `.env` in the project folder:

- On macOS Finder, press **Cmd**+**Shift**+**.**
- On most Linux file managers, press **Ctrl**+**H**
- On Windows, use **View** → **Show** → **Hidden items** if needed

Open `.env` and add your Decodo token, select an LLM provider, and add the API key for that provider.

```env
# Backend
PORT=5002
PUBLIC_API_BASE_URL=http://localhost:5002
PUBLIC_FRONTEND_URL=http://localhost:5274

# Database
MONGO_PORT=27018
MONGODB_URI=mongodb://localhost:27018/github-research

# Decodo Web Scraping API
# Paste the Basic Auth token only, without the word "Basic".
DECODO_AUTH_TOKEN=
DECODO_SCRAPER_ENDPOINT=https://scraper-api.decodo.com/v2/scrape

# LLM provider: claude | openai | gemini
LLM_PROVIDER=claude
LLM_MODEL=

ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Only the API key for the selected `LLM_PROVIDER` is required. `LLM_MODEL` is optional and can be left empty to use the provider default configured by the application.

### 4. Start MongoDB

Make sure Docker is running, then start the local MongoDB container:

```bash
bun db:up
```

If Docker reports that port `27018` is already allocated, another MongoDB container or service is already using that host port. Stop the conflicting service or change both `MONGO_PORT` and the port in `MONGODB_URI`.

### 5. Build the application

```bash
bun run build
```

### 6. Start GitHub Research

```bash
bun dev
```

Keep the terminal window open while using the application. Closing it stops the local frontend and backend.

Frontend:

```text
http://localhost:5274
```

Backend API:

```text
http://localhost:5002
```

## Find trending GitHub repositories by language and timeframe

**Trending** mode researches GitHub's own Trending page and turns the current ranking into a structured research report.

You can configure:

- **Timeframe**. Daily, weekly, or monthly
- **Programming language**. Optional
- **Spoken language**. Optional, using GitHub Trending's spoken-language filter

For each repository, GitHub Research can collect the repository name, description, programming language, total stars, forks, and the period-specific star count exposed by GitHub Trending. The report then identifies supported themes, notable repositories, the most represented language, and the top period-star mover.

Period-star counts come from GitHub Trending itself. GitHub Research does not attempt to reproduce or reverse-engineer GitHub's Trending ranking algorithm.

## Discover emerging repositories before they trend

**Emerging** mode uses GitHub repository search to find recently created repositories that already meet the thresholds you choose.

Available filters include:

- **Created within**. Past day, past 7 days, or past 30 days
- **Programming language**. Optional
- **Minimum stars**
- **Minimum forks**. Optional
- **Exclude forked repositories**. Enabled by default

The resulting report focuses on current star counts, languages, repository topics, recurring clusters, and standout new projects.

In this tool, **emerging** means newly created repositories that match the selected filters. It is an operational research category, not a prediction that a repository will become broadly popular.

## Run keyword research across GitHub repositories

**Keyword** mode starts from a term or concept such as `MCP`, `RAG`, or `browser agent` and researches matching GitHub repositories.

The main search always keeps a current relevance landscape. You can optionally select a **7-day, 30-day, or 90-day recent repository window**, which adds repositories created during that period instead of replacing the broader landscape with creation-only results.

Keyword research can use:

- Repository names and descriptions
- Programming languages
- GitHub topics exposed in repository search
- Current star counts
- An optional minimum-star threshold
- Recently created matching repositories when a recent window is selected

The LLM analyzes the normalized repository data and returns a research summary, recurring themes, notable repositories, and historical comparisons when previous matching runs exist.

## Track GitHub repository research over time

Any research configuration can be saved as a recurring monitor.

Supported schedules include:

- Custom intervals in hours
- Daily
- Weekly
- Monthly

The local NestJS backend checks for due monitors every 15 seconds. Automatic runs occur only while the backend and MongoDB are running, so the included scheduler is intended for local or always-on deployments rather than offline execution.

The **Monitors** view shows saved configurations, next and previous run times, and the latest run status. Monitors can be run manually, paused or resumed, and deleted. Pausing a monitor stops future scheduled runs; it does not cancel research that is already in progress.

Each completed run is stored in **History**. When a matching previous snapshot exists, GitHub Research compares shared repository metrics and repository composition across runs. Comparison windows under six hours are treated as diagnostic snapshots rather than evidence of a durable trend.

## How this compares to GitHub Trending, OSS Insight, and Star History

GitHub Research is designed as a research layer rather than a replacement for every GitHub analytics tool.

| | GitHub Research | [GitHub Trending](https://github.com/trending) | [OSS Insight](https://ossinsight.io/) | [Star History](https://www.star-history.com/) |
| --- | --- | --- | --- | --- |
| **Primary workflow** | Research trending, emerging, or keyword-based repository activity | Browse repositories currently trending on GitHub | Query and analyze large-scale GitHub event data | Explore repository star growth and star-based trends |
| **Keyword or concept research** | Yes, with LLM-synthesized themes across matching repositories | No dedicated keyword-research workflow | Natural-language analytics queries over its GitHub dataset | Primarily repository and star-history oriented |
| **LLM-synthesized repository themes** | Yes | No | Analytics answers and visualizations rather than this report format | No |
| **Emerging repository workflow** | Yes, using creation windows and user-defined star/fork filters | No dedicated newly-created-repository mode | Rankings and data exploration | Star-growth and trending views |
| **Recurring local monitors** | Yes | No | Not the same local monitor workflow | No equivalent local research-monitor workflow |
| **Stored reports and longitudinal comparison** | Yes | No | Historical analytics are available | Star history is the core focus |

The comparison describes each product's main workflow. These tools solve overlapping but different problems.

## Configuration

### Environment variables

| Variable | Description |
| --- | --- |
| `PORT` | Backend port. Defaults to `5002` |
| `PUBLIC_API_BASE_URL` | API URL used by the frontend |
| `PUBLIC_FRONTEND_URL` | Frontend URL used by the application |
| `MONGO_PORT` | Host port mapped to the MongoDB container |
| `MONGODB_URI` | MongoDB connection string |
| `DECODO_AUTH_TOKEN` | Decodo Web Scraping API Basic Auth token, without the `Basic` prefix |
| `DECODO_SCRAPER_ENDPOINT` | Decodo scraping endpoint. The included default is normally sufficient |
| `LLM_PROVIDER` | LLM provider: `claude`, `openai`, or `gemini` |
| `LLM_MODEL` | Optional model override |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GEMINI_API_KEY` | Google Gemini API key |

The **Settings** page can change the active LLM provider and optional model override. API keys and the Decodo token remain environment variables and are never returned by the settings API.

### Research filters

| Mode | Setting | Options / behavior |
| --- | --- | --- |
| Trending | Timeframe | Daily, weekly, monthly |
| Trending | Programming language | Optional |
| Trending | Spoken language | Optional GitHub spoken-language code |
| Emerging | Created within | 1 day, 7 days, 30 days |
| Emerging | Programming language | Optional |
| Emerging | Minimum stars | Numeric threshold |
| Emerging | Minimum forks | Optional numeric threshold |
| Emerging | Exclude forks | Enabled by default |
| Keyword | Keyword | Required |
| Keyword | Recent repository window | Any time, 7 days, 30 days, 90 days |
| Keyword | Programming language | Optional |
| Keyword | Minimum stars | Numeric threshold |

## Research methodology

GitHub Research separates deterministic repository metrics from LLM interpretation.

- **Deterministic facts stay authoritative**. Repository counts, language counts, star counts, period-star counts, and source URLs come from parsed GitHub data rather than from the LLM.
- **Themes require supporting evidence**. The analysis prompt normally requires at least two current repositories before promoting a pattern into a theme. A single unusual project can still appear under notable repositories.
- **Unknown names are not silently defined**. If multiple repositories mention an unfamiliar product, acronym, model, or concept, the report can identify the observable cluster but should not infer what the term means unless the repository metadata establishes it.
- **Emerging mode does not invent star velocity**. GitHub repository-search results provide current star counts, not period-specific star gains, so Emerging reports do not claim a top period mover.
- **Keyword windows are supplemental**. A recent window adds recently created repositories to the current keyword landscape instead of treating every result as newly created.
- **Historical claims use matching evidence**. Repository deltas are compared only when the same repository and metric are available in earlier snapshots. Windows under six hours are explicitly treated as diagnostic.

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/research` | Run a GitHub research request |
| `POST` | `/research/stream` | Run research with NDJSON progress events |
| `GET` | `/queries` | List saved research history |
| `GET` | `/queries/:id` | Retrieve one stored report |
| `DELETE` | `/queries/:id` | Delete a history entry |
| `GET` | `/monitors` | List recurring monitors |
| `POST` | `/monitors` | Create a recurring monitor |
| `PATCH` | `/monitors/:id` | Update, pause, or resume a monitor |
| `POST` | `/monitors/:id/run` | Run a saved monitor immediately |
| `DELETE` | `/monitors/:id` | Delete a monitor |
| `GET` | `/settings` | Return provider/model selection and API-key presence status |
| `PATCH` | `/settings` | Update provider or model preference |

## FAQ

### What counts as a trending GitHub repository in this tool?

Trending mode uses the repositories currently returned by [GitHub Trending](https://github.com/trending) for the selected daily, weekly, or monthly window and optional language filters. GitHub Research analyzes that retrieved set and the period-star values GitHub exposes. It does not independently define or reconstruct GitHub's Trending ranking algorithm.

### How is GitHub Research different from GitHub's own Trending page?

GitHub Trending provides a ranked view of repositories attracting attention for a selected period. GitHub Research can analyze that set, but it also adds Emerging and Keyword modes, LLM-synthesized themes, notable-repository explanations, stored reports, recurring monitors, historical comparisons, and Markdown or JSON export.

### How does the keyword research mode work?

Keyword mode runs a current GitHub repository search for the supplied term and analyzes repository metadata such as descriptions, topics, languages, and stars. If you select a 7-day, 30-day, or 90-day recent window, the tool also retrieves repositories created during that period and adds them to the broader current landscape.

### Does GitHub Research use the GitHub API or Decodo Web Scraping API?

The current research flow uses [Decodo Web Scraping API](https://decodo.com/scraping/web), not the GitHub REST API, to retrieve public GitHub pages. The backend then parses the returned HTML into normalized repository snapshots before passing structured data, deterministic facts, and relevant historical snapshots to the selected LLM provider.

### What are GitHub's API rate limits, and how does this tool handle them?

GitHub documents a primary REST API limit of **60 requests per hour for unauthenticated requests** and **5,000 requests per hour for most authenticated users**, with separate or stricter limits for some resources such as search. GitHub Research does not use the REST API as its research data source, so those REST API request quotas are not the collection mechanism used by this project. See [GitHub's rate-limit documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

### Do I need a Decodo account?

Yes. GitHub Research retrieves its GitHub source pages through Decodo Web Scraping API, so you need a [Decodo account](https://dashboard.decodo.com/) and a valid Web Scraping API authentication token. The token is supplied through `DECODO_AUTH_TOKEN` in your local `.env` file and is not exposed by the application's Settings API.

### Is GitHub Research affiliated with GitHub, Inc.?

No. GitHub Research is an independent open-source project maintained by Decodo. It researches publicly available GitHub repository data and links reports back to GitHub source pages, but it is not affiliated with, sponsored by, or endorsed by GitHub, Inc.

### Can I self-host GitHub Research?

Yes. GitHub Research is designed to run locally or on an always-on host with Bun, MongoDB, and the required API credentials. Recurring monitors only execute while the backend and database are running, so scheduled monitoring requires the application to remain online between runs.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TanStack Router, TanStack Query, Tailwind CSS v4, Radix UI, Rsbuild |
| Backend | NestJS 11, MongoDB, Mongoose |
| GitHub retrieval | Decodo Web Scraping API |
| Parsing | Cheerio and deterministic GitHub parsers |
| LLMs | Anthropic Claude, OpenAI GPT, Google Gemini |
| Runtime | Bun |
| Local services | Docker Compose, MongoDB |

## Project structure

```text
.github/
  images/              # README screenshots and repository assets

apps/
  backend/src/features/
    decodo/             # Decodo Web Scraping API integration
    github/             # GitHub URL builders and HTML parsers
    research/           # Research execution, analysis, and reporting
    monitors/           # Saved schedules and recurring execution
    queries/            # History and stored snapshots
    llm/                # Anthropic, OpenAI, and Gemini abstraction layer
    settings/           # Provider/model configuration

  frontend/src/features/
    tracker/            # Research form, progress flow, and report UI
    monitors/           # Recurring monitor controls
    queries/            # History and stored reports
    settings/           # Runtime provider/model settings

  shared/src/           # Shared TypeScript types

docs/
  ARCHITECTURE.md
```

## Scripts

| Command | Description |
| --- | --- |
| `bun dev` | Build shared types and start frontend/backend development servers |
| `bun run build` | Build all application packages |
| `bun start` | Start the production backend and frontend preview server |
| `bun lint` | Run linting across frontend and backend |
| `bun format` | Format frontend and backend source files |
| `bun db:up` | Start MongoDB through Docker Compose |
| `bun db:down` | Stop the local database container |

## Related repositories

- [Decodo Forum Scraper](https://github.com/Decodo/Forum-scraper)
- [Decodo Stack Overflow Trends Monitor](https://github.com/Decodo/stackoverflow-trends-monitor)
- [Decodo Web Scraping API](https://github.com/Decodo/Web-Scraping-API)
- [Decodo SDK for TypeScript](https://github.com/Decodo/sdk-ts)
- [Decodo MCP Server](https://github.com/Decodo/mcp-server)
- [Decodo OpenClaw Skill](https://github.com/Decodo/decodo-openclaw-skill)

For Web Scraping API targets, parameters, and request behavior, see the [Decodo Web Scraping API documentation](https://help.decodo.com/docs/web-scraping-api-introduction).

## License

MIT – see [LICENSE](LICENSE).
