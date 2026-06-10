# 1. Build Stage
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod ./
# Copy source
COPY . .

# Fetch dependencies
RUN go mod tidy

# Build statically linked, stripped binary for maximum performance & small footprint
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o edge_ingest edge_ingest.go

# 2. Production Stage (Alpine for minimal footprint + certificates)
FROM alpine:latest  
RUN apk --no-cache add ca-certificates
WORKDIR /

COPY --from=builder /app/edge_ingest /edge_ingest

# UDP Ingestion Port
EXPOSE 8080/udp
# Prometheus Metrics Port
EXPOSE 2112

ENTRYPOINT ["/edge_ingest"]
