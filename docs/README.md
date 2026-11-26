# EventHub Documentation Index

> Central index and reading guide for the technical specifications, architectural blueprints, and development roadmaps of EventHub.

---

## Documentation Map

| Document | Description | Primary Audience |
|---|---|---|
| [**Root README.md**](file:///Users/shreyali/EventHub/README.md) | High-level project summary, hackathon pitch, installation & test execution guide | Evaluators, Developers, Judges |
| [**Architecture Diagram**](file:///Users/shreyali/EventHub/docs/architecture-diagram.md) | High-resolution Mermaid system architecture diagram & component data flows | Systems Architects, Technical Evaluators |
| [**Architecture Specification**](file:///Users/shreyali/EventHub/docs/architecture.md) | Deep technical architecture v2.2, concurrency protocols & security designs | Backend Engineers, Security Auditors |
| [**REST API Design**](file:///Users/shreyali/EventHub/docs/api-design.md) | Comprehensive RESTful API specifications with full request & response schemas | API Consumers, Frontend Developers |
| [**Development Roadmap**](file:///Users/shreyali/EventHub/docs/development-roadmap.md) | Phase-by-phase implementation tracking and historical milestones | Project Managers, Contributors |
| [**Client README**](file:///Users/shreyali/EventHub/client/README.md) | Frontend React 18, Vite & Tailwind CSS implementation guide | Frontend Engineers |
| [**Server README**](file:///Users/shreyali/EventHub/server/README.md) | Backend Express 4.21, services, crypto & test suite guide | Backend Engineers |
| [**Database README**](file:///Users/shreyali/EventHub/database/README.md) | MySQL 8 schema dictionary, relational integrity & index reference | Database Administrators |

---

## Phase Implementation Status Summary

The table below reflects the verified development status across all project phases:

| Phase | Title | Status | Verification Summary |
|:---:|---|:---:|---|
| **Phase 1** | Foundation & Health API | **Completed** | Express 4 server, MySQL connection pool, health routes verified |
| **Phase 2** | User Authentication & Event Management | **Completed** | Bcrypt (cost 12), HTTP-only JWT cookies, event CRUD (13/13 tests pass) |
| **Phase 3** | Concurrency Registration & SmartPass Engine | **Completed** | Row locks (`FOR UPDATE`), blind SHA-256 storage, QR URLs (14/14 tests pass) |
| **Phase 4** | Online Gate Scanner & QueueLess Engine | **Completed** | Webcam scanner, 60-min window, idempotency, +50 pts ledger (15/15 tests pass) |
| **Phase 5** | Frontend Portal Implementation | **Completed** | React 18 + Vite SPA, Tailwind purple theme, role guards, QR scanner |
| **Phase 6** | Enhanced Event Management & Discovery | **Completed** | Discovery search, category filters, multi-gate management (17/17 tests pass) |
| **Phase 7** | Headcount Team Registration & Invitations | **Completed** | Team creation, invitations, atomic seat reservation, auto-cancel (13/13 tests pass) |
| **Phase 8** | Offline Sync Engine | *Planned* | Asymmetric Ed25519 pass signatures & offline sync |
| **Phase 9** | Automated Badges & Campus Store | *Planned* | Automated badge evaluation daemon & swag store points redemption |
| **Phase 10** | Heatmaps & Native Mobile Client | *Planned* | WebSocket live ingress heatmaps & mobile application |
