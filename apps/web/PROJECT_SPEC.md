# SnapRace - Race Photo Finder Project

## Project Overview
A collaboration with Millennium Running to help race participants easily find their photos using timing data, selfies, and bib numbers. The service leverages AWS Lambda for image detection with data stored in DynamoDB.

## Core Features

### 1. Dynamic Bib Number Pages
- Individual pages for each bib number
- Participants can view only their own photos
- URL structure: `/bib/[number]`

### 2. Race Gallery Page
- View all photos from a race event
- Filterable and searchable
- Optimized for mobile viewing with large photo volumes

### 3. Image Download
- Direct download functionality for individual photos
- Batch download options (potential feature)

### 4. Social Media Sharing
- Share photos directly to social platforms
- Pre-formatted captions with race information
- Open Graph meta tags for rich previews

## Technical Stack
- **Framework**: Next.js (T3 Stack)
- **UI Components**: shadcn/ui
- **Database**: AWS DynamoDB (existing)
- **Image Detection**: AWS Lambda (implemented)
- **Styling**: Tailwind CSS

## Design Principles
- **Trendy & Modern**: Contemporary visual aesthetics
- **Simple & Minimal**: Clean, uncluttered interface
- **Mobile-First**: Optimized for mobile devices (primary user base)
- **Responsive**: Seamless experience across all screen sizes
- **Performance**: Fast loading for large image galleries

## User Demographics
- Primary audience: US-based runners
- Language: English
- Access pattern: Predominantly mobile devices

## Data Flow
1. AWS Lambda processes race photos and detects bib numbers
2. Detected data stored in DynamoDB
3. Next.js app fetches and displays data
4. Users access photos via bib number or browse full gallery

## Priority Tasks
1. UI/UX design and component structure
2. Page routing and navigation
3. Mobile-optimized gallery layout
4. Download and sharing functionality
5. Data integration with DynamoDB