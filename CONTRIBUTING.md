# Contributing to CueBI

CueBI is an internal Cuemath tool. This guide covers how to set up your development environment and contribute changes.

## Getting Started

1. Clone the internal repository
2. Create a branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Run tests: `PYTHONPATH=. python3 -m pytest tests/ -m "not integration" -v`
5. Commit with a descriptive message: `git commit -m "feat: add Athena connector"`
6. Open a PR for review

## Development Setup

```bash
docker-compose up --build
```

All services start together. Hot-reload enabled for both `api` and `web`.

## Adding a New Connector

The connector system is designed to be extensible.

1. Create `packages/connectors/<name>.py`
2. Subclass `BaseConnector` and implement:
   - `test_connection()`
   - `extract_schema()`
   - `execute_query()`
   - `close()`
3. Register it in `packages/connectors/__init__.py`
4. Add it to the `CONNECTOR_TYPES` array in `apps/web/app/connections/page.tsx`

## Code Style

- Python: follow existing patterns, type hints required for public functions
- TypeScript: functional components, no class components
- Keep PRs focused — one feature or fix per PR

---

© 2026 Cuemath. Internal use only.
