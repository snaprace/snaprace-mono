# SnapRace Monorepo

SnapRace is a platform designed to help marathon and race participants easily find their photos using bib numbers, selfies, and timing data. Developed in collaboration with Millennium Running, it leverages AWS Rekognition for advanced image analysis and search capabilities.

This project is managed as a monorepo using [Turborepo](https://turborepo.com/).

## 🚀 Core Features

- **Dynamic Bib Number Pages**: Personalized photo pages based on participant bib numbers.
- **Race Gallery**: A mobile-optimized gallery for efficiently browsing large volumes of photos.
- **Face Recognition Search**: Allows users to register a selfie to find photos containing their face (powered by AWS Rekognition).
- **Photo Download & Sharing**: Functionality for downloading original/watermarked images and sharing directly to social media.

## 📂 Project Structure

This repository consists of the following apps and packages:

### Apps

- **`apps/web`**: The Next.js web application responsible for the user interface.
  - **Tech Stack**: Next.js (App Router), Tailwind CSS, shadcn/ui, tRPC
  - **Key Role**: User frontend, gallery viewer, search interface.

### Packages & Infrastructure

- **`packages/image-rekognition`**: AWS infrastructure code for image analysis and bib/face recognition.
  - **Tech Stack**: AWS CDK, AWS Lambda, DynamoDB, Amazon Rekognition
  - **Key Role**: Analyzes race photos uploaded to S3 to extract bib and face data, storing results in DynamoDB.

- **`packages/image-transform`**: Serverless image handler for resizing and optimization.
  - **Tech Stack**: AWS CloudFront, Lambda@Edge (Sharp), API Gateway
  - **Key Role**: Dynamically transforms and serves images optimized for various devices.

- **`packages/supabase`**: Supabase configuration and database schema management.

- **`packages/scripts`** & **`packages/shell-scripts`**: A collection of utilities for data cleanup, migrations, and maintenance.

- **`packages/ui`**: Shared React UI component library used across applications.

- **Configuration**:
  - `@repo/eslint-config`: Shared ESLint configurations.
  - `@repo/typescript-config`: Shared TypeScript configurations (`tsconfig.json`).

## 🛠 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (Package Manager)
- AWS CLI (Required for infrastructure deployment)

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

Run the development server for all apps and packages:

```bash
pnpm dev
```

To run a specific app, use the filter:

```bash
# Run only the web app
pnpm dev --filter=web
```

### Build

```bash
pnpm build
```

## 🏗 Architecture & Data Flow

1. **Image Upload**: Photographers upload race photos to an S3 bucket.
2. **Image Analysis (`image-rekognition`)**:
   - S3 events trigger AWS Lambda functions.
   - Rekognition detects faces and bib numbers in the photos.
   - Analyzed data (bibs, face IDs, etc.) is stored in DynamoDB.
3. **Data Query (`apps/web`)**:
   - The web app queries DynamoDB (or connected APIs) to display photos to the user.
4. **Image Serving (`image-transform`)**:
   - When users request images, they are served via CloudFront and Lambda, optimized and resized on-the-fly.

## 📝 Documentation

For more details, please refer to the documentation within each package:

- [Web App Project Spec](apps/web/PROJECT_SPEC.md)
- [Image Rekognition Docs](packages/image-rekognition/README.md)

## License

This project is Private.
