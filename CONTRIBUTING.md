# Contributing to SentinX

First off, thank you for considering contributing to SentinX! It's people like you that make SentinX such a great tool for the game development community.

## 1. Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/Vishwajeet2005/SentinelX/issues) to see if someone else has already created a ticket. If not, go ahead and make one!

## 2. Setting up the Development Environment

1. Fork the repo and clone it locally.
2. Run `make build` to build the Docker containers.
3. Run `make up` to start the local backend (Kafka, Clickhouse, Edge Ingest).
4. Run `make ui-dev` to start the React dashboard in hot-reload mode.

## 3. Submitting a Pull Request

1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes.
3. Ensure your code passes all linting and compiles successfully.
4. Push your branch and open a Pull Request against `main`.
5. Fill out the PR template completely.

## 4. Code Style

- **Go (Edge Ingest):** Always run `gofmt` and `go mod tidy` before committing.
- **C++ (SDK):** Keep ABI functions locked in `extern "C"`. Avoid standard library heap allocations inside the hot `Tick` path.
- **Python (ML):** Use type hints and PEP-8 formatting.
- **React (Dashboard):** Use ESLint. Prefer functional components and hooks.

We look forward to reviewing your PR!
