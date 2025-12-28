# Kitaab Database Design - Complete A-to-Z Guide

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Requirements Analysis](#2-requirements-analysis)
   - 2.1. Core Functional Requirements
   - 2.2. Non-Functional Requirements
   - 2.3. Security & Privacy Requirements
   - 2.4. Scalability Requirements
3. [Data Modeling](#3-data-modeling)
   - 3.1. Entity Identification
   - 3.2. Relationship Mapping
   - 3.3. Hierarchy Design Patterns
   - 3.4. Normalization Strategy
4. [Schema Design](#4-schema-design)
   - 4.1. Design Principles
   - 4.2. Data Type Strategy
   - 4.3. Naming Conventions
   - 4.4. Core Tables
   - 4.5. Supporting Tables
5. [Table Structures](#5-table-structures)
   - 5.1. User Management Tables
   - 5.2. Deed Hierarchy Tables
   - 5.3. Entry & History Tables
   - 5.4. Social & Permissions Tables
   - 5.5. Progress Tracking Tables
   - 5.6. Communication Tables
   - 5.7. Encryption Tables
6. [Relationships & Constraints](#6-relationships--constraints)
   - 6.1. Foreign Key Strategy
   - 6.2. Check Constraints
   - 6.3. Unique Constraints
   - 6.4. Enum Types
   - 6.5. Hierarchy Validation
7. [Indexing Strategy](#7-indexing-strategy)
   - 7.1. Indexing Philosophy
   - 7.2. Understanding Query Patterns
   - 7.3. Index Categories
   - 7.4. Index Selection Criteria
   - 7.5. Index Maintenance
   - 7.6. Anti-Patterns: When NOT to Index
8. [Client-Side Encryption](#8-client-side-encryption)
   - 8.1. Encryption Architecture
   - 8.2. Key Management
   - 8.3. Data Sharing Model
   - 8.4. Implementation Details
9. [Access Control & Permissions](#9-access-control--permissions)
   - 9.1. Permission Model
   - 9.2. Unidirectional Relations
   - 9.3. Permission Enforcement
10. [Migration Strategy](#10-migration-strategy)
    - 10.1. Migration Planning
    - 10.2. Schema Evolution
    - 10.3. Data Migration
    - 10.4. Rollback Procedures
11. [Performance Optimization](#11-performance-optimization)
    - 11.1. Query Optimization
    - 11.2. Connection Pooling
    - 11.3. Caching Strategy
    - 11.4. Partitioning Strategy
12. [Scalability Considerations](#12-scalability-considerations)
    - 12.1. Horizontal Scaling
    - 12.2. Vertical Scaling
    - 12.3. Read Replicas
    - 12.4. Sharding Strategy (Future)
13. [Security & Compliance](#13-security--compliance)
    - 13.1. Authentication
    - 13.2. Data Protection
    - 13.3. Audit Logging
    - 13.4. Compliance Considerations
14. [Monitoring & Maintenance](#14-monitoring--maintenance)
    - 14.1. Performance Monitoring
    - 14.2. Health Checks
    - 14.3. Backup Strategy
    - 14.4. Disaster Recovery
15. [Production Deployment](#15-production-deployment)
    - 15.1. Pre-Deployment Checklist
    - 15.2. Deployment Procedures
    - 15.3. Post-Deployment Validation
16. [Appendix](#16-appendix)
    - 16.1. Complete Schema SQL
    - 16.2. Common Query Patterns
    - 16.3. Troubleshooting Guide

---

## 1. Executive Summary

Kitaab is a personal accountability application designed to help users track their spiritual and moral progress through structured deed tracking. The database architecture supports a hierarchical deed system, daily entry recording, social connections with granular permissions, progress tracking via merits and targets, and client-side encryption for privacy.

### Key Design Principles

1. **Data Integrity First**: All constraints enforced at the database level to prevent invalid states
2. **Space Optimization**: Minimal storage overhead - hard deletes, no unnecessary timestamps
3. **Client-Side Encryption**: Sensitive data encrypted before storage, server cannot decrypt
4. **Scalability Ready**: Designed to handle millions of users and billions of entries
5. **Query Performance**: Strategic indexing based on real-world query patterns
6. **Production-Ready**: Every decision considers operational complexity and maintenance burden

### Technology Stack

- **Database**: PostgreSQL 14+ (production recommended)
- **Connection Pooling**: psycopg2 with connection pools
- **Caching**: Redis (recommended for frequently accessed data)
- **Encryption**: AES-GCM 256-bit with client-side key management

### Architecture Highlights

- **Hierarchical Deeds**: 3-level deed structure (enforced at application level)
- **Dual Measurement**: Scale-based or count-based entries per deed
- **Unidirectional Relations**: One-way user connections with granular permissions
- **Versioned Scales**: Support for evolving scale definitions over time
- **Encrypted Fields**: BYTEA columns for sensitive data (names, descriptions, messages)
- **Minimal Overhead**: No soft deletes, no updated_at fields (space-optimized)

---

## 2. Requirements Analysis

### 2.1. Core Functional Requirements

#### User Management
- User registration with email and password
- Email verification workflow
- Two-factor authentication support
- User profile with demographics (gender, date of birth) for analytics
- User preferences (language, theme, timezone) stored in users table

#### Deed Tracking
- Create deeds categorized as Hasanaat (good deeds) or Saiyyiaat (bad deeds)
- Hierarchical deed items (3 levels maximum)
- Each deed can be measured via scales (Yes/No, Excellent/Good/Fair) or counts (numeric values)
- Scale values can evolve over time (versioning support)
- Display order management with reordering capability

#### Entry Recording
- Daily entries per deed item
- Support for both scale-based and count-based entries
- One entry per deed item per day (unique constraint)
- Track who created the entry (for permission-based entries)
- Entry history for audit trail (created/updated only, no deletes)

#### Social Features
- Unidirectional user connections (requester → requestee)
- Connection status: pending, accepted, rejected, blocked
- Granular permissions per deed item: read-only or read-write
- Only one write permission per deed item (multiple read permissions allowed)
- Permission-based entry creation (friends can record entries for users)

#### Progress Tracking
- **Merits**: Deed-specific achievements with AND/OR logic
- **Targets**: Multi-deed goals spanning multiple deed items
- Track completion dates for merits and targets
- Support for both count-based and scale-based progress tracking

#### Reflection & Communication
- Daily reflection messages (one per type: Hasanaat/Saiyyiaat per day)
- In-app support messaging with status tracking
- Daily notification reminders (timezone-aware)

### 2.2. Non-Functional Requirements

#### Performance
- Dashboard queries (last 30 days): < 50ms (p95)
- Permission checks: < 5ms (p95)
- Entry creation: < 10ms (p95)
- Support 10,000+ entries per minute during peak hours

#### Scalability
- Support millions of users
- Support billions of entries
- Horizontal scaling ready (read replicas, future sharding)
- Partitioning strategy for time-series data (entries, entry_history)

#### Storage Efficiency
- Minimal storage overhead (no soft deletes, no updated_at fields)
- Optimized indexes (partial indexes for active records)
- Efficient data types (ENUMs instead of VARCHAR where applicable)

### 2.3. Security & Privacy Requirements

#### Client-Side Encryption
- Sensitive fields encrypted before storage (deed names, descriptions, reflection messages)
- Server cannot decrypt data without user password
- Support for data sharing (multiple users can decrypt same data with their own keys)
- PBKDF2 key derivation (100,000 iterations, SHA-256)
- AES-GCM 256-bit encryption

#### Authentication & Authorization
- Secure password hashing (bcrypt or Argon2)
- Email verification required
- Two-factor authentication support
- Row-level access control via permissions table

#### Data Protection
- No plaintext storage of sensitive data
- Encrypted backups
- Audit trail for critical operations
- GDPR-compliant data deletion

### 2.4. Scalability Requirements

#### Growth Projections
- Year 1: 10,000 users, 1M entries
- Year 3: 100,000 users, 100M entries
- Year 5: 1M users, 1B entries

#### Scaling Strategy
- Vertical scaling: Optimize single database instance
- Horizontal scaling: Read replicas for analytics
- Future: User-based sharding for multi-region deployment
- Partitioning: Date-based partitioning for entries table

---

## 3. Data Modeling

### 3.1. Entity Identification

The Kitaab database consists of 16 core tables organized into logical clusters:

#### User Management Cluster
- **users**: Core user accounts with authentication and preferences
- **relations**: Unidirectional user connections
- **permissions**: Granular access control per deed item

#### Deed Hierarchy Cluster
- **deeds**: Top-level deed categories (Hasanaat/Saiyyiaat)
- **deed_items**: Hierarchical items within deeds (3 levels)
- **scales**: Measurement definitions for deeds
- **scale_values**: Individual scale options (Yes/No, Excellent/Good, etc.)

#### Entry & History Cluster
- **entries**: Daily deed recordings
- **entry_history**: Audit trail of all entry changes

#### Progress Tracking Cluster
- **merits**: Deed-specific achievements
- **merit_items**: Components within merits
- **targets**: Multi-deed goals
- **target_items**: Components within targets

#### Communication Cluster
- **reflection_messages**: Daily reflections
- **messages**: In-app support chat
- **notifications**: Daily reminder settings

#### Encryption Cluster
- **encrypted_keys**: Encrypted DEKs (Data Encryption Keys) per user per data item

### 3.2. Relationship Mapping

#### One-to-Many Relationships
- User → Deeds (one user has many deeds)
- Deed → Deed Items (one deed has many items)
- Deed Item → Deed Items (self-referencing hierarchy)
- Deed → Scales (one deed can have multiple scale versions)
- Scale → Scale Values (one scale has many options)
- Entry → Entry History (one entry has many history records)
- User → Entries (one user has many entries)
- User → Merits (one user has many merits)
- User → Targets (one user has many targets)

#### Many-to-Many Relationships (via junction tables)
- Users ↔ Users (via `relations` table)
- Relations ↔ Deed Items (via `permissions` table)
- Data Items ↔ Users (via `encrypted_keys` table for sharing)

#### Optional Relationships
- Entries → Scale Values (only for scale-based entries)
- Merit Items → Scale Values (only for scale-based targets)
- Target Items → Scale Values (only for scale-based targets)

### 3.3. Hierarchy Design Patterns

#### Deed Items Hierarchy
The deed_items table uses a self-referencing pattern with `parent_deed_item_id`:

```
Level 1: parent_deed_item_id IS NULL
  └─ Level 2: parent_deed_item_id = Level 1 item
      └─ Level 3: parent_deed_item_id = Level 2 item
```

**Design Decision**: The 3-level limit is enforced at the application level (frontend/backend API), not at the database level. This provides flexibility for future changes and better user experience (clear error messages vs. database constraint violations).

**Why Application-Level Enforcement?**
- Database constraints would require complex recursive checks
- Application-level validation provides better error messages
- Easier to adjust hierarchy limits without schema changes
- Better performance (no recursive constraint checks on every insert)

#### Display Order Management
The `display_order` field uses a DEFERRABLE UNIQUE constraint to enable efficient reordering:

```sql
CONSTRAINT unique_deed_item_display_order 
    UNIQUE (deed_id, parent_deed_item_id, display_order) 
    DEFERRABLE INITIALLY DEFERRED
```

**Why DEFERRABLE?**
- Allows temporary constraint violations within a transaction
- Enables atomic reordering operations (swap, move, batch reorder)
- Prevents constraint violations during complex update sequences

### 3.4. Normalization Strategy

#### Third Normal Form (3NF) Compliance
All tables are normalized to 3NF to eliminate redundancy:

- **Scale Values Normalization**: Moved from string storage in entries to dedicated `scale_values` table
  - **Benefit**: Update scale options without touching millions of entries
  - **Benefit**: Support weighted scales via `numeric_value` field
  - **Benefit**: Better analytics (aggregate by scale value)

- **User Preferences Merged**: Preferences stored in `users` table (1:1 relationship)
  - **Benefit**: Always needed together, simpler queries
  - **Benefit**: No JOIN required for user + preferences
  - **Trade-off**: Slightly wider users table (acceptable for 1:1 relationship)

#### Denormalization Decisions

**When We Denormalize:**
1. **User Preferences**: Merged into users table (1:1, always queried together)
2. **Display Order**: Stored in deed_items (frequently sorted, rarely updated)

**When We Normalize:**
1. **Scale Values**: Separate table (many-to-many with entries, frequently updated)
2. **Permissions**: Separate table (many-to-many with relations and deed_items)

---

## 4. Schema Design

### 4.1. Design Principles

#### Space Optimization
- **Hard Deletes**: Use `DELETE` statements, no `deleted_at` fields
  - **Rationale**: Saves 8 bytes per row, simplifies queries (no WHERE deleted_at IS NULL)
  - **Trade-off**: No recovery of deleted data (acceptable for Kitaab's use case)

- **No Updated Timestamps**: Removed `updated_at` fields
  - **Rationale**: Saves 8 bytes per row, rarely needed for queries
  - **Alternative**: Use `is_active = FALSE` for temporary disabling, `created_at` for creation time

- **Minimal Overhead**: Only essential fields (`is_active`, `created_at`)

#### Data Integrity
- **Foreign Keys**: All relationships have foreign keys with appropriate CASCADE/RESTRICT rules
- **CHECK Constraints**: Validate data at database level (dates, values, hierarchy)
- **UNIQUE Constraints**: Prevent duplicates (entries, reflections, relations)
- **ENUM Types**: Ensure only valid values (more efficient than VARCHAR + CHECK)

#### Performance First
- **Strategic Indexes**: Only indexes that provide measurable value
- **Partial Indexes**: Index only active/non-deleted records
- **Composite Indexes**: Optimized for common query patterns
- **Time-Based Indexes**: Optimized for date range queries

### 4.2. Data Type Strategy

#### Primary Keys
- **Type**: `BIGSERIAL` (supports billions of records)
- **Naming**: `{table_name}_id` (e.g., `deed_id`, not `deeds_id`)

#### Timestamps
- **Type**: `TIMESTAMP WITH TIME ZONE` (all timestamps)
- **Naming**: `{action}_at` (e.g., `created_at`, `accepted_at`)
- **Rationale**: Timezone-aware for global users

#### Numeric Values
- **Counts**: `DECIMAL(15,2)` (supports millions/thousands with precision)
- **Durations**: `INTEGER` with `_days` suffix
- **Rationale**: Precision for calculations, large number support

#### Text Fields
- **Short Text**: `VARCHAR(255)` (names, titles)
- **Long Text**: `TEXT` (descriptions, messages)
- **Encrypted Data**: `BYTEA` (binary data for encrypted fields)

#### Enum Types
- **Usage**: All fixed-value fields (status, category, type)
- **Benefits**: 
  - More efficient storage (4 bytes vs variable VARCHAR)
  - Better type safety
  - Improved query performance
  - Database-level validation

#### Boolean Fields
- **Naming**: `is_` prefix (e.g., `is_active`, `is_encrypted`)
- **Default**: Explicit defaults (e.g., `DEFAULT FALSE`)

### 4.3. Naming Conventions

#### Table Names
- **Singular**: `user`, `deed`, `entry` (not `users`, `deeds`, `entries`)
- **Exception**: Junction tables use descriptive names (`relations`, `permissions`)

#### Column Names
- **IDs**: `{table_name}_id` (e.g., `deed_id`, `user_id`)
- **Foreign Keys**: Same as referenced column (e.g., `user_id` references `users.user_id`)
- **Booleans**: `is_` prefix (e.g., `is_active`, `is_encrypted`)
- **Timestamps**: `{action}_at` (e.g., `created_at`, `accepted_at`)
- **Durations**: `{unit}_days` (e.g., `duration_days`)

#### Index Names
- **Pattern**: `idx_{table}_{columns}` (e.g., `idx_entries_user_date`)
- **Partial Indexes**: Include condition in name (e.g., `idx_deeds_active`)

#### Constraint Names
- **Pattern**: `{constraint_type}_{table}_{description}` (e.g., `unique_user_deed_item_date`)

### 4.4. Core Tables

The core tables form the foundation of the Kitaab application. Each table is designed with specific access patterns in mind, optimized for both read and write operations.

**Key Design Decisions:**
- **users**: Merged preferences (1:1 relationship, always queried together)
- **deeds**: Minimal structure (category_type only, details in deed_items)
- **deed_items**: Self-referencing hierarchy with display_order management
- **scales**: Versioned for evolution over time
- **scale_values**: Normalized scale options (moved from entries table)
- **entries**: Dual measurement (scale_value_id OR count_value)
- **entry_history**: Audit trail (created/updated only, no deletes)

### 4.5. Supporting Tables

Supporting tables extend functionality without cluttering core tables:

- **relations**: Unidirectional user connections
- **permissions**: Granular access control
- **merits/targets**: Progress tracking
- **reflection_messages**: Daily reflections
- **messages**: Support chat
- **notifications**: Reminder settings
- **encrypted_keys**: Client-side encryption key management

---

## 5. Table Structures

This section provides complete table definitions with detailed explanations of design decisions, constraints, and indexing strategies.

### 5.1. User Management Tables

#### users

**Purpose**: Core user accounts with authentication, preferences, and encryption support.

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
    -- User preferences (merged from user_preferences table)
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'light',
    timezone VARCHAR(50) DEFAULT 'UTC',
    -- Encryption
    encryption_salt BYTEA, -- PBKDF2 salt for deriving KEK (Key Encryption Key) from password
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

**Design Decisions:**

1. **Merged Preferences**: User preferences (language, theme, timezone) are stored directly in the users table rather than a separate `user_preferences` table.
   - **Rationale**: 1:1 relationship, always queried together, eliminates JOIN overhead
   - **Trade-off**: Slightly wider users table (acceptable for always-needed data)

2. **Gender ENUM**: Limited to 'male' and 'female' for analytics purposes.
   - **Rationale**: Simplifies analytics queries, reduces storage
   - **Note**: Can be extended if needed (application-level validation can handle more options)

3. **Encryption Salt**: Stored per user for PBKDF2 key derivation.
   - **Rationale**: Each user has unique salt, prevents rainbow table attacks
   - **Storage**: 16 bytes (BYTEA)

4. **Index Strategy**:
   - `idx_users_email`: Essential for login queries (UNIQUE constraint also creates index, but explicit index for clarity)
   - `idx_users_created_at`: For user growth analytics
   - `idx_users_gender`, `idx_users_date_of_birth`, `idx_users_gender_age`: For admin filtering and demographic analytics

**Query Patterns:**
- Login: `SELECT * FROM users WHERE email = ?` (uses idx_users_email)
- User profile: `SELECT * FROM users WHERE user_id = ?` (uses primary key)
- Analytics: `SELECT COUNT(*) FROM users WHERE gender = ? AND date_of_birth BETWEEN ? AND ?` (uses idx_users_gender_age)

### 5.2. Deed Hierarchy Tables

#### deeds

**Purpose**: Top-level deed categories (Hasanaat/Saiyyiaat) owned by users.

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

**Design Decisions:**

1. **Minimal Structure**: Only `category_type` stored in deeds table.
   - **Rationale**: Details (name, description) stored in `deed_items` (level 1 items)
   - **Benefit**: Simpler schema, details can be encrypted per item

2. **CASCADE Delete**: When user is deleted, all their deeds are deleted.
   - **Rationale**: User owns all deeds, no orphaned data

3. **Index Strategy**:
   - `idx_deeds_user_id`: Essential for "get all deeds for user" queries
   - `idx_deeds_category`: Composite index for "get all hasanaat/saiyyiaat for user" queries

**Query Patterns:**
- User deeds: `SELECT * FROM deeds WHERE user_id = ?` (uses idx_deeds_user_id)
- Category filter: `SELECT * FROM deeds WHERE user_id = ? AND category_type = ?` (uses idx_deeds_category)

#### deed_items

**Purpose**: Hierarchical items within deeds (3 levels maximum, enforced at application level).

```sql
CREATE TYPE hide_type_enum AS ENUM ('none', 'hide_from_all', 'hide_from_graphs');

CREATE TABLE deed_items (
    deed_item_id BIGSERIAL PRIMARY KEY,
    deed_id BIGINT NOT NULL REFERENCES deeds(deed_id) ON DELETE CASCADE,
    parent_deed_item_id BIGINT REFERENCES deed_items(deed_item_id) ON DELETE CASCADE,
    name BYTEA NOT NULL,
    description BYTEA,
    is_encrypted BOOLEAN DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    hide_type hide_type_enum DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_deed_item_name_per_parent UNIQUE (deed_id, parent_deed_item_id, name),
    CONSTRAINT unique_deed_item_display_order UNIQUE (deed_id, parent_deed_item_id, display_order) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Indexes
CREATE INDEX idx_deed_items_parent ON deed_items(parent_deed_item_id);
CREATE INDEX idx_deed_items_level1 ON deed_items(deed_id, display_order) WHERE parent_deed_item_id IS NULL;
```

**Design Decisions:**

1. **Self-Referencing Hierarchy**: `parent_deed_item_id` enables tree structure.
   - **Level 1**: `parent_deed_item_id IS NULL`
   - **Level 2**: Parent is a level 1 item
   - **Level 3**: Parent is a level 2 item
   - **Level 4+**: Prevented by application-level validation

2. **DEFERRABLE Constraint**: `display_order` unique constraint is DEFERRABLE.
   - **Rationale**: Allows temporary violations during reordering transactions
   - **Benefit**: Atomic reordering operations (swap, move, batch reorder)

3. **Encrypted Fields**: `name` and `description` are BYTEA (encrypted binary data).
   - **Rationale**: Client-side encryption for privacy
   - **Flag**: `is_encrypted` indicates if data is encrypted

4. **Index Strategy**:
   - `idx_deed_items_parent`: Essential for hierarchical queries ("get all children of item X")
   - `idx_deed_items_level1`: Partial index for top-level items (common query pattern)
   - **Note**: UNIQUE constraint on `(deed_id, parent_deed_item_id, display_order)` automatically creates an index

**Reordering Pattern:**
```sql
BEGIN;
-- Move item to temporary position
UPDATE deed_items SET display_order = -1 WHERE deed_item_id = :item_a;
-- Move other items
UPDATE deed_items SET display_order = :old_order_a WHERE deed_item_id = :item_b;
-- Move item to final position
UPDATE deed_items SET display_order = :old_order_b WHERE deed_item_id = :item_a;
COMMIT; -- Constraint checked at commit time
```

**Query Patterns:**
- Get children: `SELECT * FROM deed_items WHERE parent_deed_item_id = ? ORDER BY display_order` (uses idx_deed_items_parent)
- Get level 1 items: `SELECT * FROM deed_items WHERE deed_id = ? AND parent_deed_item_id IS NULL ORDER BY display_order` (uses idx_deed_items_level1)
- Get all items for deed: `SELECT * FROM deed_items WHERE deed_id = ?` (uses unique constraint's index)

#### scales

**Purpose**: Define how deeds are measured (scale-based or count-based), with versioning support.

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

**Design Decisions:**

1. **Versioning**: Scales can evolve over time (e.g., Yes/No → Excellent/Good/Fair/Poor).
   - **Rationale**: Users may want to refine their tracking methods
   - **Benefit**: Historical entries remain valid, new entries use new version

2. **Minimal Structure**: No `name` or `description` in scales table.
   - **Rationale**: Scale details stored in `scale_values` table (one value per row)
   - **Benefit**: Normalized structure, easier to manage scale options

3. **Index Strategy**:
   - `idx_scales_deed_id`: Partial index for active scales only (most common query)
   - `idx_scales_active_version`: Composite index for "get latest active scale" queries

**Query Patterns:**
- Active scale: `SELECT * FROM scales WHERE deed_id = ? AND is_active = TRUE ORDER BY version DESC LIMIT 1` (uses idx_scales_active_version)
- All scales: `SELECT * FROM scales WHERE deed_id = ?` (uses idx_scales_deed_id)

#### scale_values

**Purpose**: Store individual scale options (e.g., "Yes", "No", "Prayed on time", etc.).

```sql
CREATE TABLE scale_values (
    scale_value_id BIGSERIAL PRIMARY KEY,
    scale_id BIGINT NOT NULL REFERENCES scales(scale_id) ON DELETE CASCADE,
    name BYTEA NOT NULL,
    description BYTEA,
    is_encrypted BOOLEAN DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_scale_values_scale_id ON scale_values(scale_id, display_order);
```

**Design Decisions:**

1. **Normalized Structure**: Scale options stored separately from scales table.
   - **Rationale**: One scale can have multiple values (Yes/No, Excellent/Good/Fair/Poor)
   - **Benefit**: Update scale options without touching entries table

2. **Encrypted Fields**: `name` and `description` are BYTEA (encrypted).
   - **Rationale**: Client-side encryption for privacy
   - **Flag**: `is_encrypted` indicates if data is encrypted

3. **Display Order**: Ordering of scale values (e.g., Excellent before Good).

4. **Index Strategy**:
   - `idx_scale_values_scale_id`: Composite index for "get all values for scale, ordered" queries

**Query Patterns:**
- Scale values: `SELECT * FROM scale_values WHERE scale_id = ? ORDER BY display_order` (uses idx_scale_values_scale_id)

### 5.3. Entry & History Tables

#### entries

**Purpose**: Store actual deed entries/records made by users (daily recordings).

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

**Design Decisions:**

1. **Dual Measurement**: Entries support both scale-based (`scale_value_id`) and count-based (`count_value`) measurements.
   - **CHECK Constraint**: Ensures exactly one value is set (mutually exclusive)
   - **Rationale**: Different deeds require different measurement methods

2. **Large Count Support**: `count_value` is `DECIMAL(15,2)` (supports millions/thousands).
   - **Rationale**: Some deeds may require large numeric values (e.g., charity amounts)

3. **Permission Tracking**: `created_by_user_id` tracks who created the entry.
   - **Rationale**: Friends with write permission can create entries for users
   - **NULL**: Indicates entry created by owner

4. **RESTRICT Delete**: `deed_item_id` uses RESTRICT (not CASCADE).
   - **Rationale**: Prevent accidental deletion of deed items with existing entries
   - **Trade-off**: Must delete entries first, then deed item

5. **Index Strategy**:
   - `idx_entries_user_date`: **Critical** for dashboard queries ("get user's entries for date range")
   - `idx_entries_deed_item`: For deed-specific analytics
   - `idx_entries_date_range`: Partial index for recent entries only (performance optimization)
   - `idx_entries_created_by`: For permission-based entry queries

**Query Patterns:**
- Dashboard: `SELECT * FROM entries WHERE user_id = ? AND entry_date >= ? AND entry_date <= ? ORDER BY entry_date DESC` (uses idx_entries_user_date)
- Deed analytics: `SELECT * FROM entries WHERE deed_item_id = ? ORDER BY entry_date DESC` (uses idx_entries_deed_item)
- Recent entries: `SELECT * FROM entries WHERE entry_date >= CURRENT_DATE - INTERVAL '30 days'` (uses idx_entries_date_range)

#### entry_history

**Purpose**: Track all changes to entries for audit trail (created/updated only, no deletes).

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
CREATE INDEX idx_entry_history_entry_user ON entry_history(entry_id, user_id, created_at DESC);
CREATE INDEX idx_entry_history_user_id ON entry_history(user_id, created_at DESC);
CREATE INDEX idx_entry_history_date ON entry_history(created_at DESC);
```

**Design Decisions:**

1. **No Deletes**: Only 'created' and 'updated' change types (entries cannot be deleted).
   - **Rationale**: Preserve complete audit trail
   - **Alternative**: Use `is_active = FALSE` on entries for soft disabling

2. **Permission Tracking**: `changed_by_user_id` tracks who made the change.
   - **Rationale**: Audit trail for permission-based entries

3. **Index Strategy**:
   - `idx_entry_history_entry_user`: **Critical** composite index for "get history of specific entry by specific user" (most common pattern)
   - `idx_entry_history_user_id`: For "get all history for user" queries
   - `idx_entry_history_date`: For date-range audit queries

**Query Patterns:**
- Entry history: `SELECT * FROM entry_history WHERE entry_id = ? AND user_id = ? ORDER BY created_at DESC` (uses idx_entry_history_entry_user)
- User history: `SELECT * FROM entry_history WHERE user_id = ? ORDER BY created_at DESC` (uses idx_entry_history_user_id)

### 5.4. Social & Permissions Tables

#### relations

**Purpose**: Unidirectional user connections (requester → requestee).

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
CREATE INDEX idx_relations_requester ON relations(requester_id, status);
CREATE INDEX idx_relations_requester_id ON relations(requester_id) WHERE status IN ('pending', 'accepted');
CREATE INDEX idx_relations_requestee ON relations(requestee_id, status);
CREATE INDEX idx_relations_requestee_id ON relations(requestee_id) WHERE status IN ('pending', 'accepted');
CREATE INDEX idx_relations_accepted ON relations(requester_id, requestee_id) WHERE status = 'accepted';
CREATE INDEX idx_relations_accepted_reverse ON relations(requestee_id, requester_id) WHERE status = 'accepted';
```

**Design Decisions:**

1. **Unidirectional**: Relations are one-way (requester → requestee).
   - **Rationale**: Clear permission model (requester gets access to requestee's data, not vice versa)
   - **Example**: If Ahmad requests Ali and Ali accepts, Ahmad can access Ali's data, but Ali cannot access Ahmad's data unless Ali separately requests Ahmad

2. **Status Management**: Four states (pending, accepted, rejected, blocked).
   - **Rationale**: Clear workflow, supports blocking functionality

3. **Self-Relation Prevention**: CHECK constraint prevents users from connecting to themselves.

4. **Index Strategy**:
   - **Bidirectional Lookups**: Separate indexes for requester and requestee queries
   - **Partial Indexes**: Filter out rejected/blocked statuses for common queries
   - **Accepted Connections**: Separate indexes for both directions (for permission checks)

**Query Patterns:**
- Who I requested: `SELECT * FROM relations WHERE requester_id = ? AND status IN ('pending', 'accepted')` (uses idx_relations_requester_id)
- Who requested me: `SELECT * FROM relations WHERE requestee_id = ? AND status IN ('pending', 'accepted')` (uses idx_relations_requestee_id)
- All relations: `SELECT * FROM relations WHERE requester_id = ? UNION SELECT * FROM relations WHERE requestee_id = ?` (uses both indexes)
- Permission check: `SELECT * FROM relations WHERE requester_id = ? AND requestee_id = ? AND status = 'accepted'` (uses idx_relations_accepted)

#### permissions

**Purpose**: Grant read/write access to specific deed items for connected users.

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

**Design Decisions:**

1. **Granular Permissions**: Permissions are per deed item, not per deed.
   - **Rationale**: Fine-grained access control (user can share specific items, not entire deeds)

2. **One Write Permission**: Only one user can have write permission per deed item.
   - **Rationale**: Prevents conflicts, ensures accountability
   - **Enforcement**: Application-level (database allows multiple, application validates)

3. **Multiple Read Permissions**: Any number of users can have read permission.
   - **Rationale**: Supports family/mentor scenarios (multiple observers)

4. **Links to Relations**: Permissions linked through `relation_id`, not direct user references.
   - **Rationale**: Better normalization, supports relation history

5. **Index Strategy**:
   - `idx_permissions_relation`: For "get all permissions for a relation" queries
   - `idx_permissions_deed_item`: For "get all users with permission for deed item" queries
   - `idx_permissions_type`: Partial index for permission checks (most common query)

**Query Patterns:**
- Permission check: `SELECT * FROM permissions WHERE deed_item_id = ? AND permission_type = 'write' AND is_active = TRUE` (uses idx_permissions_type)
- Relation permissions: `SELECT * FROM permissions WHERE relation_id = ? AND is_active = TRUE` (uses idx_permissions_relation)

### 5.5. Progress Tracking Tables

#### merits

**Purpose**: Deed-specific achievements/progress markers.

```sql
CREATE TYPE merit_category_enum AS ENUM ('positive', 'negative');
CREATE TYPE merit_type_enum AS ENUM ('AND', 'OR');

CREATE TABLE merits (
    merit_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    deed_item_id BIGINT NOT NULL REFERENCES deed_items(deed_item_id) ON DELETE CASCADE,
    title BYTEA NOT NULL,
    description BYTEA,
    is_encrypted BOOLEAN DEFAULT FALSE,
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

**Design Decisions:**

1. **Deed-Specific**: Each merit is linked to a specific `deed_item_id`.
   - **Rationale**: Merits track progress on individual deeds, not across multiple deeds

2. **AND/OR Logic**: `type` field determines completion logic.
   - **AND**: All merit_items must be completed
   - **OR**: Any merit_item can fulfill the merit

3. **Completion Tracking**: `end_date` set when `is_active = FALSE`.
   - **CHECK Constraint**: Ensures `end_date` is set when merit is completed
   - **Rationale**: Track completion dates for analytics

4. **Encrypted Fields**: `title` and `description` are BYTEA (encrypted).

5. **Index Strategy**:
   - `idx_merits_user`: For "get all active merits for user" queries
   - `idx_merits_deed_item`: For deed-specific merit queries
   - `idx_merits_category`: Partial index for category filtering

**Query Patterns:**
- User merits: `SELECT * FROM merits WHERE user_id = ? AND is_active = TRUE` (uses idx_merits_user)
- Deed merits: `SELECT * FROM merits WHERE deed_item_id = ? AND is_active = TRUE` (uses idx_merits_deed_item)

#### merit_items

**Purpose**: Components/steps within merits.

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

**Design Decisions:**

1. **Dual Measurement**: Merit items support both count-based and scale-based targets.
   - **CHECK Constraint**: Ensures exactly one target is defined

2. **RESTRICT Delete**: `deed_item_id` uses RESTRICT (not CASCADE).
   - **Rationale**: Prevent deletion of deed items referenced by active merits

3. **Index Strategy**:
   - `idx_merit_items_merit`: For "get all items for merit" queries
   - `idx_merit_items_deed_item`: For progress calculation queries

**Query Patterns:**
- Merit items: `SELECT * FROM merit_items WHERE merit_id = ?` (uses idx_merit_items_merit)
- Progress calculation: `SELECT * FROM merit_items WHERE deed_item_id = ?` (uses idx_merit_items_deed_item)

#### targets

**Purpose**: User goals spanning multiple deeds.

```sql
CREATE TABLE targets (
    target_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title BYTEA NOT NULL,
    description BYTEA,
    is_encrypted BOOLEAN DEFAULT FALSE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT target_end_date_when_inactive CHECK (is_active = TRUE OR end_date IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_targets_user ON targets(user_id, is_active);
CREATE INDEX idx_targets_active ON targets(is_active, user_id) WHERE is_active = TRUE;
```

**Design Decisions:**

1. **Multi-Deed Goals**: Targets can span multiple deeds (via `target_items`).
   - **Rationale**: Supports broader goals (e.g., "Complete 20 Sunnat prayers across all prayer types")

2. **Completion Tracking**: `end_date` set when `is_active = FALSE`.
   - **CHECK Constraint**: Ensures `end_date` is set when target is completed

3. **Encrypted Fields**: `title` and `description` are BYTEA (encrypted).

4. **Index Strategy**:
   - `idx_targets_user`: For "get all active targets for user" queries
   - `idx_targets_active`: Partial index for active targets only

**Query Patterns:**
- User targets: `SELECT * FROM targets WHERE user_id = ? AND is_active = TRUE` (uses idx_targets_user)

#### target_items

**Purpose**: Components/steps within targets.

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

**Design Decisions:**

1. **Similar to Merit Items**: Same structure as `merit_items` for consistency.
   - **Rationale**: Unified progress tracking model

2. **Multi-Deed Support**: Target items can reference different `deed_item_id`s.
   - **Rationale**: Supports goals spanning multiple deeds

3. **Index Strategy**:
   - `idx_target_items_target`: For "get all items for target" queries
   - `idx_target_items_deed_item`: For progress calculation queries

**Query Patterns:**
- Target items: `SELECT * FROM target_items WHERE target_id = ?` (uses idx_target_items_target)

### 5.6. Communication Tables

#### reflection_messages

**Purpose**: Daily reflections for Hasanaat and Saiyyiaat.

```sql
CREATE TYPE reflection_type_enum AS ENUM ('hasanaat', 'saiyyiaat');

CREATE TABLE reflection_messages (
    reflection_message_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type reflection_type_enum NOT NULL,
    message BYTEA NOT NULL,
    is_encrypted BOOLEAN DEFAULT FALSE,
    reflection_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_reflection_date_type UNIQUE (user_id, reflection_date, type)
);
```

**Design Decisions:**

1. **One Per Type Per Day**: UNIQUE constraint ensures one reflection per type per day.
   - **Rationale**: Encourages daily reflection, prevents duplicates

2. **Encrypted Field**: `message` is BYTEA (encrypted).

3. **Index Strategy**:
   - **Note**: UNIQUE constraint automatically creates index on `(user_id, reflection_date, type)`
   - **Optional**: If queries frequently filter by `(user_id, type)` and order by `reflection_date DESC`, consider: `CREATE INDEX idx_reflection_user_type_date ON reflection_messages(user_id, type, reflection_date DESC);`

**Query Patterns:**
- Daily reflection: `SELECT * FROM reflection_messages WHERE user_id = ? AND reflection_date = ? AND type = ?` (uses unique constraint's index)
- Reflection history: `SELECT * FROM reflection_messages WHERE user_id = ? AND type = ? ORDER BY reflection_date DESC` (may benefit from optional index)

#### messages

**Purpose**: In-app support chat.

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

**Design Decisions:**

1. **Status Tracking**: Four states (sent, delivered, read, none).
   - **Rationale**: Support chat workflow (track message delivery and read status)

2. **Sender Indicator**: `is_from_user` boolean (clearer than string field).
   - **Rationale**: Simple boolean, no ENUM needed

3. **Index Strategy**:
   - `idx_messages_user`: For "get all messages for user" queries (ordered by time)
   - `idx_messages_status`: Partial index for unread messages (common query pattern)

**Query Patterns:**
- User messages: `SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC` (uses idx_messages_user)
- Unread messages: `SELECT * FROM messages WHERE status != 'read' AND user_id = ?` (uses idx_messages_status)

#### notifications

**Purpose**: User-set daily reminders.

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

**Design Decisions:**

1. **One Per User**: UNIQUE constraint on `user_id` ensures one notification setting per user.
   - **Rationale**: Simple reminder system (one time per day)

2. **Timezone Support**: `timezone` field for accurate scheduling.
   - **Rationale**: Global app support (users in different timezones)

3. **Index Strategy**:
   - `idx_notifications_time`: For scheduling queries ("get all users who need notification at this time")

**Query Patterns:**
- User notification: `SELECT * FROM notifications WHERE user_id = ?` (uses unique constraint's index)
- Scheduling: `SELECT * FROM notifications WHERE notification_time = ? AND timezone = ?` (uses idx_notifications_time)

### 5.7. Encryption Tables

#### encrypted_keys

**Purpose**: Store encrypted DEKs (Data Encryption Keys) per user per data item for client-side encryption.

```sql
CREATE TABLE encrypted_keys (
    key_id BIGSERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL, -- 'deed_item', 'scale_value', 'merit', 'target', 'reflection_message'
    reference_id BIGINT NOT NULL, -- Links to deed_item_id, scale_value_id, merit_id, target_id, reflection_message_id
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    encrypted_dek BYTEA NOT NULL, -- DEK encrypted with user's KEK
    iv BYTEA NOT NULL, -- IV for DEK encryption (12 bytes for AES-GCM)
    data_iv BYTEA NOT NULL, -- IV for data encryption (12 bytes, stored here for convenience)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_data_type CHECK (data_type IN ('deed_item', 'scale_value', 'merit', 'target', 'reflection_message')),
    UNIQUE(data_type, reference_id, user_id)
);

-- Indexes
CREATE INDEX idx_encrypted_keys_reference ON encrypted_keys(data_type, reference_id);
CREATE INDEX idx_encrypted_keys_user ON encrypted_keys(user_id);
CREATE INDEX idx_encrypted_keys_data_user ON encrypted_keys(data_type, reference_id, user_id);
```

**Design Decisions:**

1. **One-to-Many Relationship**: One encrypted data item can have multiple `encrypted_keys` rows (one per authorized user).
   - **Rationale**: Supports data sharing (owner + friends can decrypt same data with their own keys)

2. **Same DEK, Multiple Encryptions**: The DEK (Data Encryption Key) is never re-encrypted; only the encrypted DEK is stored multiple times (once per authorized user).
   - **Rationale**: Efficient sharing (data encrypted once, DEK encrypted per user)
   - **Benefit**: Data never re-encrypted when sharing

3. **Data Mapping**: `data_type` + `reference_id` maps to specific data items.
   - `data_type = 'deed_item'` → `reference_id` = `deed_item_id`
   - `data_type = 'scale_value'` → `reference_id` = `scale_value_id`
   - `data_type = 'merit'` → `reference_id` = `merit_id`
   - `data_type = 'target'` → `reference_id` = `target_id`
   - `data_type = 'reflection_message'` → `reference_id` = `reflection_message_id`

4. **Index Strategy**:
   - `idx_encrypted_keys_reference`: For "get all users with access to a data item" queries
   - `idx_encrypted_keys_user`: For "get all keys for a user" queries (find all data items user can decrypt)
   - `idx_encrypted_keys_data_user`: For "get specific user's key on specific data item" queries (most common)

**Query Patterns:**
- Get user's key: `SELECT * FROM encrypted_keys WHERE data_type = ? AND reference_id = ? AND user_id = ?` (uses idx_encrypted_keys_data_user)
- Get all keys for user: `SELECT * FROM encrypted_keys WHERE user_id = ?` (uses idx_encrypted_keys_user)
- Get all users with access: `SELECT * FROM encrypted_keys WHERE data_type = ? AND reference_id = ?` (uses idx_encrypted_keys_reference)

---

## 6. Relationships & Constraints

This section explains the foreign key strategy, constraint types, and their enforcement mechanisms.

### 6.1. Foreign Key Strategy

All relationships in the Kitaab database use foreign keys with appropriate CASCADE/RESTRICT rules:

#### CASCADE Delete Rules
Used when child data has no meaning without parent:

- `users` → `deeds` (CASCADE): User deletion removes all their deeds
- `deeds` → `deed_items` (CASCADE): Deed deletion removes all items
- `deed_items` → `deed_items` (CASCADE): Parent deletion removes children (hierarchical)
- `deeds` → `scales` (CASCADE): Deed deletion removes scales
- `scales` → `scale_values` (CASCADE): Scale deletion removes values
- `users` → `entries` (CASCADE): User deletion removes entries
- `entries` → `entry_history` (CASCADE): Entry deletion removes history
- `users` → `relations` (CASCADE): User deletion removes relations
- `relations` → `permissions` (CASCADE): Relation deletion removes permissions
- `users` → `merits/targets` (CASCADE): User deletion removes progress tracking
- `merits` → `merit_items` (CASCADE): Merit deletion removes items
- `targets` → `target_items` (CASCADE): Target deletion removes items
- `users` → `encrypted_keys` (CASCADE): User deletion removes encryption keys

**Rationale**: These represent ownership relationships where child data is meaningless without parent.

#### RESTRICT Delete Rules
Used when child data must exist for referential integrity:

- `deed_items` → `entries` (RESTRICT): Cannot delete deed item with existing entries
- `deed_items` → `merit_items` (RESTRICT): Cannot delete deed item referenced by merits
- `deed_items` → `target_items` (RESTRICT): Cannot delete deed item referenced by targets
- `deed_items` → `permissions` (RESTRICT): Cannot delete deed item with active permissions

**Rationale**: Prevents accidental deletion of referenced data. Application must delete dependent records first.

#### SET NULL Delete Rules
Used for optional references:

- `scale_values` → `entries` (SET NULL): Scale value deletion sets entry.scale_value_id to NULL
- `users` → `entries.created_by_user_id` (SET NULL): User deletion sets created_by to NULL (preserves entry)

**Rationale**: Preserves parent data when optional reference is deleted.

### 6.2. Check Constraints

CHECK constraints validate data at the database level, preventing invalid states:

#### Entry Value Validation
```sql
CONSTRAINT entry_has_value CHECK (
    (scale_value_id IS NOT NULL AND count_value IS NULL) OR 
    (scale_value_id IS NULL AND count_value IS NOT NULL)
)
```
**Purpose**: Ensures exactly one value type is set (mutually exclusive).

#### Merit/Target Item Validation
```sql
CONSTRAINT merit_item_has_target CHECK (
    (count IS NOT NULL) OR (scale_value_id IS NOT NULL)
)
```
**Purpose**: Ensures merit/target item has a target defined.

#### Date Range Validation
```sql
CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
```
**Purpose**: Ensures end_date is not before start_date.

#### Self-Relation Prevention
```sql
CONSTRAINT no_self_relation CHECK (requester_id != requestee_id)
```
**Purpose**: Prevents users from connecting to themselves.

#### Completion Date Validation
```sql
CONSTRAINT merit_end_date_when_inactive CHECK (is_active = TRUE OR end_date IS NOT NULL)
```
**Purpose**: Ensures completion date is set when merit/target is deactivated.

#### Hierarchy Validation (Application-Level)
The 3-level hierarchy limit is enforced at the application level, not database level:
- **Rationale**: Database constraints would require complex recursive checks
- **Benefit**: Better error messages, easier to adjust limits
- **Implementation**: Frontend/backend API validates hierarchy depth before insert

### 6.3. Unique Constraints

UNIQUE constraints prevent duplicate data:

#### User-Level Uniqueness
- `users.email`: One email per user
- `notifications.user_id`: One notification setting per user
- `entries(user_id, deed_item_id, entry_date)`: One entry per deed item per day
- `reflection_messages(user_id, reflection_date, type)`: One reflection per type per day
- `relations(requester_id, requestee_id)`: One relation per user pair
- `permissions(relation_id, deed_item_id, permission_type)`: One permission per relation+deed_item+type
- `encrypted_keys(data_type, reference_id, user_id)`: One key per user per data item
- `deed_items(deed_id, parent_deed_item_id, name)`: Unique name per parent
- `deed_items(deed_id, parent_deed_item_id, display_order)`: Unique display_order per parent (DEFERRABLE)
- `scales(deed_id, version)`: Unique version per deed

**Rationale**: Prevents data duplication and ensures data integrity.

### 6.4. Enum Types

ENUM types ensure only valid values are stored:

#### Defined ENUMs
- `gender_enum`: 'male', 'female'
- `deed_category_type`: 'hasanaat', 'saiyyiaat'
- `hide_type_enum`: 'none', 'hide_from_all', 'hide_from_graphs'
- `relation_status_enum`: 'pending', 'accepted', 'rejected', 'blocked'
- `permission_type_enum`: 'read', 'write'
- `reflection_type_enum`: 'hasanaat', 'saiyyiaat'
- `message_status_enum`: 'sent', 'delivered', 'read', 'none'
- `change_type_enum`: 'created', 'updated'
- `merit_category_enum`: 'positive', 'negative'
- `merit_type_enum`: 'AND', 'OR'

**Benefits**:
- **Storage Efficiency**: 4 bytes vs variable VARCHAR
- **Type Safety**: Database-level validation
- **Query Performance**: Faster comparisons than string matching
- **Data Integrity**: Prevents invalid values

**When to Use ENUMs**:
- Fixed set of values (not expected to change frequently)
- Values used in WHERE clauses frequently
- Storage efficiency matters

**When NOT to Use ENUMs**:
- Values may change frequently (requires ALTER TYPE)
- Need to support user-defined values
- Values are rarely queried

### 6.5. Hierarchy Validation

The deed_items hierarchy uses a self-referencing pattern with application-level validation:

#### Structure
```
Level 1: parent_deed_item_id IS NULL
  └─ Level 2: parent_deed_item_id = Level 1 item
      └─ Level 3: parent_deed_item_id = Level 2 item
```

#### Validation Approach
- **Database**: No explicit level limit (allows flexibility)
- **Application**: Validates 3-level limit before insert/update
- **Rationale**: Better error messages, easier to adjust limits

#### Implementation Example (Application-Level)
```python
def validate_hierarchy_depth(deed_item_id, parent_deed_item_id):
    """Validate that hierarchy depth does not exceed 3 levels."""
    if parent_deed_item_id is None:
        return True  # Level 1
    
    # Traverse up tree to count levels
    level = 1
    current_parent = parent_deed_item_id
    while current_parent is not None:
        level += 1
        if level > 3:
            raise ValueError("Hierarchy depth cannot exceed 3 levels")
        # Get parent's parent
        current_parent = get_parent_deed_item(current_parent)
    
    return True
```

---

## 7. Indexing Strategy

This section provides a comprehensive guide to indexing strategy, including when to index, when not to index, and how to measure index effectiveness.

### 7.1. Indexing Philosophy

**Core Principle**: Only create indexes that provide measurable value in production.

Indexes are not free:
- **Storage Cost**: Each index consumes disk space (can be significant for large tables)
- **Write Overhead**: Every INSERT/UPDATE/DELETE must update indexes
- **Maintenance Cost**: Indexes require periodic maintenance (VACUUM, REINDEX)

**Index Selection Criteria**:
1. **Query Frequency**: Index columns used in WHERE clauses of frequent queries
2. **Selectivity**: Index columns with high selectivity (many distinct values)
3. **Sorting**: Index columns used in ORDER BY clauses
4. **Joins**: Index foreign keys used in JOIN operations
5. **Covering Queries**: Indexes that cover entire queries (avoid table lookups)

### 7.2. Understanding Query Patterns

Before creating indexes, understand your query patterns:

#### Common Query Patterns in Kitaab

1. **Dashboard Queries** (Most Frequent)
   ```sql
   SELECT * FROM entries 
   WHERE user_id = ? AND entry_date >= ? AND entry_date <= ? 
   ORDER BY entry_date DESC;
   ```
   **Index**: `idx_entries_user_date` on `(user_id, entry_date DESC)`
   **Rationale**: Filters by user_id (high selectivity), orders by date

2. **Permission Checks** (High Frequency)
   ```sql
   SELECT * FROM permissions 
   WHERE relation_id = ? AND deed_item_id = ? AND is_active = TRUE;
   ```
   **Index**: `idx_permissions_relation` on `(relation_id, is_active)`
   **Rationale**: Frequent permission checks, filters by active status

3. **Hierarchy Queries** (Frequent)
   ```sql
   SELECT * FROM deed_items 
   WHERE parent_deed_item_id = ? 
   ORDER BY display_order;
   ```
   **Index**: `idx_deed_items_parent` on `(parent_deed_item_id)`
   **Rationale**: Get children of parent, ordered by display_order

4. **User Lookups** (Very Frequent)
   ```sql
   SELECT * FROM users WHERE email = ?;
   ```
   **Index**: `idx_users_email` on `(email)`
   **Rationale**: Login queries, UNIQUE constraint also creates index

5. **Recent Data Queries** (Frequent)
   ```sql
   SELECT * FROM entries 
   WHERE entry_date >= CURRENT_DATE - INTERVAL '30 days';
   ```
   **Index**: `idx_entries_date_range` (partial index on recent dates only)
   **Rationale**: Most queries access recent data, partial index reduces size

### 7.3. Index Categories

#### Primary Key Indexes
All tables have primary key indexes (automatic in PostgreSQL):
- **Purpose**: Enforce uniqueness, optimize lookups by primary key
- **Example**: `users_pkey` on `user_id`
- **Note**: Always created automatically, no manual creation needed

#### Foreign Key Indexes
All foreign keys should be indexed for JOIN performance:

```sql
CREATE INDEX idx_deeds_user_id ON deeds(user_id);
CREATE INDEX idx_deed_items_deed_id ON deed_items(deed_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
```

**Rationale**: Foreign keys are frequently used in JOINs and WHERE clauses.

**Exception**: If foreign key is rarely queried and table has low write volume, index may not be needed. Measure first.

#### Composite Indexes
Optimized for multi-column queries:

```sql
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
CREATE INDEX idx_permissions_relation_deed ON permissions(relation_id, deed_item_id, is_active);
```

**Column Order Matters**:
1. **Most Selective First**: Put columns with highest selectivity first
2. **Equality Before Range**: Equality conditions before range conditions
3. **Order By Last**: ORDER BY columns at the end

**Example**:
```sql
-- Good: user_id is highly selective, entry_date is range
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);

-- Bad: entry_date first (less selective, range condition)
CREATE INDEX idx_entries_date_user ON entries(entry_date DESC, user_id);
```

#### Partial Indexes
Index only a subset of rows:

```sql
CREATE INDEX idx_scales_deed_id ON scales(deed_id) WHERE is_active = TRUE;
CREATE INDEX idx_entries_date_range ON entries(entry_date) 
    WHERE entry_date >= CURRENT_DATE - INTERVAL '1 year';
```

**Benefits**:
- **Smaller Index Size**: Only indexes relevant rows
- **Faster Queries**: Smaller index = faster scans
- **Reduced Maintenance**: Less overhead on writes

**When to Use**:
- Queries frequently filter by a boolean flag (e.g., `is_active = TRUE`)
- Queries frequently access recent data only
- Large tables where full index is unnecessary

#### Unique Constraint Indexes
UNIQUE constraints automatically create indexes:

```sql
CONSTRAINT unique_user_deed_item_date UNIQUE (user_id, deed_item_id, entry_date)
```

**Note**: No need to create separate index - UNIQUE constraint provides it.

**Example**: `deed_items` has UNIQUE constraint on `(deed_id, parent_deed_item_id, display_order)`, which automatically creates an index. No separate index needed.

### 7.4. Index Selection Criteria

#### When to Create an Index

1. **High Query Frequency**
   - Column used in WHERE clause of queries executed > 100 times/day
   - **Measure**: Use `pg_stat_statements` to identify frequent queries

2. **High Selectivity**
   - Column has many distinct values (e.g., `user_id`, `email`)
   - **Rule of Thumb**: If column has > 10% distinct values, index is likely beneficial

3. **Foreign Keys**
   - All foreign keys should be indexed (used in JOINs)
   - **Exception**: Rarely queried foreign keys in low-write tables

4. **Sorting/Ordering**
   - Columns used in ORDER BY clauses
   - **Composite Index**: Include ORDER BY columns in index for covering queries

5. **Partial Index Candidates**
   - Boolean flags frequently filtered (e.g., `is_active = TRUE`)
   - Time-based queries on recent data only

#### When NOT to Create an Index

1. **Low Selectivity**
   - Column has few distinct values (e.g., boolean with 50/50 distribution)
   - **Exception**: Partial indexes on boolean columns can be beneficial

2. **Low Query Frequency**
   - Column rarely used in WHERE clauses
   - **Measure**: Monitor query patterns before indexing

3. **High Write Volume, Low Read Volume**
   - Table with frequent INSERTs/UPDATEs but rarely queried
   - **Trade-off**: Index overhead may outweigh benefits

4. **Small Tables**
   - Tables with < 1000 rows (sequential scan is fast enough)
   - **Exception**: If table will grow, create index proactively

5. **Redundant Indexes**
   - Index that duplicates another index (e.g., `(a, b)` when `(a, b, c)` exists)
   - **Note**: PostgreSQL can use `(a, b, c)` for queries on `(a, b)`

6. **Covered by Unique Constraint**
   - Column already covered by UNIQUE constraint index
   - **Example**: `deed_items` UNIQUE constraint covers `(deed_id, parent_deed_item_id, display_order)` - no separate index needed

### 7.5. Index Maintenance

#### Monitoring Index Usage

```sql
-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

**Unused Indexes**: If `idx_scan = 0` for extended period, consider dropping index.

#### Monitoring Index Size

```sql
-- Check index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Large Indexes**: If index size > 10% of table size, consider partial indexes or partitioning.

#### Index Bloat

Indexes can become bloated over time (especially with frequent UPDATEs/DELETEs):

```sql
-- Check index bloat
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    pg_size_pretty(pg_stat_get_index_size(indexrelid)) as actual_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public';
```

**Maintenance**: Run `REINDEX` periodically (monthly) to rebuild fragmented indexes.

#### Vacuum and Analyze

```sql
-- Update statistics (run weekly)
VACUUM ANALYZE;

-- Rebuild specific index (run monthly)
REINDEX INDEX idx_entries_user_date;
```

**Schedule**:
- **VACUUM ANALYZE**: Weekly (updates statistics for query planner)
- **REINDEX**: Monthly (rebuilds fragmented indexes)
- **Auto-vacuum**: Enable auto-vacuum for continuous maintenance

### 7.6. Anti-Patterns: When NOT to Index

#### Anti-Pattern 1: Indexing Every Column

**Bad**:
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_full_name ON users(full_name);
CREATE INDEX idx_users_gender ON users(gender);
CREATE INDEX idx_users_date_of_birth ON users(date_of_birth);
CREATE INDEX idx_users_language ON users(language);
CREATE INDEX idx_users_theme ON users(theme);
CREATE INDEX idx_users_timezone ON users(timezone);
```

**Problem**: Most of these indexes are never used, wasting storage and write overhead.

**Good**: Only index columns used in frequent queries:
```sql
CREATE INDEX idx_users_email ON users(email); -- Login queries
CREATE INDEX idx_users_gender_age ON users(gender, date_of_birth); -- Analytics queries
-- No index on full_name, language, theme, timezone (rarely queried)
```

#### Anti-Pattern 2: Redundant Indexes

**Bad**:
```sql
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
```

**Problem**: `idx_entries_user_id` is redundant - PostgreSQL can use `idx_entries_user_date` for queries on `user_id` only.

**Good**: Only create the composite index:
```sql
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
```

#### Anti-Pattern 3: Indexing Low-Selectivity Columns

**Bad**:
```sql
CREATE INDEX idx_entries_is_active ON entries(is_active);
```

**Problem**: Boolean column with 50/50 distribution - index provides little benefit, sequential scan is often faster.

**Good**: Use partial index if queries frequently filter by active status:
```sql
CREATE INDEX idx_entries_active ON entries(user_id, entry_date) WHERE is_active = TRUE;
```

#### Anti-Pattern 4: Indexing Small Tables

**Bad**:
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
-- Table has < 100 rows
```

**Problem**: Sequential scan on small table is faster than index lookup.

**Good**: Only index if table will grow or queries are very frequent:
```sql
-- Wait until table grows, or if queries are extremely frequent
```

#### Anti-Pattern 5: Ignoring Query Patterns

**Bad**: Creating indexes without understanding actual query patterns.

**Good**: 
1. Monitor queries with `pg_stat_statements`
2. Identify slow queries with `EXPLAIN ANALYZE`
3. Create indexes based on actual patterns
4. Measure improvement with `EXPLAIN ANALYZE` before/after

### 7.7. Index Performance Measurement

#### Before Creating Index

```sql
-- Measure query performance
EXPLAIN ANALYZE
SELECT * FROM entries 
WHERE user_id = 123 AND entry_date >= '2024-01-01' 
ORDER BY entry_date DESC;
```

**Output**: Note execution time and plan (sequential scan vs index scan).

#### After Creating Index

```sql
-- Create index
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);

-- Measure again
EXPLAIN ANALYZE
SELECT * FROM entries 
WHERE user_id = 123 AND entry_date >= '2024-01-01' 
ORDER BY entry_date DESC;
```

**Expected Improvement**: 
- **Before**: Sequential scan, 100ms+
- **After**: Index scan, < 10ms

**If No Improvement**: Drop the index - it's not providing value.

#### Index Effectiveness Metrics

Monitor these metrics:
- **Index Scans**: `pg_stat_user_indexes.idx_scan` (should be > 0)
- **Index Size**: `pg_relation_size(indexrelid)` (should be reasonable)
- **Query Performance**: `EXPLAIN ANALYZE` execution time (should improve)

**Decision Rule**: If index is not used (`idx_scan = 0`) for 30+ days, drop it.

---

## 8. Client-Side Encryption

Kitaab implements client-side encryption to ensure that sensitive data (deed names, descriptions, reflection messages) cannot be decrypted by the server. The server stores only encrypted ciphertext and encrypted keys.

### 8.1. Encryption Architecture

#### Key Components

1. **Data Encryption Key (DEK)**: Random 256-bit AES-GCM key used to encrypt actual data
2. **Key Encryption Key (KEK)**: Derived from user password using PBKDF2 (100,000 iterations, SHA-256)
3. **Encrypted DEK**: DEK encrypted with user's KEK, stored in `encrypted_keys` table
4. **Ciphertext**: Encrypted data stored in original tables (e.g., `deed_items.name` as BYTEA)

#### Encryption Flow

```
1. Generate random DEK (256-bit AES-GCM key)
2. Encrypt data with DEK → Store ciphertext in original table
3. Derive KEK from user password + salt (PBKDF2)
4. Encrypt DEK with KEK → Store encrypted DEK in encrypted_keys table
5. Store IVs (12 bytes each for DEK encryption and data encryption)
```

#### Decryption Flow

```
1. User provides password
2. Derive KEK from password + salt (PBKDF2)
3. Decrypt encrypted DEK with KEK → Get DEK
4. Decrypt ciphertext with DEK → Get plaintext
```

### 8.2. Key Management

#### User Salt
- **Storage**: `users.encryption_salt` (BYTEA, 16 bytes)
- **Purpose**: Unique salt per user for PBKDF2 key derivation
- **Generation**: Random 16 bytes generated during user registration

#### Encrypted Keys Table
The `encrypted_keys` table stores encrypted DEKs per user per data item:

- **One-to-Many**: One data item can have multiple `encrypted_keys` rows (one per authorized user)
- **Owner**: Creates data → Gets first row (DEK encrypted with owner's password)
- **Friends**: When data is shared → Get additional rows (same DEK encrypted with each friend's password)
- **Same DEK**: The DEK is never re-encrypted; only the encrypted DEK is stored multiple times

#### Data Sharing Model

When sharing encrypted data with a friend:

1. **Owner decrypts DEK** (using owner's password)
2. **Friend provides password** (for key derivation)
3. **Re-encrypt same DEK** with friend's KEK
4. **Store new row** in `encrypted_keys` table (same DEK, encrypted with friend's password)

**Key Point**: The encrypted data (ciphertext) in original tables **never changes** - only the encrypted DEK is stored multiple times (once per authorized user).

### 8.3. Implementation Details

#### Encryption Algorithm
- **Algorithm**: AES-GCM 256-bit
- **IV Size**: 12 bytes (96 bits)
- **Key Derivation**: PBKDF2 with 100,000 iterations, SHA-256

#### Encrypted Fields
The following fields are encrypted (stored as BYTEA):
- `deed_items.name`, `deed_items.description`
- `scale_values.name`, `scale_values.description`
- `merits.title`, `merits.description`
- `targets.title`, `targets.description`
- `reflection_messages.message`

#### Encryption Flag
Each table with encrypted fields has an `is_encrypted` boolean flag:
- `is_encrypted = TRUE`: Data is encrypted (BYTEA contains ciphertext)
- `is_encrypted = FALSE`: Data is plaintext (for backward compatibility during migration)

#### Storage Mapping

- **Ciphertext**: Stored in original table columns as BYTEA
- **Encrypted DEK**: Stored in `encrypted_keys.encrypted_dek` as BYTEA
- **DEK IV**: Stored in `encrypted_keys.iv` as BYTEA (12 bytes)
- **Data IV**: Stored in `encrypted_keys.data_iv` as BYTEA (12 bytes)
- **User Salt**: Stored in `users.encryption_salt` as BYTEA (16 bytes)

### 8.4. Security Considerations

#### Server Cannot Decrypt
- Server never has access to user passwords
- Server cannot derive KEK without password
- Server cannot decrypt DEK without KEK
- Server cannot decrypt data without DEK

#### Password Requirements
- Strong passwords recommended (enforced at application level)
- Password reset invalidates all encrypted keys (user must re-encrypt with new password)

#### Key Rotation
- **Password Change**: User must re-encrypt all DEKs with new password
- **Sharing Revocation**: Delete `encrypted_keys` row for revoked user
- **Data Re-encryption**: Not required (DEK stays same, only encrypted DEK changes)

---

## 9. Access Control & Permissions

Kitaab implements a granular permission system that allows users to share specific deed items with connected users, with read-only or read-write access.

### 9.1. Permission Model

#### Permission Types
- **read**: User can view entries for the deed item
- **write**: User can create/update entries for the deed item

#### Permission Rules
1. **One Write Permission**: Only one user can have write permission per deed item (enforced at application level)
2. **Multiple Read Permissions**: Any number of users can have read permission
3. **Granular Control**: Permissions are per deed item, not per deed (fine-grained access)

#### Permission Lifecycle
1. **Connection Request**: User A sends connection request to User B
2. **Connection Acceptance**: User B accepts request (relation status = 'accepted')
3. **Permission Grant**: User B grants permission to User A for specific deed items
4. **Permission Usage**: User A can view/create entries based on permission type
5. **Permission Revocation**: User B can revoke permission (set `is_active = FALSE`)

### 9.2. Unidirectional Relations

#### Direction Matters
Relations are **one-way** (requester → requestee):
- If Ahmad requests Ali and Ali accepts:
  - Ahmad can access Ali's data (if Ali grants permission)
  - Ali **cannot** access Ahmad's data (unless Ali separately requests Ahmad)

#### Why Unidirectional?
- **Clear Permission Model**: Direction determines who can access whose data
- **Privacy Control**: Users control who can access their data
- **Accountability**: Clear ownership and access boundaries

#### Bidirectional Access
If both users want to access each other's data:
- User A requests User B → User B accepts → User B grants permission to User A
- User B requests User A → User A accepts → User A grants permission to User B
- Result: Two separate relations, each with their own permissions

### 9.3. Permission Enforcement

#### Permission Check Flow

```sql
-- Step 1: Check if relation exists and is accepted
SELECT * FROM relations 
WHERE requester_id = :requester_user_id 
  AND requestee_id = :owner_user_id 
  AND status = 'accepted';

-- Step 2: Check if permission exists and is active
SELECT * FROM permissions
WHERE relation_id = :relation_id
  AND deed_item_id = :deed_item_id
  AND is_active = TRUE;

-- Step 3: Check permission type
IF permission_type = 'read':
    -- Allow SELECT queries only
ELSE IF permission_type = 'write':
    -- Allow SELECT, INSERT, UPDATE queries
    -- Set created_by_user_id = requester_user_id
ELSE:
    -- Deny access
```

#### Entry Creation with Permissions

When a user with write permission creates an entry:
- `user_id` = Owner of the deed item (entry belongs to owner)
- `created_by_user_id` = User who created the entry (permission-based entry)
- **Rationale**: Tracks who created the entry while maintaining ownership

#### Application-Level Enforcement

Permission checks should be enforced at the application level:
1. **API Middleware**: Check permissions before allowing operations
2. **Query Filtering**: Filter results based on permissions
3. **Audit Logging**: Log permission-based operations

**Database-Level**: Foreign keys and constraints ensure data integrity, but permission logic is application-level.

---

## 10. Migration Strategy

### 10.1. Migration Planning

#### Pre-Migration Checklist
1. **Backup Current Database**: Full backup before any changes
2. **Test on Staging**: Test all migrations on staging environment
3. **Document Rollback**: Prepare rollback procedures
4. **Communication**: Notify users of maintenance window (if needed)

#### Migration Phases

**Phase 1: Add New Fields (Non-Breaking)**
- Add `encryption_salt` to users table
- Add `is_encrypted` flags to tables with encrypted fields
- Add `created_by_user_id` to entries table
- Add `end_date` to merits/targets tables

**Phase 2: Create New Tables**
- Create `scale_values` table
- Create `encrypted_keys` table
- Create ENUM types

**Phase 3: Migrate Data**
- Populate `scale_values` from existing scale data
- Update entries to reference `scale_value_id`
- Migrate hierarchy relationships (add `parent_deed_item_id`)

**Phase 4: Add Constraints**
- Add foreign key constraints
- Add CHECK constraints
- Add UNIQUE constraints

**Phase 5: Create Indexes**
- Create all recommended indexes
- Monitor query performance
- Adjust indexes based on usage patterns

### 10.2. Schema Evolution

#### Adding New Columns
```sql
-- Add column with default (non-breaking)
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
```

#### Adding New Tables
```sql
-- Create new table (non-breaking)
CREATE TABLE encrypted_keys (...);
```

#### Modifying Constraints
```sql
-- Add constraint (may fail if data violates constraint)
ALTER TABLE entries ADD CONSTRAINT entry_has_value CHECK (...);
```

### 10.3. Data Migration

#### Scale Values Migration
```sql
-- Step 1: Populate scale_values from existing data
INSERT INTO scale_values (scale_id, name, display_order)
SELECT DISTINCT scale_id, scale_value, 0
FROM entries
WHERE scale_value IS NOT NULL;

-- Step 2: Update entries to reference scale_value_id
UPDATE entries e
SET scale_value_id = sv.scale_value_id
FROM scale_values sv
WHERE e.scale_id = sv.scale_id 
  AND e.scale_value = sv.name;
```

#### Hierarchy Migration
```sql
-- Add parent_deed_item_id based on level
UPDATE deed_items di
SET parent_deed_item_id = (
    SELECT parent.deed_item_id
    FROM deed_items parent
    WHERE parent.deed_id = di.deed_id
      AND parent.level = di.level - 1
      AND parent.display_order < di.display_order
    ORDER BY parent.display_order DESC
    LIMIT 1
)
WHERE di.level > 1;
```

### 10.4. Rollback Procedures

#### If Migration Fails
1. **Stop Application**: Prevent new writes
2. **Restore Backup**: `pg_restore -d kitaab_db backup.dump`
3. **Revert Code**: Deploy previous application version
4. **Resume Traffic**: Restart application
5. **Investigate**: Fix issues, retry migration

#### Partial Rollback
If migration partially succeeds:
1. **Identify Failed Steps**: Check migration logs
2. **Rollback Failed Steps**: Reverse specific changes
3. **Fix Issues**: Address root cause
4. **Retry**: Resume from failed step

---

## 11. Performance Optimization

### 11.1. Query Optimization

#### Dashboard Query Optimization
```sql
-- Optimized dashboard query
SELECT e.*, di.name, d.category_type
FROM entries e
JOIN deed_items di ON e.deed_item_id = di.deed_item_id
JOIN deeds d ON di.deed_id = d.deed_id
WHERE e.user_id = :user_id
  AND e.entry_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY e.entry_date DESC
LIMIT 100;

-- Uses: idx_entries_user_date (composite index)
-- Performance: < 50ms (p95)
```

#### Permission Check Optimization
```sql
-- Optimized permission check
SELECT p.*
FROM permissions p
JOIN relations r ON p.relation_id = r.relation_id
WHERE r.requester_id = :requester_id
  AND r.requestee_id = :owner_id
  AND r.status = 'accepted'
  AND p.deed_item_id = :deed_item_id
  AND p.is_active = TRUE;

-- Uses: idx_permissions_relation, idx_relations_accepted
-- Performance: < 5ms (p95)
```

### 11.2. Connection Pooling

#### PostgreSQL Connection Pool Configuration
```python
import psycopg2.pool

pool_config = {
    'minconn': 5,
    'maxconn': 20,
    'host': 'localhost',
    'port': 5432,
    'database': 'kitaab',
    'user': 'kitaab_user',
    'password': 'secure_password',
    'connect_timeout': 10
}

connection_pool = psycopg2.pool.ThreadedConnectionPool(**pool_config)
```

**Benefits**:
- Reduces connection overhead
- Handles concurrent requests efficiently
- Automatic connection health checks

### 11.3. Caching Strategy

#### Redis Caching Layers

1. **User Session Cache**
   - Key: `user:{user_id}:session`
   - TTL: 24 hours
   - Stores: User preferences, active permissions

2. **Dashboard Cache**
   - Key: `user:{user_id}:dashboard:{date_range}`
   - TTL: 5 minutes
   - Stores: Aggregated entry data

3. **Permission Cache**
   - Key: `permission:{relation_id}:{deed_item_id}`
   - TTL: 1 hour
   - Stores: Permission lookups

#### Cache Invalidation
- On entry creation/update: Invalidate dashboard cache
- On permission change: Invalidate permission cache
- On deed_item change: Invalidate hierarchy cache

### 11.4. Partitioning Strategy

#### Date-Based Partitioning (Future)

For tables expected to grow large (entries, entry_history), consider partitioning:

```sql
-- Partition entries by year
CREATE TABLE entries (
    ...
) PARTITION BY RANGE (entry_date);

CREATE TABLE entries_2024 PARTITION OF entries
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE entries_2025 PARTITION OF entries
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

**Benefits**:
- Faster queries on recent data
- Easier data archival
- Parallel query execution
- Reduced index size per partition

**When to Implement**: When entries table exceeds 10M rows or queries slow down.

---

## 12. Scalability Considerations

### 12.1. Horizontal Scaling

#### Read Replicas
- **Setup**: PostgreSQL streaming replication
- **Use Cases**: Dashboard queries, analytics queries, reporting
- **Routing**: Route read queries to replicas, write queries to primary

#### Sharding (Future)
- **Strategy**: User-based sharding (shard by `user_id`)
- **When**: When single database cannot handle load (1M+ users)
- **Challenges**: Cross-shard queries (e.g., relations between users)

### 12.2. Vertical Scaling

#### Database Server Optimization
- **RAM**: Increase for larger shared_buffers (25% of RAM)
- **Storage**: Use SSD for better I/O
- **CPU**: Multi-core for parallel queries

#### PostgreSQL Configuration
```ini
shared_buffers = 4GB          # 25% of RAM
effective_cache_size = 12GB   # 50-75% of RAM
work_mem = 64MB              # Based on concurrent connections
maintenance_work_mem = 1GB    # For VACUUM operations
```

### 12.3. Performance Targets

| Operation | Target Performance |
|-----------|-------------------|
| Dashboard query (30 days) | < 50ms (p95) |
| Permission check | < 5ms (p95) |
| Entry creation | < 10ms (p95) |
| Reflection history (1 year) | < 100ms (p95) |
| Merit progress calculation | < 200ms (p95) |

---

## 13. Security & Compliance

### 13.1. Authentication

#### Password Security
- **Hashing**: bcrypt or Argon2 (never plaintext)
- **Policy**: Strong password requirements (enforced at application level)
- **Reset**: Secure token-based password reset

#### Two-Factor Authentication
- **Status**: Tracked in `users.two_factor_enabled`
- **Implementation**: Application-level (TOTP, SMS, etc.)

### 13.2. Data Protection

#### Encryption at Rest
- **Client-Side**: Sensitive data encrypted before storage (BYTEA columns)
- **Server-Side**: PostgreSQL transparent data encryption (TDE) recommended

#### Encryption in Transit
- **SSL/TLS**: Required for all database connections
- **Certificate**: Certificate-based authentication

### 13.3. Audit Logging

#### Entry History
- **Purpose**: Track all entry changes (created/updated)
- **Storage**: `entry_history` table
- **Retention**: Permanent (no deletes)

#### Application-Level Audit
- **Log**: Critical operations (permission grants, user deletions)
- **Storage**: Application logs or dedicated audit table

### 13.4. Compliance Considerations

#### GDPR Compliance
- **Data Export**: Provide user data export functionality
- **Data Deletion**: Support user data deletion (hard deletes)
- **Consent**: Track user consent for data processing

#### Data Retention
- **Entries**: Permanent (user data)
- **Entry History**: Permanent (audit trail)
- **Messages**: Retain for support purposes

---

## 14. Monitoring & Maintenance

### 14.1. Performance Monitoring

#### Key Metrics
- Query execution time (p50, p95, p99)
- Database connection pool usage
- Cache hit rates
- Index usage statistics

#### Monitoring Tools
- **PostgreSQL**: `pg_stat_statements` extension
- **Application**: APM tools (New Relic, Datadog, etc.)
- **Database**: Connection pool metrics

### 14.2. Health Checks

#### Database Health
```sql
-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;

-- Check index usage
SELECT * FROM pg_stat_user_indexes 
WHERE idx_scan = 0;
```

### 14.3. Backup Strategy

#### Backup Schedule
- **Daily**: Full backup at 2:00 AM (low traffic)
- **Weekly**: Full backup + verification
- **Monthly**: Long-term archive

#### Backup Storage
- **On-Site**: Local backup server (last 7 days)
- **Off-Site**: Cloud storage (S3, Azure Blob, etc.) - 30+ days

### 14.4. Disaster Recovery

#### Recovery Objectives
- **RTO**: 4 hours (Recovery Time Objective)
- **RPO**: 1 hour (Recovery Point Objective, with WAL archiving)

#### Recovery Procedures
1. **Database Failure**: Restore from latest backup, apply WAL files
2. **Data Corruption**: Identify corrupted data, restore from backup
3. **Accidental Deletion**: Stop application, restore from backup

---

## 15. Production Deployment

### 15.1. Pre-Deployment Checklist

- [ ] All migrations tested on staging
- [ ] Backup current production database
- [ ] Indexes created and verified
- [ ] Connection pooling configured
- [ ] Monitoring tools configured
- [ ] Rollback procedures documented
- [ ] Team notified of deployment

### 15.2. Deployment Procedures

1. **Maintenance Window**: Schedule low-traffic period
2. **Backup**: Full database backup
3. **Deploy Schema**: Run migrations
4. **Deploy Application**: Deploy new application code
5. **Verify**: Run health checks, verify functionality
6. **Monitor**: Watch metrics for 1 hour post-deployment

### 15.3. Post-Deployment Validation

#### Validation Queries
```sql
-- Verify indexes
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';

-- Verify constraints
SELECT * FROM information_schema.table_constraints 
WHERE table_schema = 'public';

-- Verify data integrity
SELECT COUNT(*) FROM entries WHERE scale_value_id IS NULL AND count_value IS NULL;
-- Should return 0 (CHECK constraint violation)
```

---

## 16. Appendix

### 16.1. Complete Schema SQL

See `ENHANCED_SCHEMA_2.md` for complete SQL schema definitions.

### 16.2. Common Query Patterns

#### Dashboard Query
```sql
SELECT e.*, di.name, d.category_type
FROM entries e
JOIN deed_items di ON e.deed_item_id = di.deed_item_id
JOIN deeds d ON di.deed_id = d.deed_id
WHERE e.user_id = :user_id
  AND e.entry_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY e.entry_date DESC;
```

#### Permission Check
```sql
SELECT p.*
FROM permissions p
JOIN relations r ON p.relation_id = r.relation_id
WHERE r.requester_id = :requester_id
  AND r.requestee_id = :owner_id
  AND r.status = 'accepted'
  AND p.deed_item_id = :deed_item_id
  AND p.is_active = TRUE;
```

#### Hierarchy Query
```sql
-- Get all children of a parent
SELECT * FROM deed_items 
WHERE parent_deed_item_id = :parent_id 
ORDER BY display_order;
```

### 16.3. Troubleshooting Guide

#### Slow Queries
1. **Check Index Usage**: `EXPLAIN ANALYZE` to see if indexes are used
2. **Check Statistics**: Run `VACUUM ANALYZE` to update statistics
3. **Check Index Bloat**: Rebuild indexes with `REINDEX`

#### Connection Issues
1. **Check Pool Size**: Monitor connection pool usage
2. **Check Locks**: `SELECT * FROM pg_locks WHERE NOT granted;`
3. **Check Active Connections**: `SELECT * FROM pg_stat_activity;`

#### Data Integrity Issues
1. **Check Constraints**: Verify CHECK constraints are working
2. **Check Foreign Keys**: Verify foreign key relationships
3. **Check Unique Constraints**: Verify no duplicate data

---

## Conclusion

This database design provides a production-ready foundation for the Kitaab application, optimized for:
- **Data Integrity**: Constraints and foreign keys ensure data consistency
- **Performance**: Strategic indexing based on real query patterns
- **Scalability**: Ready for millions of users and billions of entries
- **Security**: Client-side encryption ensures privacy
- **Maintainability**: Clear structure and comprehensive documentation

The design balances performance, storage efficiency, and operational complexity, making it suitable for real-world deployment and long-term growth.

---

