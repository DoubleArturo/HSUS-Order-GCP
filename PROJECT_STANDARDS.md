# GAS Migration Project Standards

This document outlines the standard procedures, naming conventions, and architecture for migrating Google Apps Script (GAS) tools to the GCP Node.js environment.

## 1. Documentation & Planning
All migration work must be planned and documented before implementation.

*   **Location**: `docs/plans/`
*   **Naming Convention**: `{Sequence_Number}_{Tool_Name}_Migration.md`
    *   Example: `01_BolTool_Migration.md`, `02_Inventory_Migration.md`
*   **Content**:
    *   Goal & Context
    *   Proposed Changes (Service, Scripts)
    *   Verification Plan

## 2. Directory Structure & Architecture

### Shared Infrastructure (`src/lib/`)
Reusable infrastructure code (Database, Logging, Utils) belongs here.
*   **Database**: `src/lib/db.ts` (Exports `pool` instance)

### Service Layer (`src/services/`)
Business logic and database interactions must be encapsulated in Service classes.
*   **Naming**: `{ToolName}Service.ts` (PascalCase)
*   **Requirements**:
    *   Stateless static methods or singleton pattern.
    *   **Direct SQL Queries**: Use `pool` from `src/lib/db.ts`.
    *   **Transactions**: Write operations (`save`, `update`) MUST use SQL Transactions (`BEGIN`...`COMMIT`/`ROLLBACK`) to ensure data integrity.

### Test Scripts (`src/scripts/`)
Standalone scripts to verify the functionality of Services.
*   **Naming**: `{Sequence_Number}_Test_{ToolName}.ts`
    *   Example: `01_Test_BolService.ts`
*   **Purpose**: Integration testing.
*   **Requirements**:
    *   Should NOT contain business logic.
    *   Import Service classes and call methods.
    *   Log clear "Success" or "Failure" messages.

## 3. Migration Workflow
1.  **Plan**: Create the migration plan in `docs/plans/`.
2.  **Service**: Create/Update the Service in `src/services/`.
3.  **Test**: Create the test script in `src/scripts/`.
4.  **Verify**: Run the script with `npx tsx src/scripts/...`.
5.  **Refine**: Iterate until logic matches legacy GAS behavior.
