.PHONY: help setup dev up down build test env

help:
	@echo "24 Hour Clipping — monorepo commands"
	@echo "  make env      Copy .env.example -> .env for backend & frontend"
	@echo "  make setup    Install backend (pip) and frontend (yarn) deps"
	@echo "  make dev      Run backend + frontend locally (needs local MongoDB)"
	@echo "  make up       Run the whole stack with Docker Compose"
	@echo "  make down     Stop the Docker Compose stack"
	@echo "  make build    Production build of the frontend"
	@echo "  make test     Run backend tests"

env:
	cp -n backend/.env.example backend/.env || true
	cp -n frontend/.env.example frontend/.env || true

setup:
	cd backend && pip install -r requirements-core.txt
	cd frontend && yarn install

dev:
	npm run dev

up:
	docker compose up --build

down:
	docker compose down

build:
	cd frontend && yarn build

test:
	cd backend && pytest
