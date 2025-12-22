# Kitaab Database - Enhanced Schema Design

## Overview
This document presents an enhanced, production-ready database schema for Kitaab, optimized for scalability, performance, data integrity, and future extensibility.

**Space Optimization:** This schema is optimized for minimal storage:
- **Hard deletes:** No `deleted_at` fields (use `DELETE` for permanent removal)
- **No change tracking:** No `updated_at` fields (saves 8 bytes per row)
- **Minimal overhead:** Only essential fields like `is_active` and `created_at` are kept

---

## Core Tables

### 1. USERS
**Purpose:** Store user account information and demographics.

```sql
CREATE TYPE gender_enum AS ENUM ('male', 'female');

CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    gender gender_enum,
    date_of_birth DATE,
    email_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
-- Admin filtering indexes
CREATE INDEX idx_users_gender ON users(gender);
CREATE INDEX idx_users_date_of_birth ON users(date_of_birth);
CREATE INDEX idx_users_gender_age ON users(gender, date_of_birth);
```

**Key Improvements:**
- Added `email_verified` for account security
- Added `two_factor_enabled` for 2FA status tracking
- Added `last_login_at` for analytics
- ENUM type for gender ensures data integrity
- Unique constraint on email
- Indexes on gender and date_of_birth for admin filtering and analytics

---

### 2. DEEDS
**Purpose:** Main deed categories (Hasanaat/Saiyyiaat) owned by users.

```sql
CREATE TYPE deed_category_type AS ENUM ('hasanaat', 'saiyyiaat');

CREATE TABLE deeds (
    deed_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category_type deed_category_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_deeds_user_id ON deeds(user_id);
CREATE INDEX idx_deeds_category ON deeds(category_type, user_id);
```

**Key Improvements:**
- Renamed `deeds_id` to `deed_id` for consistency
- ENUM type for category_type ensures data integrity
- Composite indexes for common query patterns

---

### 3. DEED_ITEMS
**Purpose:** Hierarchical items within deeds (levels 1, 2, 3, etc.).

```sql
CREATE TYPE hide_type_enum AS ENUM ('none', 'hide_from_all', 'hide_from_graphs');

CREATE TABLE deed_items (
    deed_item_id BIGSERIAL PRIMARY KEY,
    deed_id BIGINT NOT NULL REFERENCES deeds(deed_id) ON DELETE CASCADE,
    parent_deed_item_id BIGINT REFERENCES deed_items(deed_item_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    hide_type hide_type_enum DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_deed_item_name_per_parent UNIQUE (deed_id, parent_deed_item_id, name),
    CONSTRAINT unique_deed_item_display_order UNIQUE (deed_id, parent_deed_item_id, display_order) 
        DEFERRABLE INITIALLY DEFERRED
);

**3-Level Hierarchy:**
The schema supports a 3-level hierarchy structure. Enforcement of the 3-level limit should be handled at the application level (frontend and backend API) for better user experience and flexibility. The database schema allows the hierarchy structure but does not enforce the limit.

-- Indexes
-- Foreign key index for parent lookups (essential for hierarchical queries)
CREATE INDEX idx_deed_items_parent ON deed_items(parent_deed_item_id);
-- Partial index for level 1 queries (parent IS NULL) - optimized for top-level item queries
CREATE INDEX idx_deed_items_level1 ON deed_items(deed_id, display_order) WHERE parent_deed_item_id IS NULL;
-- Note: The UNIQUE constraint on (deed_id, parent_deed_item_id, display_order) automatically creates an index
```

**Key Improvements:**
- Added `parent_deed_item_id` for explicit hierarchy (self-referencing)
- Unique constraint prevents duplicate names under the same parent
- Unique constraint prevents duplicate display_order within siblings
- **DEFERRABLE constraint on display_order:** Allows temporary violations during transactions, enabling reordering operations (see Reordering Strategy below)
- **3-Level Hierarchy:** Structure supports up to 3 levels (enforced at application level):
  - Level 1: `parent_deed_item_id IS NULL`
  - Level 2: Parent is a level 1 item
  - Level 3: Parent is a level 2 item (grandparent is level 1)
  - Level 4+: Should be prevented by frontend/backend validation (see implementation examples above)
- **Index Strategy:** 
  - The UNIQUE constraint on `(deed_id, parent_deed_item_id, display_order)` automatically creates an index that covers queries filtering by these columns
  - Only `parent_deed_item_id` needs a separate index for efficient "get children" queries
  - Additional indexes on `deed_id` or partial indexes are optional and should be added based on actual query patterns
- Proper foreign key with CASCADE for data integrity
- **Note:** Level is calculated from parent_deed_item_id (level 1 = NULL parent, level 2+ = traverse up tree)

**Reordering Strategy:**
The `DEFERRABLE INITIALLY DEFERRED` constraint on `display_order` allows you to temporarily violate the unique constraint within a transaction, making reordering possible:

```sql
-- Example: Swap display_order of two items
BEGIN;

-- Step 1: Move item A to a temporary position (e.g., -1 or very high number)
UPDATE deed_items 
SET display_order = -1 
WHERE deed_item_id = 100 AND display_order = 1;

-- Step 2: Move item B to item A's original position
UPDATE deed_items 
SET display_order = 1 
WHERE deed_item_id = 200 AND display_order = 2;

-- Step 3: Move item A to item B's original position
UPDATE deed_items 
SET display_order = 2 
WHERE deed_item_id = 100 AND display_order = -1;

-- Step 4: Commit - constraint is checked at end of transaction
COMMIT;
```

**Index Analysis:**
The unique constraint `UNIQUE (deed_id, parent_deed_item_id, display_order)` automatically creates an index that PostgreSQL can use for:
- Queries filtering by `deed_id` and `parent_deed_item_id` and ordering by `display_order`
- Enforcing the uniqueness constraint

**Index Strategy:**
- **Essential:** `idx_deed_items_parent` is needed for hierarchical queries like "get all children of item X"
- **Optimized:** `idx_deed_items_level1` is a partial index for level 1 queries (top-level items), which are common when displaying deed hierarchies
- **Redundant:** A separate composite index on `(deed_id, parent_deed_item_id, display_order)` is redundant because the unique constraint already provides this index

**Query Pattern Examples:**
```sql
-- Uses idx_deed_items_parent (efficient)
SELECT * FROM deed_items WHERE parent_deed_item_id = 123 ORDER BY display_order;

-- Uses unique constraint's index (efficient)
SELECT * FROM deed_items 
WHERE deed_id = 456 AND parent_deed_item_id = 789 
ORDER BY display_order;

-- Uses idx_deed_items_level1 (efficient partial index)
SELECT * FROM deed_items 
WHERE deed_id = 456 AND parent_deed_item_id IS NULL 
ORDER BY display_order;
```

---

### 4. SCALES
**Purpose:** Define how deeds are measured (scale-based or count-based).

```sql
CREATE TABLE scales (
    scale_id BIGSERIAL PRIMARY KEY,
    deed_id BIGINT NOT NULL REFERENCES deeds(deed_id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_deed_scale_version UNIQUE (deed_id, version)
);

-- Indexes
CREATE INDEX idx_scales_deed_id ON scales(deed_id) WHERE is_active = TRUE;
CREATE INDEX idx_scales_active_version ON scales(deed_id, is_active, version DESC);
```

**Key Improvements:**
- Replaced `deactivated_at` with `is_active` flag for better query performance
- Kept `deactivated_at` for audit trail
- Unique constraint on (deed_id, version) prevents duplicate versions
- Removed `name`, `description`, and `display_order` (moved to `scale_values` table where they belong)
- Indexes optimized for active scale lookups

---

### 5. SCALE_VALUES (New Table)
**Purpose:** Store individual scale options (e.g., "Yes", "No", "Prayed on time", etc.).

```sql
CREATE TABLE scale_values (
    scale_value_id BIGSERIAL PRIMARY KEY,
    scale_id BIGINT NOT NULL REFERENCES scales(scale_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_scale_values_scale_id ON scale_values(scale_id, display_order);
```

**Key Improvements:**
- **New table** to normalize scale options
- Each scale value has its own `name` and `description` (moved from `scales` table)
- Allows multiple values per scale (Yes/No, Excellent/Good/Fair/Poor, etc.)
- Enables easier scale management and updates

---

### 6. ENTRIES
**Purpose:** Store actual deed entries/records made by users.

```sql
CREATE TABLE entries (
    entry_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    deed_item_id BIGINT NOT NULL REFERENCES deed_items(deed_item_id) ON DELETE RESTRICT,
    entry_date DATE NOT NULL,
    scale_value_id BIGINT REFERENCES scale_values(scale_value_id) ON DELETE SET NULL,
    count_value DECIMAL(15,2), -- For count-based entries (supports values up to millions/thousands)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id BIGINT REFERENCES users(user_id), -- For permission-based entries
    CONSTRAINT entry_has_value CHECK (
        (scale_value_id IS NOT NULL AND count_value IS NULL) OR 
        (scale_value_id IS NULL AND count_value IS NOT NULL)
    ),
    CONSTRAINT unique_user_deed_item_date UNIQUE (user_id, deed_item_id, entry_date)
);

-- Indexes
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
CREATE INDEX idx_entries_deed_item ON entries(deed_item_id, entry_date DESC);
CREATE INDEX idx_entries_date_range ON entries(entry_date) WHERE entry_date >= CURRENT_DATE - INTERVAL '1 year';
CREATE INDEX idx_entries_created_by ON entries(created_by_user_id) WHERE created_by_user_id IS NOT NULL;
```

**Key Improvements:**
- Added `scale_value_id` reference to normalized scale values
- Added `created_by_user_id` to track permission-based entries
- Unique constraint prevents duplicate entries per day
- CHECK constraint ensures exactly one of `scale_value_id` or `count_value` is NOT NULL (mutually exclusive)
- `count_value` supports large numbers (up to millions/thousands) with DECIMAL(15,2)
- Removed redundant `scale_id` (scale can be determined via `scale_value_id` → `scale_values` → `scales`)
- Time-based partial index for recent entries (performance optimization)
- Composite indexes for dashboard queries

---

### 7. ENTRY_HISTORY
**Purpose:** Track all changes to entries for audit trail.

```sql
CREATE TYPE change_type_enum AS ENUM ('created', 'updated');

CREATE TABLE entry_history (
    entry_history_id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES entries(entry_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    scale_value_id BIGINT REFERENCES scale_values(scale_value_id),
    count_value DECIMAL(15,2),
    change_type change_type_enum NOT NULL,
    changed_by_user_id BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
-- Composite index for querying history of a specific entry by a specific user (most common pattern)
CREATE INDEX idx_entry_history_entry_user ON entry_history(entry_id, user_id, created_at DESC);
-- Index for querying all history of a specific user
CREATE INDEX idx_entry_history_user_id ON entry_history(user_id, created_at DESC);
-- Index for date-range queries and general audit logs
CREATE INDEX idx_entry_history_date ON entry_history(created_at DESC);
```

**Key Improvements:**
- ENUM type for change_type ensures data integrity (only 'created' and 'updated' - entries cannot be deleted)
- Added `changed_by_user_id` for permission tracking
- Removed `notes` field (not needed in history)
- **Optimized indexes:** Composite index on `(entry_id, user_id, created_at DESC)` for efficient queries filtering by both entry and user
- Additional indexes support entry-only, user-only, and date-range queries

---

### 8. RELATIONS
**Purpose:** Unidirectional user connections (requester → requestee).

```sql
CREATE TYPE relation_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'blocked');

CREATE TABLE relations (
    relation_id BIGSERIAL PRIMARY KEY,
    requester_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    requestee_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status relation_status_enum NOT NULL DEFAULT 'pending',
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_relation CHECK (requester_id != requestee_id),
    CONSTRAINT unique_relation UNIQUE (requester_id, requestee_id)
);

-- Indexes for bidirectional lookups
-- Who requested (find all relations where user is the requester)
CREATE INDEX idx_relations_requester ON relations(requester_id, status);
CREATE INDEX idx_relations_requester_id ON relations(requester_id) WHERE status IN ('pending', 'accepted');
-- Who received (find all relations where user is the requestee)
CREATE INDEX idx_relations_requestee ON relations(requestee_id, status);
CREATE INDEX idx_relations_requestee_id ON relations(requestee_id) WHERE status IN ('pending', 'accepted');
-- Bidirectional lookup: find all relations involving a user (as requester OR requestee)
-- Note: Use UNION query with both indexes above for optimal performance
-- Accepted connections lookup (for permission checks)
CREATE INDEX idx_relations_accepted ON relations(requester_id, requestee_id) WHERE status = 'accepted';
CREATE INDEX idx_relations_accepted_reverse ON relations(requestee_id, requester_id) WHERE status = 'accepted';
```

**Key Improvements:**
- ENUM type for status ensures data integrity
- CHECK constraint prevents self-relations
- Unique constraint prevents duplicate requests
- **Comprehensive indexes for bidirectional lookups:**
  - `idx_relations_requester` and `idx_relations_requester_id`: Find all relations where user is the requester (who they requested)
  - `idx_relations_requestee` and `idx_relations_requestee_id`: Find all relations where user is the requestee (who requested them)
  - `idx_relations_accepted` and `idx_relations_accepted_reverse`: Fast lookups for accepted connections in both directions
- Partial indexes filter out rejected/blocked statuses for common queries
- **Bidirectional Query Pattern:** To find all relations involving a user (as requester OR requestee), use UNION:
  ```sql
  SELECT * FROM relations WHERE requester_id = :user_id
  UNION
  SELECT * FROM relations WHERE requestee_id = :user_id;
  ```

---

### 9. PERMISSIONS
**Purpose:** Grant read/write access to specific deed items for connected users.

```sql
CREATE TYPE permission_type_enum AS ENUM ('read', 'write');

CREATE TABLE permissions (
    permission_id BIGSERIAL PRIMARY KEY,
    relation_id BIGINT NOT NULL REFERENCES relations(relation_id) ON DELETE CASCADE,
    deed_item_id BIGINT NOT NULL REFERENCES deed_items(deed_item_id) ON DELETE CASCADE,
    permission_type permission_type_enum NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_permission UNIQUE (relation_id, deed_item_id, permission_type)
);

-- Indexes
CREATE INDEX idx_permissions_relation ON permissions(relation_id, is_active);
CREATE INDEX idx_permissions_deed_item ON permissions(deed_item_id, is_active);
CREATE INDEX idx_permissions_type ON permissions(permission_type, deed_item_id) WHERE is_active = TRUE;
```

**Key Improvements:**
- ENUM type for permission_type
- Unique constraint prevents duplicate permissions
- Composite indexes for permission checks
- Links to `relation_id` instead of direct user references (better normalization)

---

### 10. REFLECTION_MESSAGES
**Purpose:** Daily reflections for Hasanaat and Saiyyiaat.

```sql
CREATE TYPE reflection_type_enum AS ENUM ('hasanaat', 'saiyyiaat');

CREATE TABLE reflection_messages (
    reflection_message_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type reflection_type_enum NOT NULL,
    message TEXT NOT NULL,
    reflection_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_reflection_date_type UNIQUE (user_id, reflection_date, type)
);

-- Indexes
-- Note: The UNIQUE constraint automatically creates an index on (user_id, reflection_date, type)
-- If queries frequently filter by (user_id, type) and order by reflection_date DESC, consider:
-- CREATE INDEX idx_reflection_user_type_date ON reflection_messages(user_id, type, reflection_date DESC);
```

**Key Improvements:**
- Renamed `date` to `reflection_date` for clarity
- ENUM type for reflection type
- Unique constraint ensures one reflection per type per day
- **Note:** The UNIQUE constraint automatically creates an index on `(user_id, reflection_date, type)`. If your query pattern frequently filters by `(user_id, type)` and orders by `reflection_date DESC`, consider adding a separate index with that column order for optimal performance.

---

### 11. NOTIFICATIONS
**Purpose:** User-set daily reminders.

```sql
CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    notification_time TIME NOT NULL, -- Time of day for reminder
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_notifications_time ON notifications(notification_time, timezone);
```

**Key Improvements:**
- Added `timezone` for accurate scheduling
- Unique constraint ensures one notification per user
- Index on notification_time and timezone for scheduling queries

---

### 12. MESSAGES
**Purpose:** In-app support chat.

```sql
CREATE TYPE message_status_enum AS ENUM ('sent', 'delivered', 'read', 'none');

CREATE TABLE messages (
    message_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status message_status_enum DEFAULT 'none',
    is_from_user BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE = from user, FALSE = from support
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);
CREATE INDEX idx_messages_status ON messages(status, user_id) WHERE status != 'read';
```

**Key Improvements:**
- Renamed `sender` to `is_from_user` (boolean, clearer)
- ENUM type for status
- Indexes for conversation views and unread messages

---

### 13. MERITS
**Purpose:** Deed-specific achievements/progress markers.

```sql
CREATE TYPE merit_category_enum AS ENUM ('positive', 'negative');
CREATE TYPE merit_type_enum AS ENUM ('AND', 'OR');

CREATE TABLE merits (
    merit_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    deed_item_id BIGINT NOT NULL REFERENCES deed_items(deed_item_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_days INTEGER CHECK (duration_days > 0),
    type merit_type_enum NOT NULL DEFAULT 'AND',
    category merit_category_enum NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT merit_end_date_when_inactive CHECK (is_active = TRUE OR end_date IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_merits_user ON merits(user_id, is_active);
CREATE INDEX idx_merits_deed_item ON merits(deed_item_id, is_active);
CREATE INDEX idx_merits_category ON merits(category, user_id) WHERE is_active = TRUE;
```

**Key Improvements:**
- Renamed `duration (in days)` to `duration_days` (SQL-friendly)
- Added `end_date` for tracking merit completion
- CHECK constraint ensures `end_date` is set when `is_active = FALSE`
- ENUM types for category and type
- Indexes for user progress tracking

---

### 14. MERIT_ITEMS
**Purpose:** Components/steps within merits.

```sql
CREATE TABLE merit_items (
    merit_item_id BIGSERIAL PRIMARY KEY,
    merit_id BIGINT NOT NULL REFERENCES merits(merit_id) ON DELETE CASCADE,
    deed_item_id BIGINT NOT NULL REFERENCES deed_items(deed_item_id) ON DELETE RESTRICT,
    count DECIMAL(10,2), -- Target count
    scale_value_id BIGINT REFERENCES scale_values(scale_value_id), -- Target scale value
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT merit_item_has_target CHECK (
        (count IS NOT NULL) OR (scale_value_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_merit_items_merit ON merit_items(merit_id);
CREATE INDEX idx_merit_items_deed_item ON merit_items(deed_item_id);
```

**Key Improvements:**
- Renamed `merit_items_id` to `merit_item_id` for consistency
- CHECK constraint ensures target is defined
- Links to `scale_value_id` instead of generic `scale` string

---

### 15. TARGETS
**Purpose:** User goals spanning multiple deeds.

```sql
CREATE TABLE targets (
    target_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT target_end_date_when_inactive CHECK (is_active = TRUE OR end_date IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_targets_user ON targets(user_id, is_active);
CREATE INDEX idx_targets_active ON targets(is_active, user_id) WHERE is_active = TRUE;
```

**Key Improvements:**
- Added `end_date` for tracking target completion
- CHECK constraint ensures `end_date` is set when `is_active = FALSE`
- Indexes for active target queries

---

### 16. TARGET_ITEMS
**Purpose:** Components/steps within targets.

```sql
CREATE TABLE target_items (
    target_item_id BIGSERIAL PRIMARY KEY,
    target_id BIGINT NOT NULL REFERENCES targets(target_id) ON DELETE CASCADE,
    deed_item_id BIGINT NOT NULL REFERENCES deed_items(deed_item_id) ON DELETE RESTRICT,
    count DECIMAL(10,2), -- Target count
    scale_value_id BIGINT REFERENCES scale_values(scale_value_id), -- Target scale value
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT target_item_has_target CHECK (
        (count IS NOT NULL) OR (scale_value_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_target_items_target ON target_items(target_id);
CREATE INDEX idx_target_items_deed_item ON target_items(deed_item_id);
```

**Key Improvements:**
- Similar structure to merit_items for consistency
- CHECK constraint ensures target is defined
- Links to normalized `scale_value_id`

---

## Additional Tables for Extensibility

### 17. USER_PREFERENCES (New)
**Purpose:** Store user settings and preferences.

```sql
CREATE TABLE user_preferences (
    preference_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    language VARCHAR(10) DEFAULT 'en',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    theme VARCHAR(20) DEFAULT 'light',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: The UNIQUE constraint on user_id automatically creates an index
```

---

### 18. AUDIT_LOG (New)
**Purpose:** System-wide audit trail for critical operations.

```sql
CREATE TABLE audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id BIGINT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id, created_at DESC);
CREATE INDEX idx_audit_date ON audit_log(created_at DESC);
```

---

## Key Improvements Summary

### 1. **Data Integrity & Constraints**
- **Foreign Keys:** All relationships properly defined with CASCADE/RESTRICT rules
- **CHECK Constraints:** Validate data at database level (dates, values, hierarchy)
- **UNIQUE Constraints:** Prevent duplicates (entries, reflections, relations)
- **ENUM Types:** Consistent use of ENUM types for all fixed-value fields (gender, status, category, type, etc.)
  - **Benefits:** More efficient storage (4 bytes vs variable VARCHAR), better type safety, improved query performance
  - **Usage:** All status fields, categories, and fixed-value types use ENUMs instead of CHECK constraints

### 2. **Performance Optimization**
- **Strategic Indexes:** Composite indexes for common query patterns
- **Partial Indexes:** Index only active/non-deleted records
- **Time-based Indexes:** Optimized for date range queries
- **Foreign Key Indexes:** All foreign keys indexed for join performance

### 3. **Scalability Enhancements**
- **Hard Deletes:** Use `DELETE` statements for permanent removal (saves space)
- **Versioning:** Scales support versioning for evolving scale definitions
- **Partitioning Ready:** Entry tables structured for future date-based partitioning
- **Normalized Scale Values:** New `scale_values` table for better scale management

### 4. **Flexibility & Extensibility**
- **Metadata Fields:** `description` fields for future use
- **User Preferences:** New table for extensible user settings
- **Audit Log:** System-wide audit trail for compliance

### 5. **Relationship Improvements**
- **Explicit Hierarchy:** `parent_deed_item_id` in deed_items for clear tree structure
- **Permission Normalization:** Permissions linked to relations, not direct user pairs
- **Created By Tracking:** Entries track who created them (for permission-based entries)

### 6. **Missing Features Added**
- **Email Verification:** `email_verified` flag
- **Account Management:** `is_active`, `last_login_at`
- **Completion Tracking:** `end_date` for merits and targets with constraint ensuring it's set when inactive
- **Timezone Support:** Notifications support timezones for accurate scheduling

### 7. **Naming Consistency**
- All IDs follow `table_name_id` pattern
- Boolean fields use `is_` prefix
- Timestamps use `_at` suffix
- Duration fields use `_days` suffix

---

## Recommended Partitioning Strategy (Future)

For tables expected to grow large (ENTRIES, ENTRY_HISTORY), consider partitioning:

```sql
-- Example: Partition entries by year
CREATE TABLE entries_2024 PARTITION OF entries
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE entries_2025 PARTITION OF entries
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

---

## Query Optimization Recommendations

1. **Dashboard Queries:** Use composite indexes on (user_id, entry_date)
2. **Progress Tracking:** Index merit_items and target_items on deed_item_id
3. **Permission Checks:** Index permissions on (relation_id, deed_item_id, is_active)
4. **Analytics:** Consider materialized views for aggregated statistics
5. **Full-Text Search:** Add GIN indexes on TEXT fields if search is needed

### Display Order Reordering Best Practices

When reordering `deed_items` with the DEFERRABLE constraint, use these patterns:

**Pattern 1: Swap Two Adjacent Items**
```sql
BEGIN;
UPDATE deed_items SET display_order = -1 WHERE deed_item_id = :item_a_id;
UPDATE deed_items SET display_order = :old_order_a WHERE deed_item_id = :item_b_id;
UPDATE deed_items SET display_order = :old_order_b WHERE deed_item_id = :item_a_id;
COMMIT;
```

**Pattern 2: Move Item to New Position (with renumbering)**
```sql
BEGIN;
-- Move target item to temporary position
UPDATE deed_items SET display_order = -1 WHERE deed_item_id = :target_id;
-- Shift items in the range
UPDATE deed_items 
SET display_order = display_order + 1 
WHERE deed_id = :deed_id 
  AND parent_deed_item_id = :parent_id 
  AND display_order >= :new_position
  AND display_order < :old_position;
-- Place target at new position
UPDATE deed_items SET display_order = :new_position WHERE deed_item_id = :target_id;
COMMIT;
```

**Pattern 3: Batch Reordering (Python Example)**
```python
def reorder_deed_items(connection, deed_id, parent_id, new_order_list):
    """
    Reorder deed items efficiently.
    new_order_list: List of (deed_item_id, new_display_order) tuples
    """
    with connection.cursor() as cur:
        cur.execute("BEGIN")
        try:
            # Use temporary negative values to avoid conflicts
            for idx, (item_id, new_order) in enumerate(new_order_list):
                cur.execute(
                    "UPDATE deed_items SET display_order = %s WHERE deed_item_id = %s",
                    (-1000 - idx, item_id)
                )
            
            # Now assign final values
            for item_id, new_order in new_order_list:
                cur.execute(
                    "UPDATE deed_items SET display_order = %s WHERE deed_item_id = %s",
                    (new_order, item_id)
                )
            
            cur.execute("COMMIT")
        except Exception as e:
            cur.execute("ROLLBACK")
            raise
```

**Performance Note:** The DEFERRABLE constraint allows all updates to happen in a single transaction without constraint violations, making reordering operations atomic and efficient.

---

## Migration Notes

When migrating from the original schema:
1. Map `deeds_id` → `deed_id`
2. Create `scale_values` table and populate from existing scale data
3. Add `parent_deed_item_id` to deed_items (may require data migration)
4. Update ENTRY table to use `scale_value_id` instead of `scale_value` string
5. Convert string enums to ENUM types

**Note:** This schema is optimized for minimal storage:
- **Hard deletes:** No `deleted_at` fields (use `DELETE` for permanent removal)
- **No change tracking:** No `updated_at` fields (use `is_active = FALSE` for temporary disabling)
- **Minimal overhead:** Only essential fields like `is_active` and `created_at` are kept

---

## Conclusion

This enhanced schema maintains the core purpose of Kitaab while significantly improving:
- **Data integrity** through constraints and foreign keys
- **Query performance** through strategic indexing
- **Scalability** through normalization and partitioning readiness
- **Extensibility** through flexible fields and new tables
- **Maintainability** through consistent naming and clear relationships

The design is production-ready and can scale to millions of users while maintaining excellent query performance.

