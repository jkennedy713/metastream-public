# Metastream – AWS Data Ingestion & Insight Hub

Metastream is a **serverless AWS-based pipeline** that ingests files, enriches metadata using AI, and visualizes insights via a secure web dashboard.

## 🚀 Workflow
1. **Auth** – Amazon Cognito secures access.
2. **Upload** – Files (`.csv`, `.xlsx`, `.json`, `.tsv`, `.txt`) are uploaded to S3.
3. **Process** – S3 triggers Lambda → parses file → calls Amazon Comprehend for key phrases → stores enriched metadata in DynamoDB.
4. **View** – React + Amplify dashboard displays searchable, filterable insights.
5. **Monitor** – CloudWatch tracks health; optional SNS alerts.

## 🛠 Stack
- **Frontend**: React (Vite, TypeScript, Tailwind), AWS Amplify Hosting
- **Backend**: S3, Lambda, DynamoDB, Comprehend, Cognito, CloudWatch

## 📦 Setup
```bash
git clone https://github.com/jkennedy713/metastream-public.git
cd metastream-public
npm install
cp .env
npm run dev
Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
