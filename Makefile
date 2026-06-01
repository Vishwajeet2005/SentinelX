.PHONY: help up down restart logs build ui-dev

help: ## Show this help message
	@echo "SentinX Anti-Cheat Developer Commands"
	@echo "-------------------------------------"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Start the entire SentinX backend stack in the background
	docker compose up -d

build: ## Rebuild all docker containers
	docker compose build

down: ## Stop and remove all containers and networks
	docker compose down

restart: down up ## Restart the entire stack

logs: ## Tail the logs of all running services
	docker compose logs -f

ui-dev: ## Run the React dashboard locally outside of Docker
	cd dashboard && npm install && npm run dev
