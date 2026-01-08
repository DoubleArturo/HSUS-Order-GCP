# Current Project Status

## 1. Project Progress
We have successfully completed the migration of the **BOL Entry Tool** (Phase 1).
*   **Backend API**: Fully Refactored & Verified.
*   **Architecture**:
    *   **Service**: `src/services/BolService.ts` (Native SQL + Transactions).
    *   **Testing**: `src/scripts/01_Test_BolService.ts` (Integration Tests).
    *   **Config**: `src/config/db.ts` (Unified DB Pool).

## 2. Backlog
### Missing APIs (vs `API_Interface_Reference.md.pdf`)
*   [ ] Analyze `API_Interface_Reference.md.pdf` to identify gaps.
*   [ ] Implement missing endpoints for Order Management.

### Shipment Management
*   [ ] Implement `ShipmentService` (CRUD for shipments).
*   [ ] Add `02_Shipment_Migration.md` plan.
*   [ ] Support partial shipments logging.

### AppScript Migration
*   [ ] **Inventory Tool**: Migration placeholder.
*   [ ] **Invoicing Tool**: Migration placeholder.
*   [ ] **User Management**: Migration placeholder.
*   [ ] **Reporting**: Migration placeholder.

## 3. Known Issues
*   **DB Migrations**: Currently using manual SQL scripts (`db/migrations/`). Need to establish a robust CLI-based migration workflow (e.g., `node-pg-migrate` or custom script).
*   **Imports**: Recently switched from `src/lib/db.ts` back to `src/config/db.ts`. Verify all new services use the correct path.
