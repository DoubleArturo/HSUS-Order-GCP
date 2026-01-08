# Project Knowledge Map 🗺️

This document serves as an index for the `.project/references/` directory. Use it to quickly locate the source of truth for various domains.

| Knowledge Domain | Key Document | Description / What to look for |
| :--- | :--- | :--- |
| **API Interfaces** | `API_Interface_Reference.md.pdf` | **Request/Response JSON schemas**, Endpoint definitions, Error codes. |
| **System Architecture** | `System_Design_Spec_v2.1.md.pdf` | **GCP Cloud Run/SQL setup**, Database Tables (ERD), Network Topology. |
| **Order Lifecycle** | `System_Design_Spec_v2.1.md.pdf` | State diagrams, status flow logic (Draft -> Confirmed -> Shipped). |
| **Business Context** | `HSUS_Project_Context_Dump_v2.md.pdf` | Project background, business glossary, user personas, legacy constraints. |
| **Legacy AI Rules** | `AI_Cursor_Context_Rules.md.pdf` | *Historical Reference*. For active coding rules, strictly follow `.project/AI_CONTEXT.md`. |

## Usage Guide
*   **Need to validate a JSON response?** -> Check `API_Interface_Reference.md.pdf`.
*   **Refactoring DB schema?** -> Check `System_Design_Spec_v2.1.md.pdf` (Schema Section) and then `src/types/database.ts`.
*   **Unsure about business jargon?** -> Check `HSUS_Project_Context_Dump_v2.md.pdf`.
