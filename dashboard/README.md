# Harshwal Automation - Dashboard

This is the Next.js frontend dashboard for the Harshwal Automation suite. It acts as the central command center for the Digital Marketing (DM) Leader, Designers, and SEO Executives to manage the 7-layer SMO content pipeline.

## Core Features
- **Strict Review Queues**: Interfaces for DM Leaders to approve, reject, or edit AI-generated posts, integrated with the Claude Haiku pre-screen scores.
- **Designer Visual Queue**: A dedicated RBAC tab for Designers to approve specific "Blue Arrow CPA" cultural visuals before the DM Leader can publish.
- **DM Asset Library**: A masonry-grid AWS S3-backed asset store to manage logos, photos, and visual reports.
- **Report Sharing Hub**: One-click sharing of system-generated performance reports to management via AWS SES emails or secure 48-hour links.
- **Agent Health Monitoring**: Live polling indicators in the navigation bar to track the uptime and health of the autonomous AI fleet (Agents 1-7).
- **Blog Cascade Previews**: Visual timelines showing exactly what social posts will be auto-generated when a blog is approved.

## Dependencies
- **Framework**: `Next.js 14/15` (App Router)
- **Language**: `TypeScript`
- **UI & Styling**: Vanilla `CSS` (using CSS variables, flex/grid, and glassmorphism styling)

## Environment Variables
Create an `.env.local` file in the `dashboard/` directory.

```env
# Point to the FastAPI backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Base URL for S3 bucket assets (Library preview links)
NEXT_PUBLIC_S3_BASE_URL=https://harshwal-dm-library.s3.ap-south-1.amazonaws.com
```

## How to Run Locally

1. **Ensure Backend & Databases are Running**
   The frontend relies on FastAPI (`:8000`), MongoDB, and PostgreSQL. Ensure those are live.

2. **Install Dependencies**
   Navigate to the dashboard directory and install:
   ```bash
   npm install
   ```

3. **Run the Development Server**
   Start the Next.js server:
   ```bash
   npm run dev
   ```

4. **Access the Dashboard**
   Open your browser and navigate to:
   `http://localhost:3000`

   **Test Logins (Mocked via RBAC):**
   - `admin` / `harshwal2026`
   - `purnima` / `harshwal2026` (DM Leader)
   - `designer` / `harshwal2026` (Designer)

## Production Build
To create an optimized production build, run:
```bash
npm run build
npm run start
```
