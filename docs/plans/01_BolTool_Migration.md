# Phase 3: Service Extraction & Transactional Save

This plan covers the refactoring of the migration script into a dedicated service `BolService.ts` and implementing the `saveBolData` logic using a database transaction.

## User Review Required

> [!NOTE]
> `saveBolData` will perform a full replacement of shipments for a given order (Delete All + Insert New).
> Order status mapping:
> - `isFulfilled: true` -> `SHIPPED`
> - `isFulfilled: false` -> `CONFIRMED`

## Proposed Changes

### Service Creation

#### [NEW] [src/services/BolService.ts](file:///Users/doubleapro/Projects/HSUS-Order-Status-GCP/src/services/BolService.ts)
-   **Imports**: `pool` from `../config/db.js`.
-   **Interfaces**: `Order`, `Shipment`, `BolDataPayload`.
-   **Methods**:
    -   `getInitialBolData()`: (Existing logic)
    -   `getExistingBolData(orderNumber)`: (Existing logic)
    -   `saveBolData(data)`:
        -   Start Transaction (`BEGIN`).
        -   Get `order_id` from `order_number`.
        -   `DELETE FROM shipments WHERE order_id = ...`.
        -   Loop through `data.bols` and `INSERT INTO shipments`.
            -   `tracking_number` <- `bol.bolNumber`
            -   `shipped_at` <- `data.actShipDate`
            -   `items` <- `[{ qty: bol.shippedQty }]`
        -   Update `orders` status based on `data.isFulfilled`.
        -   `COMMIT`.
        -   On Error: `ROLLBACK`.

### Test Script Update

#### [MODIFY] [src/scripts/migration-test.ts](file:///Users/doubleapro/Projects/HSUS-Order-Status-GCP/src/scripts/migration-test.ts)
-   Remove inline logic.
-   Import `BolService`.
-   Add **Test 3**: `saveBolData`.
    -   Target: `PO-TEST-001` (Currently Pending/Confirmed).
    -   Action: Save with `isFulfilled: true`, `actShipDate: '2023-10-01'`, `bols: [{ bolNumber: 'TRACK-123', shippedQty: 10 }]`.
    -   Verification: Call `getExistingBolData('PO-TEST-001')` and check results.

## Verification Plan

### Automated Tests
Run the script:
```bash
npx tsx src/scripts/migration-test.ts
```

-   **Success Criteria**:
    -   `getInitialBolData` works as before.
    -   `getExistingBolData` works as before.
    -   `saveBolData` returns success.
    -   `PO-TEST-001` status changes to `SHIPPED` (Fulfilled).
    -   `PO-TEST-001` has 1 shipment record.
