# Kubernetes Sample App

This project is a simple Node.js API that connects to PostgreSQL and is designed to run in a Kubernetes cluster.

## Features

- Express API running on port 3000
- PostgreSQL connection using `pg`
- Database health check endpoint
- CRUD endpoints for `items`
- Swagger UI for API documentation
- Kubernetes manifests under `k8s/base`

## Project structure

```text
.
├── app/
│   ├── db.js
│   ├── Dockerfile
│   └── server.js
├── k8s/
│   └── base/
│       ├── configmap.yaml
│       ├── deployment.yaml
│       ├── hpa.yaml
│       ├── namespace.yaml
│       ├── postgres-deployment.yaml
│       ├── postgres-service.yaml
│       ├── secret.yaml
│       └── service.yaml
├── package.json
├── package-lock.json
└── README.md
```

## Prerequisites

- Node.js 18+
- npm
- Docker (for running PostgreSQL locally)
- Optional: Kubernetes cluster or `kubectl`

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL with Docker:

```bash
docker run --name k8s-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p 5432:5432 \
  -d postgres:15
```

3. Start the API:

```bash
npm start
```

The app will start on:

```text
http://localhost:3000
```

## API endpoints

### Health check

```bash
curl http://localhost:3000/health
```

Example response:

```json
{
  "status": "ok",
  "dbTime": "2026-10-02T12:00:00.000Z"
}
```

### Create an item

```bash
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{"name":"demo item","completed":false}'
```

### Update an item

```bash
curl -X PUT http://localhost:3000/items/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'
```

## Swagger UI

Open the Swagger docs here:

```text
http://localhost:3000/api-docs
```

The raw OpenAPI JSON is also available here:

```text
http://localhost:3000/swagger.json
```

## Kubernetes deployment

Apply the manifests in order:

```bash
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/secret.yaml
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/postgres-deployment.yaml
kubectl apply -f k8s/base/postgres-service.yaml
kubectl apply -f k8s/base/deployment.yaml
kubectl apply -f k8s/base/service.yaml
```

Then port-forward the app:

```bash
kubectl -n node-api-app port-forward deployment/node-api 3000:3000
```

## Notes

- The PostgreSQL volume in the manifest is intentionally `emptyDir` for demo/dev use.
- For production, use a persistent volume claim and a proper secret management solution.
- The app is intentionally simple for learning Kubernetes and container networking.
