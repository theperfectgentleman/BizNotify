# **Project: Termii Communication Hub (TCH) \- Technical Requirements**

## **1\. Executive Summary**

The goal is to build a self-contained web application for managing contacts and executing targeted SMS/WhatsApp campaigns via Termii. The system must support contact segmentation, message scheduling, and real-time delivery tracking using a simplified architecture (Node.js \+ PostgreSQL) without external dependencies like Redis.

## **2\. Core Tech Stack**

* **Backend:** Node.js (Express or Fastify)  
* **Database:** PostgreSQL (Primary storage \+ Task Queue)  
* **Task Queue:** pg-boss (PostgreSQL-based job queue)  
* **Termii Integration:** termii-nodejs  
* **Frontend:** React with Tailwind CSS  
* **Authentication:** JWT-based sessions

## **3\. Database Schema (PostgreSQL)**

A relational structure is required to handle complex grouping and message tracking.

### **3.1 Tables**

* **Users:** id (UUID), email, password\_hash, role (admin/staff), created\_at  
* **Groups:** id (UUID), name, description, parent\_group\_id (for subgroups)  
* **Contacts:** id (UUID), phone\_number (E.164 format), first\_name, last\_name, metadata (JSONB), opt\_out (boolean)  
* **Contact\_Groups:** contact\_id, group\_id (Many-to-Many)  
* **Campaigns:** id (UUID), user\_id, title, message\_body, channel (sms/whatsapp), scheduled\_at, status (draft/queued/processing/completed)  
* **Messages (Tracking):** \- id (UUID)  
  * campaign\_id (foreign key)  
  * contact\_id (foreign key)  
  * termii\_message\_id (string, indexed)  
  * status (queued/sent/delivered/failed/expired)  
  * error\_reason (text)  
  * updated\_at

## **4\. System Logic & Background Processing**

### **4.1 The "No-Redis" Queue Strategy**

To handle mass messaging without timeouts, use **pg-boss**.

1. When a user sends a message to a group of 1,000, the API creates a Campaign record.  
2. The API then creates 1,000 "jobs" in the pg-boss queue.  
3. A background worker (running in the same Node process) picks up these jobs, calls the Termii API, and updates the Messages table with the termii\_message\_id.

### **4.2 Phone Number Normalization**

All incoming numbers (CSV upload or Manual entry) must pass through a normalization utility:

* Strip non-numeric characters.  
* If number starts with 0, replace with country code (e.g., 233).  
* Store in DB in a clean format to prevent API failures.

### **4.3 Webhook Handling (The "Tracker")**

Create a public endpoint: POST /api/webhooks/termii

* Termii sends delivery reports to this URL.  
* Logic: UPDATE messages SET status \= payload.status WHERE termii\_message\_id \= payload.message\_id;

## **5\. API Endpoints**

### **Auth**

* POST /auth/login  
* POST /auth/register (Admin only)

### **Contacts & Groups**

* GET/POST /groups (Manage categories)  
* GET/POST /contacts (CRUD operations)  
* POST /contacts/import (Handle CSV/Excel upload)  
* POST /contacts/bulk-tag (Add multiple contacts to a group)

### **Messaging**

* POST /messages/send (Immediate or Scheduled)  
* GET /messages/stats (Aggregated data: Total sent, delivered, failed)  
* GET /messages/logs (Searchable history)

## **6\. Frontend Requirements (UI/UX)**

1. **Dashboard:** High-level metrics (Delivery rate %, remaining Termii balance).  
2. **Contact Manager:** Table with filtering by Group. Include a "Bulk Upload" button.  
3. **Composer:** \- Textarea with character count (160 chars per SMS unit).  
   * Variable injection: Hello {{first\_name}}.  
   * Toggle between "Send Now" and "Schedule for Later."  
4. **Analytics:** A list of past campaigns with a "Delivery Status" bar (Green for delivered, Red for failed).

## **7\. Implementation Roadmap (Quick Delivery)**

* **Phase 1 (Day 1-2):** DB Setup & Auth. Contact CRUD \+ CSV Import logic.  
* **Phase 2 (Day 3):** Termii Service integration. Set up pg-boss for background processing.  
* **Phase 3 (Day 4):** Webhook endpoint & Stats aggregation logic.  
* **Phase 4 (Day 5):** Frontend Dashboard & Messaging UI.

## **8\. Critical Success Factors**

* **Exponential Backoff:** If Termii API is down, pg-boss should retry the job 3 times before marking as "Failed."  
* **Rate Limiting:** Ensure the worker doesn't exceed Termii's per-second API limit.  
* **Data Integrity:** Use DB Transactions when importing large CSVs to ensure a partial crash doesn't create duplicate contacts.