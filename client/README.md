# EventHub Client

> Modern, responsive Single-Page Application (SPA) built with React 18, Vite 6, Tailwind CSS, and Lucide Icons.

---

## 1. Overview

The EventHub frontend client provides an intuitive, high-performance web portal for two distinct campus user roles:

### Students
- **Event Discovery**: Search published events by keywords (title, description, venue) and filter by category with pagination.
- **Event Details & Registration**: View full event details, capacity metrics, and register individually or as part of a team.
- **Team Invitations**: Manage team invitation requests, view team roster status, and accept or decline invitations.
- **SmartPass Viewer**: Display cryptographically verifiable SmartPass dynamic QR codes issued upon confirmed registration.
- **CampusPass Rewards**: Track earned attendance reward points (+50 points per verified gate check-in) and view profile details.

### Administrators and Gate Staff
- **Event Management**: Create, edit, and cancel campus events with configurable registration types (individual vs. team), team size boundaries (`min_team_size`, `max_team_size`), and venue capacities.
- **Gate Configuration**: Configure and manage physical entry checkpoints per event.
- **SmartPass Gate Scanner**: High-throughput webcam QR scanner powered by `html5-qrcode` with live validation and manual code entry fallback.
- **QueueLess Ingress Monitoring**: Real-time 10-minute ingress throughput velocity analytics and dynamic gate recommendations.

---

## 2. Directory Structure

Every file and directory listed below is present in the `client/` workspace:

```
client/
├── index.html                   # HTML5 document template
├── package.json                 # Frontend dependencies, build scripts & metadata
├── postcss.config.js            # PostCSS configuration for Tailwind CSS
├── tailwind.config.js           # Tailwind theme configuration (Purple palette & fonts)
├── vite.config.js               # Vite 6 build configuration & React plugin setup
└── src/
    ├── main.jsx                 # React DOM entry point
    ├── App.jsx                  # Client-side router & route guard composition
    ├── index.css                # Global stylesheet & Tailwind CSS directives
    ├── api/
    │   └── client.js            # Pre-configured Axios instance with error interceptors
    ├── components/
    │   └── common/
    │       ├── Navbar.jsx       # Global responsive header with live invitation counter badge
    │       ├── Footer.jsx       # Campus footer with copyright and status links
    │       ├── ProtectedRoute.jsx# Role-based route guard wrapper (student vs. admin)
    │       └── StatusPill.jsx   # Consistent status pill badges (active, confirmed, draft, etc.)
    ├── context/
    │   └── AuthContext.jsx      # Authentication session state & user profile provider
    └── pages/
        ├── LandingPage.jsx      # Public landing page with feature cards and quick CTAs
        ├── auth/
        │   ├── LoginPage.jsx    # User authentication for students and administrators
        │   └── RegisterPage.jsx # Student onboarding form with student ID & department
        ├── student/
        │   ├── ExploreEventsPage.jsx   # Discovery catalog with search & category filtering
        │   ├── EventDetailsPage.jsx    # Event details with individual/team registration form
        │   ├── InvitationsPage.jsx     # Team invitation inbox with accept/decline workflows
        │   ├── MyPassesPage.jsx        # Issued SmartPass cards with QR code display
        │   ├── StudentDashboardPage.jsx# Registered events overview and quick actions
        │   └── StudentProfilePage.jsx  # Student profile, department, and reward points
        └── admin/
            ├── AdminDashboardPage.jsx  # Event management console with status filters
            ├── CreateEventPage.jsx     # Event creation wizard (Individual/Team, Gates)
            ├── EditEventPage.jsx       # Event modification & gate configuration
            ├── GateScannerPage.jsx     # Webcam QR scanner with admission validation
            └── QueueLessPage.jsx       # Real-time 10-minute gate throughput analytics
```

---

## 3. Frontend Architecture

### 3.1 HTTP-Only Cookie Authentication
The client does not persist sensitive JWT bearer tokens in `localStorage` or `sessionStorage`, mitigating Cross-Site Scripting (XSS) token theft. The browser automatically manages authentication cookies. The centralized Axios client in `src/api/client.js` is configured with `withCredentials: true`:

```javascript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Guarantees HTTP-only auth cookies are sent on every request
  headers: {
    'Content-Type': 'application/json'
  }
});
```

### 3.2 Standardized Error Interceptor
Axios response interceptors unwrap backend error structures and provide clean, typed error envelopes to UI components:

```javascript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data?.error;
    const message = errorData?.message || error.message || 'An unexpected error occurred';
    const code = errorData?.code || 'UNKNOWN_ERROR';
    
    const enhancedError = new Error(message);
    enhancedError.code = code;
    enhancedError.statusCode = error.response?.status;
    enhancedError.details = errorData?.details || [];
    enhancedError.raw = error.response?.data;
    
    return Promise.reject(enhancedError);
  }
);
```

### 3.3 Role-Based Route Protection (`ProtectedRoute.jsx`)
Client-side routes are guarded based on authentication status and exact user roles (`allowedRole="student"` or `allowedRole="admin"`). Unauthenticated requests redirect to `/login`, while cross-role violations redirect to the user's appropriate portal:

```jsx
// client/src/components/common/ProtectedRoute.jsx
export function ProtectedRoute({ children, allowedRole }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  if (allowedRole && user.role !== allowedRole) {
    if (user.role === 'student' && allowedRole === 'admin') return <Navigate to="/dashboard" replace />;
    if (user.role === 'admin' && allowedRole === 'student') return <Navigate to="/admin" replace />;
  }

  return children;
}
```

### 3.4 Route Mapping (`App.jsx`)

| Path | Access / Role Guard | Component | Description |
|---|:---:|---|---|
| `/` | Public | `LandingPage` | Welcome hero, feature highlights, and call-to-actions |
| `/events` | Public | `ExploreEventsPage` | Discovery catalog with keyword search and category filters |
| `/events/:id` | Public | `EventDetailsPage` | Event information, gate list, and registration actions |
| `/login` | Public | `LoginPage` | Student and admin credential login |
| `/register` | Public | `RegisterPage` | Student registration with campus ID and department |
| `/dashboard` | Student (`allowedRole="student"`) | `StudentDashboardPage` | Overview of registered events and quick navigation |
| `/my-passes` | Student (`allowedRole="student"`) | `MyPassesPage` | Verifiable SmartPass cards with high-density QR codes |
| `/invitations` | Student (`allowedRole="student"`) | `InvitationsPage` | Pending team invitations inbox with accept/decline controls |
| `/profile` | Student (`allowedRole="student"`) | `StudentProfilePage` | User profile, department, and accumulated reward points |
| `/admin` | Admin (`allowedRole="admin"`) | `AdminDashboardPage` | Event management dashboard with search and status filters |
| `/admin/events/new` | Admin (`allowedRole="admin"`) | `CreateEventPage` | Event creation wizard with gate and team configuration |
| `/admin/events/:id/edit`| Admin (`allowedRole="admin"`) | `EditEventPage` | Modify event schedule, venue, capacity, and gates |
| `/admin/scanner` | Admin (`allowedRole="admin"`) | `GateScannerPage` | Webcam QR check-in terminal with manual code fallback |
| `/admin/queueless` | Admin (`allowedRole="admin"`) | `QueueLessPage` | Rolling 10-minute ingress throughput velocity monitor |
| `*` | Catch-all | `<Navigate to="/" replace />` | Redirects unmatched URLs to the landing page |

---

## 4. Key Interactive Workflows

### 4.1 Gate Scanner Terminal (`GateScannerPage.jsx`)
- **Camera Integration**: Initializes `Html5Qrcode` with `{ facingMode: 'environment' }`, frame rate 10 fps, and scanning box dimensions 250×250.
- **Event & Gate Selection**: Fetches published events (`GET /events?limit=50`) and associated gates (`GET /events/:id/gates`), automatically pre-selecting active gates.
- **Idempotency & Replay Defense**: Automatically generates a client-side UUID (`crypto.randomUUID()`) for each scan payload to guarantee check-in idempotency.
- **Backend Verification**: Dispatches scan requests to `POST /api/v1/checkin/scan` with payload `{ eventId, gateId, scanUuid, qrPayload }`.
- **Manual Code Entry Fallback**: Provides a manual text input for gate staff to type or paste QR strings (`EVPASS:v1:<passCode>:<rawToken>`) if the attendee's screen is unreadable.
- **Visual Feedback**:
  - **Approved (Green)**: Displays attendee full name, student ID, department, team name (if applicable), event title, gate name, checked-in timestamp, and "+50 CampusPass Points Awarded" notification.
  - **Rejected (Red)**: Displays the exact error code (e.g., `DUPLICATE_CHECKIN`, `WINDOW_CLOSED`, `GATE_MISMATCH`, `PASS_REVOKED`) and explanatory error message.
  - **One-Click Reset**: "Ready for Next Attendee" clears scan state and re-arms the scanner.

### 4.2 Team Invitation Management (`InvitationsPage.jsx` & `Navbar.jsx`)
- **Inbox Retrieval**: Queries `GET /api/v1/invitations` to list all invitations directed to the authenticated student.
- **Acceptance Flow**: Calls `POST /api/v1/invitations/:id/accept`. If all members have accepted, the team registration transitions to `confirmed`, and the student's individual SmartPass is immediately displayed with quick links to `/my-passes`. If other teammates are still pending, the UI informs the student that the pass will be issued once quorum is reached.
- **Decline Flow**: Calls `POST /api/v1/invitations/:id/decline` following a confirmation prompt. If team size falls below `min_team_size`, the team is cancelled and capacity is freed automatically.
- **Live Navbar Badge**: `Navbar.jsx` polls `GET /api/v1/invitations` upon navigation for authenticated students and renders a purple numeric badge when pending invitations exist.

---

## 5. Technology Stack & Dependencies

All dependencies are declared in [`client/package.json`](file:///Users/shreyali/EventHub/client/package.json):

### Production Dependencies
| Package | Version | Purpose |
|---|---|---|
| `react` | `^18.3.1` | Modern component-based UI framework |
| `react-dom` | `^18.3.1` | React DOM rendering engine |
| `react-router-dom` | `^6.28.0` | Declarative client-side routing and navigation |
| `axios` | `^1.7.9` | Promise-based HTTP client with credentials and interceptors |
| `html5-qrcode` | `^2.3.8` | Cross-platform HTML5 QR and barcode camera scanner |
| `lucide-react` | `^0.468.0` | Comprehensive icon library |

### Development Dependencies
| Package | Version | Purpose |
|---|---|---|
| `vite` | `^6.0.3` | Next-generation frontend build tool and dev server |
| `@vitejs/plugin-react`| `^4.3.4` | Vite plugin for React Fast Refresh and JSX transformation |
| `tailwindcss` | `^3.4.16` | Utility-first CSS framework with purple campus theme |
| `postcss` | `^8.4.49` | CSS transformation pipeline |
| `autoprefixer` | `^10.4.20` | Vendor prefix automation for cross-browser CSS |
| `@types/react` | `^18.3.12` | TypeScript definitions for React |
| `@types/react-dom` | `^18.3.1` | TypeScript definitions for React DOM |

---

## 6. Setup and Execution

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Install Dependencies
```bash
cd client
npm install
```

### Start Development Server
```bash
npm run dev
```
Starts the Vite development server with Hot Module Replacement (HMR) at `http://localhost:5173`.

### Build for Production
```bash
npm run build
```
Executes the Vite production build and outputs the optimized, minified bundle to `client/dist/`.

### Preview Production Build
```bash
npm run preview
```
Spins up a local web server to preview the production build output from `client/dist/`.
