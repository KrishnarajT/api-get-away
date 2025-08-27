.PHONY: dev up down logs rebuild test fmt lint

dev:
\tdocker compose up --watch

up:
\tdocker compose up -d

down:
\tdocker compose down

logs:
\tdocker compose logs -f bff

rebuild:
\tdocker compose build --no-cache bff

test:
\tdocker compose exec bff go test ./...

fmt:
\tdocker compose exec bff go fmt ./...
