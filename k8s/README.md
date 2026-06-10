# SentinelX Enterprise Kubernetes Deployment

This directory contains the production-grade Kubernetes (K8s) manifests required to deploy SentinelX at scale on AWS EKS, GCP GKE, or Azure AKS.

## Architecture

The SentinelX K8s deployment is divided into several stateful and stateless microservices:

1. **Stateful Core (`zookeeper.yaml`, `kafka.yaml`)**
   - The Kafka cluster requires stable networking and persistent volumes. We deploy Kafka using a `StatefulSet` to maintain ordered broker IDs and data retention across pod restarts.
   
2. **Data Warehouse (`clickhouse.yaml`)**
   - ClickHouse is deployed as a `StatefulSet` with a 100GB Persistent Volume Claim (PVC) to guarantee long-term historical telemetry archival.
   - The `clickhouse-sink` is a stateless `Deployment` that drains Kafka and bulk-inserts into ClickHouse.

3. **Edge Ingestion (`edge-ingest.yaml`)**
   - Deployed as a scalable `Deployment` (5 replicas default) fronted by a UDP `LoadBalancer`.
   - Instrumented with Prometheus metrics (`prometheus.io/scrape: "true"`) on port `2112`.

4. **ML Inference (`ml-inference.yaml`)**
   - The core AI brain of SentinelX. Deployed with a **Horizontal Pod Autoscaler (HPA)**. As the game server CCU increases and telemetry spikes, K8s will automatically scale the inference engine from 2 up to 50 pods based on CPU utilization.
   - Requires the `ml-models-pvc` volume to be mounted with the pre-compiled `behavior_autoencoder_v1.onnx` optimized tensor graphs.
   - Exposes Prometheus metrics on port `8000`.

5. **Threat Dashboard (`dashboard.yaml`)**
   - The React UI and Express WebSocket API are deployed as standard stateless pods, with the UI exposed externally via a `LoadBalancer` on port 80.

## Deployment Instructions

To spin up the entire cluster, apply the manifests in order of dependency:

```bash
kubectl apply -f zookeeper.yaml
kubectl apply -f kafka.yaml
kubectl apply -f clickhouse.yaml

# Wait for Kafka to become ready before applying the rest
kubectl apply -f edge-ingest.yaml
kubectl apply -f ml-inference.yaml
kubectl apply -f dashboard.yaml
```

*Note: For the HPA to function correctly on `ml-inference`, your K8s cluster must have the Metrics Server installed.*
