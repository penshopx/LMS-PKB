# E-Course Builder - Platform Pembelajaran Berbasis Kompetensi

## Overview

E-Course Builder is a generic competency-based learning management platform designed for Indonesian organizations. It enables the creation and management of e-courses tied to any competency framework. SMAP and PANCEK are included as sample frameworks, but organizations can create their own custom competency clusters and units.

Key features:
- **Generic Competency Framework**: Create custom competency clusters and units (SMAP & PANCEK as samples)
- **E-Course builder**: 6-step template (Orientation, Context, Microlearning, Practice, Assessment, Reflection)
- **4-Level Progression**: L1 (Awareness) → L2 (Application) → L3 (Mastery) → L4 (Strategic)
- **Evidence-based Assessment**: Track and document competency evidence
- **Competency Passport**: Generate competency documentation for talent decisions
- **Dashboard Analytics**: Heatmap visualization of participant progress with quick access cards
- **Landing Page**: Public landing page at `/` with LMS and LSP feature showcase

**Power Features (Latest):**
- **Global Search**: Real-time search across participants, courses, and competency units (Ctrl+K shortcut) — `GET /api/search?q=...`
- **Notification Center**: Bell icon with badge showing unread notifications, mark read/all-read — `GET /api/notifications`, `PATCH /api/notifications/:id/read`
- **Analytics Page** (`/app/analytics`): Rich recharts visualizations — monthly trend (line), cluster level distribution (bar), course by level (pie), gap analysis (bar), radar chart — `GET /api/analytics`
- **CSV Export**: Export participants list with competency stats to CSV file
- **Page Title Breadcrumb**: Contextual page title shown in the header on all pages

**LMS Features (New):**
- **Learning Paths**: Create learning paths with prerequisites, difficulty levels, and progress tracking
- **Quiz Engine**: Multiple question types (pilihan ganda, benar/salah, esai) with scoring
- **Certificates**: Digital certificate issuance with verification codes

**LSP Certification Features (New):**
- **Assessor Management**: Register assessors with NRA (Nomor Registrasi Asesor) and BNSP certification
- **Assessee Management**: Track assessee registration and assessment status
- **Assessment Methods**: 6 methods - APL, Observasi, Wawancara, Tes Tertulis, Portfolio, Simulasi
- **Competency Schemes**: SKK certification schemes with fees and durations
- **SKKNI Mapping**: Map competencies to Indonesian national standards
- **Assessment Scheduling**: Schedule and track assessment sessions

## Routes

- `/` - Landing page (public) with LMS and LSP feature showcase
- `/app` - Dashboard with competency analytics and quick access cards
- `/app/competencies` - Competency cluster and unit management
- `/app/courses` - E-Course Builder with 6-step template
- `/app/learning-paths` - Learning paths with enrollment and progress tracking
- `/app/quizzes` - Quiz Engine with multiple question types (pilihan ganda, benar/salah, esai)
- `/app/participants` - Participant management
- `/app/passport` - Competency Passport
- `/app/assessment` - LSP Assessment with Assessor, Assessee, Schedule, and Scheme management
- `/app/certificates` - Certificate issuance and verification with unique codes

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state, React useState for local state
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Framework**: Express 5 (ESM modules)
- **Language**: TypeScript with tsx for development
- **API Design**: RESTful JSON API with `/api` prefix
- **Server**: Node.js with HTTP server (supports WebSocket upgrade path)

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Current Storage**: In-memory storage with sample data (PostgreSQL-ready schema)

### Project Structure
```
├── client/src/          # React frontend application
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route definitions
│   └── storage.ts       # Data access layer
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle schema definitions
└── migrations/          # Database migrations (Drizzle Kit)
```

### Key Design Patterns
- **Monorepo structure**: Client, server, and shared code in single repository
- **Type sharing**: Schema types exported from `shared/schema.ts` used by both frontend and backend
- **Component composition**: Shadcn/ui components with Radix primitives
- **API abstraction**: `apiRequest` helper and TanStack Query for data fetching

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations with `npm run db:push`

### UI Framework
- **Radix UI**: Accessible component primitives (dialog, dropdown, tabs, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build and dev server with HMR
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Production bundling for server code

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Runtime error overlay
- **@replit/vite-plugin-cartographer**: Development tooling (dev only)
- **@replit/vite-plugin-dev-banner**: Development banner (dev only)

### Session Management (Available)
- **connect-pg-simple**: PostgreSQL session store (available but not yet implemented)
- **express-session**: Session middleware (available in dependencies)