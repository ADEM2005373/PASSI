# Master Development Directive: Passi Ticketing Platform

## Agent Instructions
You are the sole autonomous full-stack developer for the "Passi" web application. You will generate the entire application end-to-end using Next.js (deployed on Vercel) and Supabase (PostgreSQL, Auth, Storage).

This platform must be architected to support a rigorous academic evaluation. Because the four-person team faces a formal presentation, grading, and a technical Q&A on defense day, your output must be optimized for pedagogical clarity. The repository must be extensively commented, highly modular, and logically structured so that every team member can fully understand the entire stack (database, API, frontend) and avoid being siloed into a single block of knowledge.

Do not apply any specific CSS color schemes, visual branding, or design elements to this build. Focus strictly on delivering a fully functional, highly documented component architecture and backend state machine based on the following technical specifications.

### 1. Database Architecture (Supabase SQL)
Initialize the PostgreSQL schema with the following precise structure and relationships. All tables must have Row Level Security (RLS) enabled, with clear inline SQL comments explaining the security policies to ensure the team can defend the database logic.

* **Users/Profiles**: Tied to Supabase Auth.
  * Fields: id (UUID), email, instagram_handle (String, required), role (Enum: admin, user, security, barman), created_at.
* **Events**:
  * Fields: id (UUID), title, date, location, pre_orders_enabled (Boolean), max_passes_per_user (Integer), created_at.
* **Drink_Menus**: Linked to Events.
  * Fields: id (UUID), event_id (UUID, Foreign Key), name, price, image_url (from Supabase Storage), created_at.
* **Passes (The Core Engine)**:
  * Fields: id (UUID), user_id (UUID, Foreign Key), event_id (UUID, Foreign Key), guest_first_name (String, nullable for +1s), guest_last_name (String, nullable), entry_qr_uuid (UUID, unique generator), entry_status (Enum: pending, awaiting_payment, activated, scanned), created_at.
* **Pass_Drinks**: Linked to Passes.
  * Fields: id (UUID), pass_id (UUID, Foreign Key), drink_id (UUID, Foreign Key), drink_qr_uuid (UUID, unique), drink_status (Enum: pending, awaiting_payment, activated, scanned).

### 2. Authentication & Role-Based Access Control
Implement Supabase Auth with custom user metadata, keeping the authentication logic cleanly separated in its own service file for easy explanation during the Q&A.
* Registration Flow: Users must manually input their exact @instagram_handle upon sign-up. The system defaults their role to user.
* Staff Creation: The admin role has a protected dashboard to manually invite or assign security and barman roles to other accounts.
* Route Protection: Use Next.js middleware to strictly enforce access.
  * `/admin/*` is restricted to Admins.
  * `/scanner/security` is restricted to Security and Admins.
  * `/scanner/barman` is restricted to Barmen and Admins.

### 3. The Booking & Payment State Machine
Develop the core transaction loop. There are strictly no online payment integrations. Comment every step of this state machine so the team can accurately trace the data flow during their presentation.
* **Phase 1: The Waitlist (Status -> pending)**
  * A user selects an event, requests passes (providing guest names if buying more than one), and selects drinks if pre_orders_enabled is true.
  * The database writes the Passes and Pass_Drinks rows with the status pending.
* **Phase 2: Instagram Verification (Status -> awaiting_payment)**
  * In the Admin dashboard, the admin views pending requests and clicks the provided Instagram handle (linking externally to instagram.com/[handle]).
  * The Admin clicks "Approve." The database status updates to awaiting_payment. The user's UI updates to instruct them to pay physical cash at a designated location.
* **Phase 3: Cash Activation (Status -> activated)**
  * The user hands cash to the team. The Admin clicks "Paid" on the user's record in the dashboard.
  * The backend triggers the generation of unique UUID strings for entry_qr_uuid and drink_qr_uuid. The status updates to activated.

### 4. Dynamic QR Engine & Live Polling
Build the client-side QR rendering and single-use scanner logic. Never store QR code image files in Supabase Storage.
* **Client Rendering**: When a user logs in and views an activated pass, the frontend component reads the entry_qr_uuid and uses a library like qrcode.react to draw the code on the screen dynamically.
* **Auto-Disappear Polling**: The user's pass component must poll the Supabase database every 3 seconds. If the database status changes from activated to scanned, the component must immediately unmount the QR code and display a "Pass Used" state.

### 5. The Scanner Interface (Security & Barman)
Develop a lightweight, mobile-first web scanner using the html5-qrcode library.
* **Camera Access**: The component must request device camera permissions and parse 2D barcodes continuously.
* **Validation Logic**:
  * When a code is scanned, the scanner sends the UUID to the API.
  * If the UUID exists and its status is activated, the API updates the status to scanned. The scanner UI must flash a massive, full-screen Green success state.
  * If the UUID exists but the status is already scanned (indicating a duplicated screenshot), or if the UUID does not exist, the scanner UI must flash a massive, full-screen Red error state ("DENIED").
* **Role Separation**: The Security scanner API endpoint must only query the Passes table (entry_qr_uuid). The Barman scanner API endpoint must only query the Pass_Drinks table (drink_qr_uuid) and display the associated drink name and quantity on the success screen.

### 6. Immediate Execution Steps
* Initialize the Next.js project and install all required dependencies (@supabase/supabase-js, qrcode.react, html5-qrcode).
* Generate and apply the complete Supabase SQL schema.
* Generate a plain-text ARCHITECTURE_EXPLANATION.md file in the root directory that breaks down how the database, middleware, and state machine interact, written specifically as a study guide to help the team prepare for their technical defense and Q&A.
* Begin scaffolding the core backend logic and frontend components.
