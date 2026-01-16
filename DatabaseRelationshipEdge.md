
# **Smart Relationship Edge System – Implementation Plan**

## **Goal**

Implement intelligent, semantic relationship edges between tables that visually and logically represent database relationships (similar to MySQL Workbench), including automatic foreign key creation, full customization, and synchronization with SQL.

---

## **Phase 1: Relationship Edge Foundations (Visual Layer)**

### Objectives

Build a custom, intelligent edge that visually represents database relationships.

### Tasks

* Create a custom React Flow edge: `DatabaseRelationshipEdge`
* Implement **orthogonal (right-angle) routing**
* Prevent edges from crossing tables whenever possible
* Support edge states:

  * Default
  * Hover
  * Selected
* Add interaction support:

  * Click to select
  * Delete via context menu or `Delete` key

### Visual Features

* Solid line (Identifying relationship)
* Dashed line (Non-identifying relationship)
* Custom stroke width and color per relationship type

---

## **Phase 2: Crow’s Foot Notation & Cardinality System**

### Objectives

Visually encode relationship semantics using Crow’s Foot notation.

### Tasks

* Implement custom SVG markers:

  * One (`|`)
  * Many (Crow’s Foot)
  * Optional (`O`)
* Support relationship cardinalities:

  * One-to-One
  * One-to-Many
  * Many-to-Many
* Allow cardinality selection via toolbar or property panel
* Dynamically update edge markers when cardinality changes

---

## **Phase 3: Smart Connection Logic & Automatic Foreign Key Creation**

### Objectives

Make relationships semantically aware and schema-driven.

### Tasks

* On edge creation (`onConnect`):

  1. Detect source (parent) and target (child) tables
  2. Detect primary key in the source table
  3. Check if a matching foreign key already exists in the target table
* If no FK exists:

  * Automatically create a foreign key column
  * Infer column name (`<parent_table>_id`)
  * Match data type with referenced primary key
* Mark the column as:

  * Foreign Key
  * Indexed (recommended)
* Store relationship metadata internally (source PK → target FK)

---

## **Phase 4: Path Customization & Smart Rerouting**

### Objectives

Give users full control over edge paths without losing automation.

### Tasks

* Allow users to add and move **waypoints** on edges
* Enable manual path adjustments to avoid visual clutter
* Implement automatic re-routing:

  * When tables are moved
  * When diagram layout changes
* Provide a “Reset Route” option to recompute optimal paths

---

## **Phase 5: Relationship Management & Deletion Logic**

### Objectives

Ensure safe and consistent relationship removal.

### Tasks

* On edge deletion:

  * Prompt user:

    * Remove relationship only
    * Remove relationship + foreign key column
* Update:

  * Diagram state
  * Internal schema model
  * SQL output
* Support temporary disabling of relationships (without deletion)

---

## **Phase 6: SQL Synchronization (Forward Engineering)**

### Objectives

Ensure all visual relationships are reflected in generated SQL.

### Tasks

* Generate SQL constraints on relationship creation:

  ```sql
  CONSTRAINT fk_orders_user
  FOREIGN KEY (user_id) REFERENCES users(id)
  ```
* Support:

  * Inline FK definitions
  * `ALTER TABLE` constraint generation
* Keep SQL synchronized in real time with diagram changes
* Allow partial SQL generation for selected tables or relationships

---

## **Phase 7: Reverse Engineering Support (SQL → Diagram)**

### Objectives

Rebuild relationship edges from imported SQL files.

### Tasks

* Parse `FOREIGN KEY` constraints from SQL
* Identify:

  * Source table
  * Target table
  * Referenced columns
* Automatically reconstruct:

  * Relationship edges
  * Cardinality
  * Identifying vs non-identifying relationships
* Highlight unresolved or broken references

---

## **Phase 8: Validation, Intelligence & Recommendations**

### Objectives

Prevent schema design mistakes and suggest improvements.

### Tasks

* Validate:

  * Foreign keys without primary keys
  * Circular dependencies
  * Invalid or missing references
* Show inline warnings on edges
* Suggest:

  * Index creation on foreign keys
  * Normalization improvements
  * Naming convention fixes

---

## **Phase 9: Performance & Large Diagram Optimization**

### Objectives

Maintain usability with large schemas.

### Tasks

* Optimize edge rendering for 100+ tables
* Lazy render off-screen relationships
* Group relationships visually when zoomed out
* Minimap edge simplification for overview mode

---

## **Phase 10: UX Polishing & Professional Tooling**

### Objectives

Match or exceed MySQL Workbench usability.

### Tasks

* Toolbar for relationship creation modes
* Keyboard shortcuts:

  * Delete relationship
  * Toggle identifying / non-identifying
* Property panel for fine-grained relationship editing
* Undo / Redo support for all relationship operations

---

## **Final Outcome**

By completing these phases, the system will:

* Behave like a true **database modeling engine**
* Automatically manage foreign keys and constraints
* Maintain full synchronization between **visual ERD and SQL**
* Provide professional-grade control similar to (or better than) MySQL Workbench
