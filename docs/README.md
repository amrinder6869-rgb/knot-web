# Knot - Knowledge Base

NODE Kollective Inc. | August 2026 | Confidential

This folder is the primary reference for everyone working on Knot. Start here. Each document has a single purpose. Read the one that answers your question.

---

## Documents

| Document | Purpose | Read when you need to know |
|---|---|---|
| [01 Product Overview](./01_product_overview.md) | What Knot is, core principles, all current features, monetisation model, sprint queue, longer horizon. | What the product does. What is built. What is coming. |
| [02 Technical Architecture](./02_technical_architecture.md) | Tech stack, database schema, foundational architecture principles, hangout object, atomic RPC pattern, planning assistant contract, card state system, security architecture. | How the system is built and why it is built that way. |
| [03 Project Status Report](./03_project_status.md) | Complete list of shipped features, current active sprint and its verification checklist, known issues, deferred items, test environment reference. | What the current state of the codebase is right now. |
| [04 Development Standards](./04_development_standards.md) | Engineering protocols. Database migrations, SECURITY DEFINER functions, file editing on Windows, sprint protocol, Cursor handoff pattern, Stripe and payment rules, Google Places API rules. | How to do engineering work on this codebase correctly. |
| [05 Operations and Troubleshooting](./05_operations_troubleshooting.md) | Environment reference, all environment variables, local setup, deployment, database operations, known failure patterns with causes and fixes, cron jobs, supplementary document index. | How to set up, deploy, and fix things when they break. |
| [06 Product and Design Standards](./06_product_design_standards.md) | Brand identity, voice rules, complete copy system with all constants, emoji policy, icon system with size constants, colour token system, planning assistant tone rules, composer interaction standards. | How to write copy, build UI, and make design decisions that match the existing product. |

---

## How to use this knowledge base

**For a new team member:** read Document 01 first, then Document 02, then Document 03. You now know what the product is, how it is built, and where it currently stands.

**For a developer picking up a task:** check Document 03 for current state, Document 02 for the relevant architecture, and Document 04 for the protocol that governs how you do the work.

**For writing copy or building UI:** Document 06 is the source of truth. Every string, every icon, every colour decision is governed by that document.

**For debugging a problem:** Document 05 has the failure patterns and fixes. If your problem is not listed there, check Document 03 for known issues.

**For an AI working on this codebase:** read all six documents before producing any output. Document 06 in particular must be read before writing any user-facing strings or building any UI components.

---

## Supplementary documents

These documents are archived reference material. The six primary documents above supersede them for all current-state questions. The supplementary documents contain historical context, full detail on specific topics, and the product vision for features not yet built.

- `Knot_Product_Definition.docx`: full product vision including unbuilt features.
- `Knot_Composer_Architecture_Handoff.docx`: complete composer architecture session from August 2026. Full 51-scenario validation set, chip system specification, agent contract detail, and ComposerStatePayload specification.
- `Knot_Fix_Plan.docx`: source-code review from June 2026. Open issues are captured in Document 03.
- `Knot_Cost_Model_v1_July2026.docx`: full 24-month infrastructure cost model.
- `Knot_Revenue_Opportunities_2026.docx`: full revenue opportunity map across all ten revenue types.

---

*NODE Kollective Inc. | Knot Knowledge Base | August 2026 | Confidential*
