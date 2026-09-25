# Passi Architecture & Study Guide

## 1. System Overview
Passi is a ticketing and event management platform built on **Next.js** (React framework for server-side and client-side rendering) and **Supabase** (PostgreSQL database, authentication, and storage).

This document serves as a pedagogical guide for the project defense. It details how the different layers interact to securely handle passes, staff roles, and the state machine for cash-based transactions.

## 2. The Database Layer (Supabase PostgreSQL)
Supabase acts as our Backend-as-a-Service (BaaS). The core of our data model relies on a few strongly related tables:
* **Users/Profiles**: Stores user metadata (Instagram handle, Role). Tied to Supabase Auth UUIDs.
* **Events & Drink Menus**: Defines the events available and their associated drinks.
* **Passes & Pass_Drinks**: The transactional core. These tables track what users ordered and the status of those orders.

### Row Level Security (RLS)
Security is enforced at the database level using PostgreSQL's Row Level Security (RLS). 
- **Users** can only read their own passes and drink orders.
- **Admins** have full read/write access to all tables.
- **Security** can read/update `Passes` to mark them as scanned.
- **Barmen** can read/update `Pass_Drinks` to mark them as scanned.

## 3. The Authentication & Role Middleware
Supabase handles user authentication. We utilize Next.js Middleware (`middleware.ts`) to intercept every request and check the user's session and role.

### How it works:
1. When a user requests a protected route (e.g., `/admin` or `/scanner`), the middleware verifies the JWT token with Supabase.
2. It fetches the user's role from the `users` table.
3. If the role doesn't match the required permissions for the route, it redirects the user to the `/` (home) or `/unauthorized` page.
This ensures client-side tampering cannot bypass security, as the server always checks the database for truth.

## 4. The Booking & Payment State Machine
Because there are no online payments, Passi relies on a 4-step state machine (`pending` -> `awaiting_payment` -> `activated` -> `scanned`).

* **Phase 1: Pending (The Waitlist)**
  * User requests passes and drinks. Inserted into DB as `pending`.
* **Phase 2: Instagram Verification**
  * Admin verifies the user's Instagram handle to ensure they are a real student/guest.
  * Admin approves the request, updating DB status to `awaiting_payment`.
* **Phase 3: Cash Activation (The Core Transaction)**
  * The user physically pays cash to the team.
  * Admin clicks "Paid" in the dashboard.
  * **Crucial Step**: The backend generates unique UUIDs for `entry_qr_uuid` and `drink_qr_uuid` and sets the status to `activated`. We only generate QR UUIDs *after* payment is received to prevent pre-payment tampering.
* **Phase 4: Scanned**
  * The pass is scanned at the door/bar. Status changes to `scanned`.

## 5. Dynamic QR Engine & Live Polling
We do not store QR codes as image files. This saves database storage and increases security.
* **Generation**: The frontend reads the `entry_qr_uuid` from the database and renders a QR code on the fly using `qrcode.react`.
* **Live Polling**: The user's screen pings the Supabase database every 3 seconds. If security scans the code, the status changes to `scanned` in the database. The user's phone polling detects this change and immediately hides the QR code, replacing it with a "Pass Used" screen. This prevents screenshot sharing.

## 6. The Scanner Interface
The scanner relies on the `html5-qrcode` library.
* It continuously reads the camera feed looking for QR codes.
* When a QR code (which is just a UUID string) is detected, it sends an API request to our Next.js backend.
* The API checks the database for the UUID.
  * **Security Endpoint**: Looks in `Passes`.
  * **Barman Endpoint**: Looks in `Pass_Drinks`.
* If found and `activated`, it marks it `scanned` (returns 200 OK -> Green Screen).
* If already `scanned` or not found, it rejects (returns Error -> Red Screen).

---
*Be prepared to explain how the Middleware protects routes and how the State Machine prevents unauthorized QR code generation during the technical Q&A!*
