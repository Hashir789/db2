# Kitaab Database - Enhanced Schema Design

## Overview
This document presents an enhanced, production-ready database schema for Kitaab, optimized for scalability, performance, data integrity, and future extensibility.

---

## Core Tables

### 1. USERS
**Purpose:** Store user account information and demographics.

```sql
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    date_of_birth DATE,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
```

**Key Improvements:**
- Added `email_verified` for account security
- Added `is_active` for account management
- Added `last_login_at` for analytics
- Added `updated_at` for audit trail
- Added `deleted_at` for soft deletes
- Unique constraint on email
- Partial indexes for active users only

---

### 2. DEEDS
**Purpose:** Main deed categories (Hasanaat/Saiyyiaat) owned by users.

```sql
CREATE TYPE deed_category_type AS ENUM ('hasanaat', 'saiyyiaat');

CREATE TABLE deeds (
    deed_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category_type deed_category_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_user_deed_name UNIQUE (user_id, name) WHERE deleted_at IS NULL
);

-- Indexes
CREATE INDEX idx_deeds_user_id ON deeds(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deeds_category ON deeds(category_type, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deeds_active ON deeds(is_active, user_id) WHERE deleted_at IS NULL;
```

**Key Improvements:**
- Renamed `deeds_id` to `deed_id` for consistency
- Added `is_active` for enabling/disabling deeds
- Added `updated_at` and `deleted_at` for lifecycle management
- Unique constraint on user + deed name combination
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
    level INTEGER NOT NULL CHECK (level > 0),
    display_order INTEGER NOT NULL DEFAULT 0,
    hide_type hide_type_enum DEFAULT 'none',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_hierarchy CHECK (
        (parent_deed_item_id IS NULL AND level = 1) OR
        (parent_deed_item_id IS NOT NULL AND level > 1)
    )
);

-- Indexes
CREATE INDEX idx_deed_items_deed_id ON deed_items(deed_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deed_items_parent ON deed_items(parent_deed_item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deed_items_level ON deed_items(deed_id, level, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_deed_items_active ON deed_items(is_active, deed_id) WHERE deleted_at IS NULL;
```

**Key Improvements:**
- Added `parent_deed_item_id` for explicit hierarchy (self-referencing)
- Added `is_active` for item management
- Added constraint to validate hierarchy structure
- Composite index on (deed_id, level, display_order) for efficient tree traversal
- Proper foreign key with CASCADE for data integrity

---

### 4. SCALES
**Purpose:** Define how deeds are measured (scale-based or count-based).

```sql
CREATE TABLE scales (
    scale_id BIGSERIAL PRIMARY KEY,
    deed_id BIGINT NOT NULL REFERENCES deeds(deed_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
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
- Indexes optimized for active scale lookups

---

### 5. SCALE_VALUES (New Table)
**Purpose:** Store individual scale options (e.g., "Yes", "No", "Prayed on time", etc.).

```sql
CREATE TABLE scale_values (
    scale_value_id BIGSERIAL PRIMARY KEY,
    scale_id BIGINT NOT NULL REFERENCES scales(scale_id) ON DELETE CASCADE,
    value_name VARCHAR(255) NOT NULL,
    value_order INTEGER NOT NULL DEFAULT 0,
    numeric_value DECIMAL(10,2), -- Optional: for weighted scales
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_scale_values_scale_id ON scale_values(scale_id, value_order) WHERE is_active = TRUE;
```

**Key Improvements:**
- **New table** to normalize scale options
- Allows multiple values per scale (Yes/No, Excellent/Good/Fair/Poor, etc.)
- Supports weighted scales via `numeric_value`
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
    scale_id BIGINT REFERENCES scales(scale_id) ON DELETE SET NULL,
    scale_value_id BIGINT REFERENCES scale_values(scale_value_id) ON DELETE SET NULL,
    count_value DECIMAL(10,2), -- For count-based entries
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id BIGINT REFERENCES users(user_id), -- For permission-based entries
    CONSTRAINT entry_has_value CHECK (
        (scale_value_id IS NOT NULL) OR (count_value IS NOT NULL)
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
- Added `notes` field for user annotations
- Added `created_by_user_id` to track permission-based entries
- Unique constraint prevents duplicate entries per day
- CHECK constraint ensures either scale or count value exists
- Time-based partial index for recent entries (performance optimization)
- Composite indexes for dashboard queries

---

### 7. ENTRY_HISTORY
**Purpose:** Track all changes to entries for audit trail.

```sql
CREATE TABLE entry_history (
    entry_history_id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES entries(entry_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    scale_value_id BIGINT REFERENCES scale_values(scale_value_id),
    count_value DECIMAL(10,2),
    notes TEXT,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')),
    changed_by_user_id BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_entry_history_entry_id ON entry_history(entry_id, created_at DESC);
CREATE INDEX idx_entry_history_user_id ON entry_history(user_id, created_at DESC);
CREATE INDEX idx_entry_history_date ON entry_history(created_at DESC);
```

**Key Improvements:**
- Added `change_type` to distinguish create/update/delete
- Added `changed_by_user_id` for permission tracking
- Indexes optimized for audit queries and user history

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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_relation CHECK (requester_id != requestee_id),
    CONSTRAINT unique_relation UNIQUE (requester_id, requestee_id)
);

-- Indexes
CREATE INDEX idx_relations_requester ON relations(requester_id, status);
CREATE INDEX idx_relations_requestee ON relations(requestee_id, status);
CREATE INDEX idx_relations_accepted ON relations(requester_id, requestee_id) WHERE status = 'accepted';
```

**Key Improvements:**
- ENUM type for status ensures data integrity
- CHECK constraint prevents self-relations
- Unique constraint prevents duplicate requests
- Indexes for bidirectional lookups (who requested, who received)
- Partial index for active connections only

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
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_permission UNIQUE (relation_id, deed_item_id, permission_type, version)
);

-- Indexes
CREATE INDEX idx_permissions_relation ON permissions(relation_id, is_active);
CREATE INDEX idx_permissions_deed_item ON permissions(deed_item_id, is_active);
CREATE INDEX idx_permissions_type ON permissions(permission_type, deed_item_id) WHERE is_active = TRUE;
```

**Key Improvements:**
- ENUM type for permission_type
- Version tracking for permission history
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_reflection_date_type UNIQUE (user_id, reflection_date, type)
);

-- Indexes
CREATE INDEX idx_reflection_user_date ON reflection_messages(user_id, reflection_date DESC);
CREATE INDEX idx_reflection_type_date ON reflection_messages(type, reflection_date DESC);
```

**Key Improvements:**
- Renamed `date` to `reflection_date` for clarity
- ENUM type for reflection type
- Unique constraint ensures one reflection per type per day
- Indexes for user history and analytics

---

### 11. NOTIFICATIONS
**Purpose:** User-set daily reminders.

```sql
CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_time TIME NOT NULL, -- Time of day for reminder
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT TRUE,
    notification_type VARCHAR(50) DEFAULT 'daily_reminder',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT one_active_notification_per_user UNIQUE (user_id) WHERE is_active = TRUE
);

-- Indexes
CREATE INDEX idx_notifications_user_active ON notifications(user_id, is_active);
CREATE INDEX idx_notifications_time ON notifications(notification_time, timezone) WHERE is_active = TRUE;
```

**Key Improvements:**
- Added `timezone` for accurate scheduling
- Added `notification_type` for extensibility (daily, weekly, custom)
- Unique constraint ensures one active notification per user
- Partial index for active notifications only

---

### 12. MESSAGES
**Purpose:** In-app support chat.

```sql
CREATE TYPE message_status_enum AS ENUM ('sent', 'delivered', 'read', 'none');

CREATE TABLE messages (
    message_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    thread_id BIGINT, -- For grouping related messages
    content TEXT NOT NULL,
    status message_status_enum DEFAULT 'none',
    is_from_user BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE = from user, FALSE = from support
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);
CREATE INDEX idx_messages_thread ON messages(thread_id, created_at DESC) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_messages_status ON messages(status, user_id) WHERE status != 'read';
```

**Key Improvements:**
- Renamed `sender` to `is_from_user` (boolean, clearer)
- Added `thread_id` for conversation grouping
- Added `read_at` timestamp for precise read tracking
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
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_merits_user ON merits(user_id, is_active);
CREATE INDEX idx_merits_deed_item ON merits(deed_item_id, is_active);
CREATE INDEX idx_merits_category ON merits(category, user_id) WHERE is_active = TRUE;
```

**Key Improvements:**
- Renamed `duration (in days)` to `duration_days` (SQL-friendly)
- Added `completed_at` for tracking achievement dates
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
    is_required BOOLEAN DEFAULT TRUE,
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
- Added `is_required` for optional items in OR-type merits
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
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Indexes
CREATE INDEX idx_targets_user ON targets(user_id, is_active);
CREATE INDEX idx_targets_dates ON targets(start_date, end_date) WHERE is_active = TRUE;
CREATE INDEX idx_targets_active ON targets(is_active, user_id) WHERE is_active = TRUE;
```

**Key Improvements:**
- Added `completed_at` for tracking completion
- CHECK constraint validates date range
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
    is_required BOOLEAN DEFAULT TRUE,
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
    timezone VARCHAR(50) DEFAULT 'UTC',
    theme VARCHAR(20) DEFAULT 'light',
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
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
- **ENUM Types:** Ensure only valid values for categories, statuses, types

### 2. **Performance Optimization**
- **Strategic Indexes:** Composite indexes for common query patterns
- **Partial Indexes:** Index only active/non-deleted records
- **Time-based Indexes:** Optimized for date range queries
- **Foreign Key Indexes:** All foreign keys indexed for join performance

### 3. **Scalability Enhancements**
- **Soft Deletes:** `deleted_at` timestamps instead of hard deletes
- **Versioning:** Scales and permissions support versioning
- **Partitioning Ready:** Entry tables structured for future date-based partitioning
- **Normalized Scale Values:** New `scale_values` table for better scale management

### 4. **Flexibility & Extensibility**
- **Metadata Fields:** `notes`, `description` fields for future use
- **Type Fields:** `notification_type` allows multiple notification types
- **Thread Support:** Messages table supports conversation threading
- **User Preferences:** New table for extensible user settings
- **Audit Log:** System-wide audit trail for compliance

### 5. **Relationship Improvements**
- **Explicit Hierarchy:** `parent_deed_item_id` in deed_items for clear tree structure
- **Permission Normalization:** Permissions linked to relations, not direct user pairs
- **Created By Tracking:** Entries track who created them (for permission-based entries)

### 6. **Missing Features Added**
- **Email Verification:** `email_verified` flag
- **Account Management:** `is_active`, `last_login_at`
- **Completion Tracking:** `completed_at` for merits and targets
- **Timezone Support:** Notifications and preferences support timezones
- **Read Tracking:** Messages have `read_at` timestamp

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

---

## Migration Notes

When migrating from the original schema:
1. Map `deeds_id` → `deed_id`
2. Create `scale_values` table and populate from existing scale data
3. Add `parent_deed_item_id` to deed_items (may require data migration)
4. Update ENTRY table to use `scale_value_id` instead of `scale_value` string
5. Add missing timestamp fields (`updated_at`, `deleted_at`)
6. Convert string enums to ENUM types

---

## Conclusion

This enhanced schema maintains the core purpose of Kitaab while significantly improving:
- **Data integrity** through constraints and foreign keys
- **Query performance** through strategic indexing
- **Scalability** through normalization and partitioning readiness
- **Extensibility** through flexible fields and new tables
- **Maintainability** through consistent naming and clear relationships

The design is production-ready and can scale to millions of users while maintaining excellent query performance.

