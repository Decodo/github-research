# GitHub Research architecture

GitHub Research uses a React frontend, NestJS backend, MongoDB persistence, Decodo Web Scraping API retrieval, deterministic GitHub parsing, and LLM-generated analysis.

## Pipeline

1. The frontend submits one of three research configurations: Trending, Emerging, or Keyword research.
2. `GithubUrlService` converts the configuration into GitHub Trending or repository-search URLs.
3. `DecodoService` requests those public GitHub pages through Decodo Web Scraping API with `proxy_pool: "premium"` and `headless: "html"`.
4. `GithubParserService` deterministically converts GitHub HTML / embedded search JSON into normalized repository snapshots.
5. `ResearchService` retrieves relevant stored runs, passes structured current and historical snapshots to the selected LLM, and saves the resulting report in MongoDB.
6. Recurring monitors reuse the same research pipeline on a schedule.

Keyword research always keeps a broad current landscape. When a 7/30/90-day window is selected, a second search adds repositories created during that window rather than replacing the landscape with creation-only results.

## Persistence

MongoDB stores research runs, normalized repository snapshots, generated reports, monitor configuration, and schedule state. Historical structured snapshots are the factual basis for longitudinal comparisons; old prose reports are supplementary context.

## Local services

Docker Compose currently runs MongoDB only. Redis, Playwright, Stack Exchange API integration, and residential-proxy browser infrastructure are not required by the GitHub pipeline.

## UI

The React interface uses a GitHub-inspired visual system and exposes Research, History, Monitors, Settings, and light/dark theme support. The research form provides Trending, Emerging, and Keyword modes.
