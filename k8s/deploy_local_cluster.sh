#!/bin/bash
# SentinX Enterprise Local Cluster Deployment Script
# This script deploys the entire SentinX Anti-Cheat architecture to a local Minikube cluster
# Complete with Horizontal Pod Autoscaling (HPA) and Prometheus metrics.

set -e

echo "========================================================="
echo "🚀 Deploying SentinX to Local Kubernetes Cluster..."
echo "========================================================="

# 1. Ensure Minikube is running
if ! minikube status > /dev/null 2>&1; then
    echo "Starting Minikube..."
    minikube start --cpus=4 --memory=8192
fi

# 2. Enable Metrics Server (Required for HPA)
echo "Enabling Metrics Server for Horizontal Pod Autoscaling..."
minikube addons enable metrics-server

# 3. Create Secrets
echo "Provisioning HMAC Secrets..."
kubectl create secret generic sentinel-secrets --from-literal=hmac-secret=$(openssl rand -base64 32) --dry-run=client -o yaml | kubectl apply -f -

# 4. Deploy Infrastructure (Stateful)
echo "Deploying Stateful Infrastructure (ZooKeeper, Kafka, ClickHouse)..."
kubectl apply -f zookeeper.yaml
kubectl apply -f kafka.yaml
kubectl apply -f clickhouse.yaml

# 5. Wait for Kafka to be ready before deploying workers
echo "Waiting for Kafka broker to initialize..."
kubectl wait --for=condition=ready pod -l app=kafka --timeout=120s || echo "Kafka is still starting, proceeding..."

# 6. Apply RBAC for HPA
echo "Applying RBAC policies for Metrics Reader..."
kubectl apply -f hpa-rbac.yaml

# 7. Deploy Application Nodes (Stateless, Autoscaled)
echo "Deploying Stateless Workers (Edge Ingest, ML Inference)..."
kubectl apply -f edge-ingest.yaml
kubectl apply -f ml-inference.yaml

# 8. Deploy Dashboard
echo "Deploying Dashboard API & UI..."
kubectl apply -f dashboard.yaml

echo "========================================================="
echo "✅ Deployment Complete!"
echo "========================================================="
echo "To monitor your autoscaling, run:"
echo "  kubectl get hpa -w"
echo ""
echo "To view the dashboard, run:"
echo "  minikube service dashboard-ui"
echo "========================================================="
