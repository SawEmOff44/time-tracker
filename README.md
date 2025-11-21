# Time Tracker – GPS Geofenced Employee Clock

Internal time tracking system for field employees working across multiple locations.

Employees clock in/out from their phones, GPS location is validated against geofenced job sites, and admins can manage employees, locations, and shifts from a secure dashboard. Data is stored in Postgres and can be exported for payroll.

---

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **UI:** React + Tailwind CSS
- **Database:** PostgreSQL (Vercel Postgres)
- **ORM:** Prisma
- **Hosting:** Vercel
- **Auth:**
  - Employees: `employeeCode` + `PIN`
  - Admin: password-protected, cookie-based session

---

## High-Level Architecture

- The app is deployed on **Vercel** and built with **Next.js**.
- All React pages (public clock and admin UI) live under the `app/` directory.
- All server-side logic (clocking, admin CRUD, exports) is implemented as **Next.js API routes** under `app/api/*`, running as **serverless functions**.
- Data is persisted in **Postgres**, accessed through **Prisma**.
- GPS-based geofencing is enforced on the server during clock-in/out.

For a visual, see `docs/architecture.md` (or the Mermaid diagram in this README).

---

## Features

### Employee (Public) Side

- **Clock In / Out** at `/clock`
  - Employee enters:
    - Employee Code
    - PIN
    - Selects Location / Job Site
  - Browser prompts for GPS location.
  - The server validates:
    - `employeeCode` + `PIN`
    - Distance to selected location’s geofence (lat/lng + radius in meters).
  - Creates or closes a shift in the database.

### Admin Side

All admin routes are under `/admin/*`, protected by an admin password and session cookie.

- **Admin Login** – `/admin/login`
  - Uses `ADMIN_PASSWORD` from environment variables.
  - On success, sets a secure `admin_session` cookie.

- **Admin Dashboard** – `/admin`
  - Overview entry point for the admin tools.

- **Employees Management** – `/admin/employees`
  - List employees
  - Create / update / delete employees
  - Fields include:
    - Name
    - Employee code
    - PIN (or PIN hash, depending on implementation)
    - Role
    - Active status
    - (Optionally) default location

- **Locations Management** – `/admin/locations`
  - List all job sites
  - Create / update / delete locations
  - Fields:
    - Name
    - Code
    - Latitude / longitude
    - Radius (meters)
    - Active flag
  - Includes a small **map preview** to visualize and confirm geofence positions.

- **Shifts / Payroll** – `/admin/shifts` (and related views)
  - View shifts across employees and locations
  - Filter by date range
  - Edit shifts (adjust clock-in/clock-out times, location)
  - Manually create shifts (for corrections or missed punches)
  - Delete incorrect shifts
  - Export shifts to CSV/Excel via `api/export/shifts`

---

## Important Routes

### Public Pages

- `GET /`  
  Basic landing page (can be customized as needed).

- `GET /clock`  
  Employee-facing clock in/out UI.

### Admin Pages

- `GET /admin/login`  
  Admin login form.

- `GET /admin`  
  Admin dashboard.

- `GET /admin/employees`  
- `GET /admin/locations`  
- `GET /admin/shifts`  
- (Optional) `/admin/payroll` or similar summary views.

### Public API

- `GET /api/locations`  
  Returns the list of **active** locations for the public clock UI.

- `POST /api/clock`  
  Handles employee clock in/out.  
  Expects JSON body:
  ```json
  {
    "employeeCode": "ALI001",
    "pin": "1234",
    "locationId": "location-id",
    "lat": 33.12345,
    "lng": -96.54321
  }

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
