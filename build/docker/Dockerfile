
# ---------- Base (with Go toolchain) ----------
FROM golang:1.22-alpine AS base
WORKDIR /app
RUN apk add --no-cache git ca-certificates tzdata
COPY go.mod go.sum ./
RUN go mod download

# ---------- Dev image (with live reload) ----------
FROM base AS dev
RUN go install github.com/cosmtrek/air@latest
COPY . .
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

# ---------- Builder (prod) ----------
FROM base AS builder
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o /bff ./cmd/bff

# ---------- Runtime (prod) ----------
FROM gcr.io/distroless/base-debian12:nonroot AS prod
WORKDIR /app
COPY --from=builder /bff /app/bff
COPY --from=base /usr/share/zoneinfo /usr/share/zoneinfo
COPY configs /app/configs
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/bff"]
