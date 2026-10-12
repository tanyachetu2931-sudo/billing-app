<<<<<<< HEAD
# BillWise — Billing Application + DevOps Learning Project

A starter full-stack billing app: React frontend, Node.js/Express API, PostgreSQL, Docker Compose, Kubernetes manifests, and a Jenkins pipeline skeleton.

> Learning project only. It does not yet implement login/roles, invoice PDF/email, full tax/accounting rules, audit logs, or production-grade secrets/networking. Do not use it for real financial data without a security and correctness review.

## Architecture

Browser → React/nginx frontend → Express REST API → PostgreSQL database

For the DevOps path: GitHub → Jenkins → tests/build → Amazon ECR → Amazon EKS → Kubernetes Services/LoadBalancer.

## Prerequisites

- Git and GitHub account
- Docker Desktop (Windows/macOS) or Docker Engine + Compose plugin (Linux)
- Node.js 22+ for local development (optional if using Docker)
- Later: AWS CLI, IAM permissions, ECR, EKS, kubectl, Jenkins

## 1. Run locally with Docker Compose

```bash
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD to a local development password
docker compose up --build -d
docker compose ps
```

Open http://localhost:8080. The sample customer and two sample products are inserted when PostgreSQL initializes a new data volume. Test the API at http://localhost:8080/api/health.

To inspect logs:

```bash
docker compose logs -f backend
docker compose logs -f db
```

To stop containers without deleting database data:

```bash
docker compose down
```

To reset all local database data (destructive):

```bash
docker compose down -v
```

## 2. Test the API

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/customers
curl http://localhost:8080/api/products
```

Create a customer:

```bash
curl -X POST http://localhost:8080/api/customers \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ravi Kumar","email":"ravi@example.com","phone":"9000000001"}'
```

Create a product:

```bash
curl -X POST http://localhost:8080/api/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mouse","sku":"MOU-001","price":499,"stock":20}'
```

The API returns IDs. Use them to POST `/api/invoices`, for example:

```bash
curl -X POST http://localhost:8080/api/invoices \
  -H 'Content-Type: application/json' \
  -d '{"customerId":1,"items":[{"productId":1,"quantity":2}],"taxRate":18}'
```

## 3. Push to GitHub

Create an empty GitHub repository named `billing-app`. From this project directory:

```bash
git init
git add .
git commit -m "Initial billing application"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/billing-app.git
git push -u origin main
```

Do not commit `.env`, passwords, AWS access keys, or database credentials.

## 4. Jenkins and AWS pipeline plan

1. Install Jenkins on a dedicated machine/EC2 instance; do not expose its UI publicly without secure access.
2. Install/configure Git, Docker, AWS CLI, kubectl, and required Jenkins plugins.
3. Configure GitHub webhook (or polling) to trigger builds.
4. Add AWS credentials in Jenkins Credentials using ID `aws-jenkins-credentials`; prefer an IAM role on the Jenkins EC2 instance instead of long-lived access keys when possible.
5. Create ECR repositories `billing-app-backend` and `billing-app-frontend` in `ap-south-1`.
6. Create an EKS cluster only after checking AWS account permissions, regional availability, and costs.
7. Provision PostgreSQL preferably with Amazon RDS, private networking, backups, and restricted security groups. Do not use the demo local database container for production.
8. Create Kubernetes Secret `billing-db-secret` with key `DATABASE_URL` in namespace `billing`. Use Secrets Manager + External Secrets or another managed secret approach for a more secure production design.
9. Replace `YOUR_ACCOUNT_ID` in Kubernetes manifests and configure the cluster name/region in Jenkins.
10. Set Jenkins job parameters/environment `PUBLISH_TO_ECR=true`, `DEPLOY_TO_EKS=true`, and `EKS_CLUSTER_NAME=<your-cluster-name>` only after prerequisites and IAM permissions are verified.
11. Add tests, dependency scanning, image scanning, and manual approval before production deployment.

The Jenkinsfile is a learning skeleton. Its AWS stages are disabled by default. The Jenkins AWS credential binding requires the matching plugin; adapt it to your chosen Jenkins agent and IAM approach.

## 5. Kubernetes manifests

Review `k8s/` before applying. Set the correct ECR image URIs, create the database secret, and ensure network access from EKS to RDS. Then:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl -n billing get pods,svc
kubectl -n billing rollout status deployment/billing-backend
kubectl -n billing rollout status deployment/billing-frontend
```

The frontend Service is `LoadBalancer`, which can create AWS infrastructure and incur charges. Use an ingress/controller if that better fits your cluster design.

## Next development milestones

- Add automated backend tests and frontend linting.
- Add login/authentication and role-based access before multi-user use.
- Add invoice details endpoint and PDF download.
- Add edit/delete customer and product flows with audit safeguards.
- Add RDS migrations rather than relying on first-boot SQL initialization.
- Add GitHub Actions or Jenkins quality gates, Trivy image scanning, and rollback strategy.
- Add monitoring/logging, TLS, backups, least-privilege IAM, network policies, and resource budgets.
=======
# billing-app
>>>>>>> 56fb82e27828a1078c0aab110808271cdcc3daf9
