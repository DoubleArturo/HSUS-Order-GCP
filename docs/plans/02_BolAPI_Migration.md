# 02_BolAPI_Migration: Expose BolService via REST API

**Goal**: Expose the refactored `BolService` logic to the outside world (specifically Google Sheets) via standard HTTP REST endpoints.

## 1. Context
We have successfully extracted the business logic into `BolService.ts`. Now we need to create the HTTP layer to allow the legacy GAS tool to communicate with this service over the network.

## 2. Architecture & Design

### Controller Layer (`src/controllers/bolController.ts`)
*   **Responsibility**: Parse HTTP requests, call `BolService`, and format responses standardizing on `src/utils/responses.ts`.
*   **Endpoints**:
    1.  `GET /api/bol/initial-data` -> `getInitialBolData`
    2.  `GET /api/bol/:orderNumber` -> `getExistingBolData`
    3.  `POST /api/bol/save` -> `saveBolData`

### Route Layer (`src/routes/bolRoutes.ts`)
*   Define Express Router and map paths to Controller methods.

### App Integration (`src/app.ts`)
*   Import and register `bolRoutes` under `/api/bol`.

## 3. Implementation Steps

### Step 1: Create Controller
**File**: `src/controllers/bolController.ts`
*   Import `BolService`.
*   Import `ok`, `created` from `../utils/responses.js`.
*   Implement `getInitialBolData`, `getExistingBolData`, `saveBolData`.
*   Ensure rigorous error handling (passed to `next(err)`).

### Step 2: Create Routes
**File**: `src/routes/bolRoutes.ts`
*   Setup `express.Router()`.
*   Define GET and POST routes.

### Step 3: Register Routes
**File**: `src/app.ts`
*   `app.use('/api/bol', bolRoutes);`

## 4. Verification Plan

### Manual Verification (curl/Postman)
*   **Start Server**: `npm run dev`
*   **Test 1 (Initial Data)**:
    ```bash
    curl http://localhost:3000/api/bol/initial-data
    ```
*   **Test 2 (Get Order)**:
    ```bash
    curl http://localhost:3000/api/bol/PO-TEST-002
    ```
*   **Test 3 (Save Order)**:
    ```bash
    curl -X POST http://localhost:3000/api/bol/save \
         -H "Content-Type: application/json" \
         -d '{"poSkuKey": "PO-TEST-001", "actShipDate": "2026-01-09", "isFulfilled": true, "bols": [{"bolNumber": "API-TEST-1", "shippedQty": 10}]}'
    ```
