# Kitaab Database Architecture Plan

## Table of Contents
1. [Overview](#overview)
2. [Core Workflow](#core-workflow)
3. [Entity-Relationship Model](#entity-relationship-model)
4. [Database Schema Design](#database-schema-design)
5. [Data Flow & Workflows](#data-flow--workflows)
6. [Database Strategies](#database-strategies)
7. [Indexing Strategy](#indexing-strategy)
8. [Security Considerations](#security-considerations)
9. [Scalability & Performance](#scalability--performance)
10. [Migration & Backup Strategy](#migration--backup-strategy)

---

## Overview

### Purpose
Kitaab is a personal accountability application designed to help users track their deeds (Hasanaat - good deeds, and Saiyyiaat - areas for improvement) through a structured, hierarchical system. The database architecture supports:

- **User Management**: Secure authentication, profile management, and user preferences
- **Deed Tracking**: Hierarchical organization of deeds with flexible measurement systems
- **Entry Management**: Daily recording of deeds with scale-based or count-based values
- **Social Features**: Unidirectional user connections with granular permission controls
- **Progress Tracking**: Merits (deed-specific achievements) and Targets (multi-deed goals)
- **Reflection & Communication**: Daily reflections and in-app support messaging
- **Notifications**: Timezone-aware daily reminders

### Technology Stack
- **Database**: PostgreSQL 14+ (recommended for production)
- **Connection Pooling**: psycopg2 with connection pools
- **ORM/Driver**: PyMongo-style patterns adapted for PostgreSQL
- **Caching**: Redis (recommended for frequently accessed data)
- **Monitoring**: PostgreSQL query performance monitoring tools

### Architecture Principles
1. **Data Integrity First**: All constraints enforced at database level
2. **Soft Deletes**: Preserve historical data for analytics and recovery
3. **Normalization**: Eliminate redundancy while maintaining query performance
4. **Scalability Ready**: Designed to handle millions of users and billions of entries
5. **Audit Trail**: Complete history tracking for compliance and debugging
6. **Timezone Awareness**: Support global users with proper timezone handling

---

## Core Workflow

### User Registration & Onboarding
```
1. User registers → users table (email, password_hash, full_name)
2. Email verification → email_verified flag updated
3. User creates first deed → deeds table (category_type: hasanaat/saiyyiaat)
4. User adds deed items → deed_items table (hierarchical structure)
5. User defines scale → scales + scale_values tables
6. User sets preferences → users table (preferences merged)
```

### Daily Entry Workflow
```
1. User opens app → Check notifications table for reminder time
2. User selects deed item → Query deed_items with hierarchy
3. User records entry → entries table
   - If scale-based: link to scale_value_id
   - If count-based: store count_value
4. Entry triggers → entry_history table (audit trail)
5. Check merits/targets → Update progress if applicable
6. User writes reflection → reflection_messages table (optional)
```

### Permission-Based Entry Workflow
```
1. User A sends connection request → relations table (status: pending)
2. User B accepts → relations table (status: accepted)
3. User A grants permission → permissions table (permission_type: read/write)
4. User A (with write permission) creates entry → entries table
   - created_by_user_id = User A
   - user_id = User B (entry owner)
5. Entry visible to User A based on permissions
```

### Progress Tracking Workflow
```
1. User creates merit → merits table (deed-specific)
2. User adds merit items → merit_items table (targets)
3. System checks entries → Calculate progress against merit_items
4. When completed → Update merits.completed_at
5. Similar flow for targets (multi-deed goals)
```

---

## Entity-Relationship Model

### Core Entities

#### 1. User Management Cluster
```
users (1) ──< (N) deeds
users (1) ──< (N) relations (as requester)
users (1) ──< (N) relations (as requestee)
-- Preferences merged into users table
users (1) ──< (N) entries
users (1) ──< (N) reflection_messages
users (1) ──< (N) notifications
users (1) ──< (N) messages
users (1) ──< (N) merits
users (1) ──< (N) targets
```

#### 2. Deed Hierarchy Cluster
```
deeds (1) ──< (N) deed_items
deed_items (1) ──< (N) deed_items (self-referencing: parent_deed_item_id)
deeds (1) ──< (N) scales
scales (1) ──< (N) scale_values
deed_items (1) ──< (N) entries
```

#### 3. Entry & History Cluster
```
entries (1) ──< (N) entry_history
entries (N) >── (1) users
entries (N) >── (1) deed_items
entries (N) >── (1) scales (optional)
entries (N) >── (1) scale_values (optional)
```

#### 4. Social & Permissions Cluster
```
relations (1) ──< (N) permissions
permissions (N) >── (1) deed_items
relations (N) >── (1) users (requester)
relations (N) >── (1) users (requestee)
```

#### 5. Progress Tracking Cluster
```
merits (1) ──< (N) merit_items
merit_items (N) >── (1) deed_items
merit_items (N) >── (1) scale_values (optional)
targets (1) ──< (N) target_items
target_items (N) >── (1) deed_items
target_items (N) >── (1) scale_values (optional)
```

### Key Relationships

**One-to-Many:**
- User → Deeds (one user has many deeds)
- Deed → Deed Items (one deed has many items)
- Deed → Scales (one deed can have multiple scale versions)
- Scale → Scale Values (one scale has many options)
- Entry → Entry History (one entry has many history records)

**Many-to-Many (via junction tables):**
- Users ↔ Users (via relations table)
- Relations ↔ Deed Items (via permissions table)

**Self-Referencing:**
- Deed Items → Deed Items (parent-child hierarchy)

**Optional Relationships:**
- Entries → Scales (only for scale-based entries)
- Entries → Scale Values (only for scale-based entries)
- Merit Items → Scale Values (only for scale-based targets)

---

## Database Schema Design

### Design Patterns

#### 1. Soft Delete Pattern
All major tables implement soft deletes using `deleted_at` timestamp:
- Allows data recovery
- Preserves historical data for analytics
- Enables audit compliance
- Partial indexes exclude deleted records automatically

#### 2. Versioning Pattern
Tables with evolving data use versioning:
- `scales`: Version tracking for scale evolution
- `permissions`: Version tracking for permission history

#### 3. Audit Trail Pattern
Critical operations tracked in:
- `entry_history`: All entry changes
- `audit_log`: System-wide critical operations

#### 4. Hierarchy Pattern
Tree structures use explicit parent references:
- `deed_items`: `parent_deed_item_id` + `level` validation
- Enables efficient recursive queries
- Validates hierarchy integrity

#### 5. Normalization Pattern
Eliminates redundancy:
- `scale_values`: Normalized scale options (replaces string storage)
- `permissions`: Linked through relations (not direct user pairs)
- **Note:** User preferences merged into users table (1:1 relationship, simpler queries)

### Data Types Strategy

**Primary Keys:**
- All tables use `BIGSERIAL` (supports billions of records)
- Naming: `{table_name}_id`

**Timestamps:**
- All timestamps: `TIMESTAMP WITH TIME ZONE`
- Naming convention: `{action}_at` (e.g., `created_at`, `updated_at`)

**Numeric Values:**
- Counts and measurements: `DECIMAL(10,2)` (precision for calculations)
- Durations: `INTEGER` with `_days` suffix

**Enums:**
- Replaced string fields with PostgreSQL ENUM types
- Ensures data integrity at database level
- Examples: `deed_category_type`, `relation_status_enum`, `permission_type_enum`

**Text Fields:**
- Short text: `VARCHAR(255)`
- Long text: `TEXT`
- JSON data: `JSONB` (in audit_log)

### Constraint Strategy

**Foreign Keys:**
- All relationships have foreign keys
- CASCADE for dependent data (e.g., user deletion removes all user data)
- RESTRICT for critical references (e.g., entries cannot delete referenced deed_items)
- SET NULL for optional references (e.g., scale deletion sets entry.scale_id to NULL)

**CHECK Constraints:**
- Date ranges: `end_date >= start_date`
- Hierarchy validation: `(parent IS NULL AND level = 1) OR (parent IS NOT NULL AND level > 1)`
- Value requirements: `(scale_value_id IS NOT NULL) OR (count_value IS NOT NULL)`
- Self-reference prevention: `requester_id != requestee_id`

**UNIQUE Constraints:**
- Prevent duplicates: `(user_id, deed_item_id, entry_date)`
- One active notification per user: `(user_id) WHERE is_active = TRUE`
- One reflection per type per day: `(user_id, reflection_date, type)`

---

## Data Flow & Workflows

### Entry Creation Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /entries
       ▼
┌─────────────────┐
│  Application    │
│     Layer       │
└──────┬──────────┘
       │ 2. Validate permissions
       │ 3. Check constraints
       ▼
┌─────────────────┐
│   Database      │
│   Connection    │
│     Pool        │
└──────┬──────────┘
       │ 4. BEGIN TRANSACTION
       ▼
┌─────────────────┐
│  entries table  │ ← 5. INSERT entry
└──────┬──────────┘
       │ 6. Trigger (if configured)
       ▼
┌─────────────────┐
│ entry_history   │ ← 7. INSERT history record
└──────┬──────────┘
       │ 8. Check merits/targets
       ▼
┌─────────────────┐
│  merits/targets  │ ← 9. Update progress (if applicable)
└─────────────────┘
       │ 10. COMMIT
       ▼
┌─────────────────┐
│  Response to    │
│    Client       │
└─────────────────┘
```

### Permission Check Flow

```
User A requests to view/edit User B's deed_item

1. Query relations table:
   SELECT * FROM relations 
   WHERE requester_id = A AND requestee_id = B 
   AND status = 'accepted'

2. If relation exists, query permissions:
   SELECT * FROM permissions
   WHERE relation_id = {relation_id}
   AND deed_item_id = {deed_item_id}
   AND is_active = TRUE

3. Check permission_type:
   - 'read': Allow SELECT queries
   - 'write': Allow INSERT/UPDATE queries
   - No permission: Deny access

4. For write operations, set created_by_user_id = A
```

### Dashboard Query Flow

```
User requests dashboard (last 30 days)

1. Query entries:
   SELECT e.*, di.name, di.level, d.category_type
   FROM entries e
   JOIN deed_items di ON e.deed_item_id = di.deed_item_id
   JOIN deeds d ON di.deed_id = d.deed_id
   WHERE e.user_id = {user_id}
   AND e.entry_date >= CURRENT_DATE - INTERVAL '30 days'
   AND di.deleted_at IS NULL
   ORDER BY e.entry_date DESC

2. Use index: idx_entries_user_date (optimized for this query)

3. Aggregate data:
   - Group by category_type (hasanaat/saiyyiaat)
   - Calculate totals, averages
   - Build time-series data for charts

4. Cache result in Redis (TTL: 5 minutes)
```

### Merit Progress Calculation Flow

```
System checks merit progress (scheduled job)

1. Query active merits:
   SELECT * FROM merits
   WHERE user_id = {user_id}
   AND is_active = TRUE
   AND completed_at IS NULL

2. For each merit:
   a. Get merit_items:
      SELECT * FROM merit_items WHERE merit_id = {merit_id}
   
   b. For each merit_item:
      - If count-based: SUM entries.count_value
      - If scale-based: COUNT entries WHERE scale_value_id matches
   
   c. Check completion:
      - AND type: All items must be complete
      - OR type: Any item can be complete
   
3. If completed:
   UPDATE merits SET completed_at = NOW()
   WHERE merit_id = {merit_id}

4. Trigger notification (optional)
```

### Notification Scheduling Flow

```
Scheduled job (runs every minute)

1. Query active notifications:
   SELECT * FROM notifications
   WHERE is_active = TRUE
   AND notification_time BETWEEN {current_time - 1min} AND {current_time}

2. For each notification:
   a. Convert to user's timezone
   b. Check if notification already sent today
   c. Send push/email notification
   d. Log in audit_log

3. Use index: idx_notifications_time (optimized for time-based queries)
```

---

## Database Strategies

### Connection Pooling Strategy

**PostgreSQL Connection Pool:**
```python
# Recommended configuration
pool_config = {
    'minconn': 5,           # Minimum connections
    'maxconn': 20,          # Maximum connections per process
    'host': 'localhost',
    'port': 5432,
    'database': 'kitaab',
    'user': 'kitaab_user',
    'password': 'secure_password',
    'connect_timeout': 10,
    'keepalives': 1,
    'keepalives_idle': 30,
    'keepalives_interval': 10,
    'keepalives_count': 5
}
```

**Benefits:**
- Reduces connection overhead
- Handles concurrent requests efficiently
- Automatic connection health checks
- Configurable timeouts and retries

### Caching Strategy

**Redis Caching Layers:**

1. **User Session Cache:**
   - Key: `user:{user_id}:session`
   - TTL: 24 hours
   - Stores: user preferences, active permissions

2. **Dashboard Cache:**
   - Key: `user:{user_id}:dashboard:{date_range}`
   - TTL: 5 minutes
   - Stores: aggregated entry data

3. **Permission Cache:**
   - Key: `permission:{relation_id}:{deed_item_id}`
   - TTL: 1 hour
   - Stores: permission lookups

4. **Deed Hierarchy Cache:**
   - Key: `deed:{deed_id}:hierarchy`
   - TTL: 1 hour
   - Stores: deed_items tree structure

**Cache Invalidation:**
- On entry creation/update: Invalidate dashboard cache
- On permission change: Invalidate permission cache
- On deed_item change: Invalidate hierarchy cache

### Query Optimization Strategy

**Read Queries:**
- Use connection pool for read operations
- Leverage indexes for WHERE clauses
- Use SELECT with specific columns (avoid SELECT *)
- Implement pagination for large result sets

**Write Queries:**
- Use transactions for multi-table operations
- Batch inserts for bulk operations
- Use UPSERT (ON CONFLICT) for idempotent operations
- Log all writes to audit_log

**Analytics Queries:**
- Use materialized views for complex aggregations
- Schedule periodic refresh (e.g., every hour)
- Consider read replicas for analytics workload

### Transaction Management

**Transaction Boundaries:**
- Entry creation: Single transaction (entry + history)
- Permission updates: Single transaction (permission + audit_log)
- Merit completion: Single transaction (merit update + notification)

**Isolation Levels:**
- Default: READ COMMITTED (PostgreSQL default)
- For critical operations: REPEATABLE READ
- For analytics: READ UNCOMMITTED (if acceptable)

**Deadlock Prevention:**
- Always acquire locks in consistent order
- Use short-lived transactions
- Implement retry logic with exponential backoff

### Data Archival Strategy

**Archival Criteria:**
- Entries older than 2 years → Archive table
- Entry_history older than 5 years → Archive table
- Audit_log older than 7 years → Archive table

**Archival Process:**
1. Create archive tables (same schema)
2. Move data in batches (to avoid long locks)
3. Update indexes on archive tables
4. Compress old partitions (if using partitioning)

**Retrieval:**
- Archive tables accessible for historical queries
- Application can query both active and archive tables
- Consider separate read-only connection for archives

---

## Indexing Strategy

### Index Categories

#### 1. Primary Key Indexes
All tables have primary key indexes (automatic in PostgreSQL):
- `users_pkey` on `user_id`
- `deeds_pkey` on `deed_id`
- `entries_pkey` on `entry_id`
- etc.

#### 2. Foreign Key Indexes
All foreign keys are indexed for join performance:
```sql
CREATE INDEX idx_deeds_user_id ON deeds(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deed_items_deed_id ON deed_items(deed_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_deed_item_id ON entries(deed_item_id);
```

#### 3. Composite Indexes
Optimized for common query patterns:

**Dashboard Queries:**
```sql
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
```
- Supports: "Get user's entries for date range"
- Order: user_id first (high selectivity), then date

**Permission Checks:**
```sql
CREATE INDEX idx_permissions_relation_deed ON permissions(relation_id, deed_item_id, is_active);
```
- Supports: "Check if user has permission for deed_item"
- Includes is_active in index for filtering

**Hierarchy Queries:**
```sql
CREATE INDEX idx_deed_items_level ON deed_items(deed_id, level, display_order) WHERE deleted_at IS NULL;
```
- Supports: "Get all items for deed, ordered by level and display_order"
- Partial index excludes deleted items

#### 4. Partial Indexes
Index only active/non-deleted records:

```sql
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_deeds_active ON deeds(is_active, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_relations_accepted ON relations(requester_id, requestee_id) WHERE status = 'accepted';
```

**Benefits:**
- Smaller index size (faster scans)
- Better query performance
- Reduced maintenance overhead

#### 5. Time-Based Partial Indexes
Optimize for recent data:

```sql
CREATE INDEX idx_entries_date_range ON entries(entry_date) 
WHERE entry_date >= CURRENT_DATE - INTERVAL '1 year';
```
- Only indexes entries from last year
- Automatically excludes old data from index
- Reduces index size significantly

#### 6. Full-Text Search Indexes (Future)
For searching in text fields:

```sql
CREATE INDEX idx_entries_notes_gin ON entries USING GIN (to_tsvector('english', notes));
CREATE INDEX idx_messages_content_gin ON messages USING GIN (to_tsvector('english', content));
```

### Index Maintenance

**Monitoring:**
- Track index usage: `pg_stat_user_indexes`
- Monitor index bloat: `pg_stat_user_tables`
- Identify unused indexes for removal

**Rebuilding:**
- REINDEX for fragmented indexes (monthly)
- VACUUM ANALYZE for statistics updates (weekly)
- Consider pg_repack for zero-downtime reindexing

**Index Selection Guidelines:**
1. Index foreign keys (always)
2. Index columns in WHERE clauses (high selectivity)
3. Index columns in ORDER BY (if no WHERE clause)
4. Use composite indexes for multi-column queries
5. Use partial indexes for filtered queries
6. Monitor and remove unused indexes

---

## Security Considerations

### Authentication & Authorization

**Password Security:**
- Store password hashes (never plaintext)
- Use bcrypt or Argon2 for hashing
- Enforce strong password policies
- Implement password reset with secure tokens

**Session Management:**
- Use secure, HTTP-only cookies
- Implement session expiration
- Store session data in Redis (not database)
- Rotate session keys regularly

**API Security:**
- Use JWT tokens for stateless authentication
- Implement rate limiting per user
- Validate all input parameters
- Use parameterized queries (prevent SQL injection)

### Data Protection

**Encryption at Rest:**
- Enable PostgreSQL transparent data encryption (TDE)
- Encrypt sensitive fields (e.g., password_hash)
- Use encrypted backups

**Encryption in Transit:**
- Require SSL/TLS for all database connections
- Use certificate-based authentication
- Disable insecure protocols

**Data Masking:**
- Mask sensitive data in logs
- Implement field-level encryption for PII
- Use views for restricted data access

### Access Control

**Database User Roles:**
```sql
-- Application user (read/write)
CREATE ROLE kitaab_app WITH LOGIN PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO kitaab_app;

-- Read-only user (analytics)
CREATE ROLE kitaab_readonly WITH LOGIN PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO kitaab_readonly;

-- Admin user (migrations)
CREATE ROLE kitaab_admin WITH LOGIN PASSWORD 'secure_password';
GRANT ALL ON ALL TABLES IN SCHEMA public TO kitaab_admin;
```

**Row-Level Security (RLS):**
```sql
-- Example: Users can only see their own entries
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_entries_policy ON entries
FOR ALL
TO kitaab_app
USING (user_id = current_setting('app.user_id')::bigint);
```

### Audit & Compliance

**Audit Logging:**
- Log all critical operations to `audit_log`
- Track: user_id, action_type, table_name, record_id, IP address
- Store old/new values for change tracking
- Implement log retention policy

**Data Retention:**
- Comply with GDPR/data protection regulations
- Implement data deletion workflows
- Archive old data (not delete)
- Provide data export functionality

**Backup Security:**
- Encrypt backups
- Store backups in secure, off-site location
- Test backup restoration regularly
- Implement backup access controls

### Vulnerability Mitigation

**SQL Injection Prevention:**
- Always use parameterized queries
- Validate and sanitize all inputs
- Use ORM/query builders when possible
- Regular security audits

**DoS Protection:**
- Implement query timeouts
- Limit result set sizes
- Use connection pooling limits
- Monitor and alert on suspicious activity

**Privilege Escalation Prevention:**
- Use least-privilege principle
- Separate application and admin users
- Implement permission checks at application level
- Regular security reviews

---

## Scalability & Performance

### Horizontal Scaling Strategies

#### 1. Read Replicas
**Implementation:**
- Set up PostgreSQL streaming replication
- Route read queries to replicas
- Route write queries to primary
- Use connection pool with read/write splitting

**Benefits:**
- Distribute read load
- Improve query performance
- Enable zero-downtime maintenance

**Use Cases:**
- Dashboard queries
- Analytics queries
- Reporting queries

#### 2. Sharding (Future)
**Sharding Strategy:**
- Shard by `user_id` (user-based sharding)
- Each shard contains complete user data
- Use consistent hashing for distribution

**Challenges:**
- Cross-shard queries (e.g., relations between users)
- Data migration and rebalancing
- Application complexity

**When to Implement:**
- When single database cannot handle load
- When data exceeds single server capacity
- After exhausting vertical scaling options

#### 3. Partitioning
**Table Partitioning:**
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

**Benefits:**
- Faster queries on recent data
- Easier data archival
- Parallel query execution
- Reduced index size per partition

**Partitioning Strategy:**
- Partition by `entry_date` (time-based)
- Keep last 2 years in active partitions
- Archive older partitions

### Vertical Scaling

**Database Server Optimization:**
- Increase RAM for larger shared_buffers
- Use SSD storage for better I/O
- Optimize PostgreSQL configuration:
  - `shared_buffers`: 25% of RAM
  - `effective_cache_size`: 50-75% of RAM
  - `work_mem`: Based on concurrent connections
  - `maintenance_work_mem`: For VACUUM operations

**Connection Pooling:**
- Use PgBouncer or similar for connection pooling
- Reduce connection overhead
- Handle connection spikes gracefully

### Query Performance Optimization

**Materialized Views:**
```sql
-- Dashboard aggregations
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
    user_id,
    entry_date,
    category_type,
    COUNT(*) as entry_count,
    SUM(count_value) as total_count
FROM entries e
JOIN deed_items di ON e.deed_item_id = di.deed_item_id
JOIN deeds d ON di.deed_id = d.deed_id
WHERE e.entry_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id, entry_date, category_type;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
```

**Query Optimization Techniques:**
1. Use EXPLAIN ANALYZE to identify slow queries
2. Add missing indexes based on query patterns
3. Rewrite queries to use indexes effectively
4. Use covering indexes to avoid table lookups
5. Implement query result caching

### Caching Strategy

**Application-Level Caching:**
- Redis for frequently accessed data
- Cache user preferences, permissions, deed hierarchies
- TTL-based expiration
- Cache invalidation on updates

**Database-Level Caching:**
- PostgreSQL shared_buffers (automatic)
- Query result caching (if using connection pool)
- Consider pg_prewarm for critical tables

### Performance Monitoring

**Key Metrics:**
- Query execution time (p50, p95, p99)
- Database connection pool usage
- Cache hit rates
- Index usage statistics
- Table and index bloat

**Monitoring Tools:**
- PostgreSQL `pg_stat_statements` extension
- Application performance monitoring (APM)
- Database connection pool metrics
- Redis cache metrics

**Alerting:**
- Slow query alerts (> 1 second)
- High connection pool usage (> 80%)
- Low cache hit rate (< 90%)
- Database disk space warnings

### Load Testing

**Test Scenarios:**
1. **User Registration**: 1000 concurrent registrations
2. **Entry Creation**: 10,000 entries/minute
3. **Dashboard Load**: 5000 concurrent dashboard views
4. **Permission Checks**: 50,000 permission checks/minute
5. **Analytics Queries**: Complex aggregations under load

**Performance Targets:**
- Entry creation: < 50ms (p95)
- Dashboard load: < 200ms (p95)
- Permission check: < 5ms (p95)
- Analytics query: < 1s (p95)

---

## Migration & Backup Strategy

### Migration Strategy

#### Phase 1: Preparation
1. **Backup Current Database:**
   ```bash
   pg_dump -Fc kitaab_db > kitaab_backup_$(date +%Y%m%d).dump
   ```

2. **Create Migration Scripts:**
   - Use versioned migration files
   - Test on staging environment
   - Document rollback procedures

3. **Communication:**
   - Notify users of maintenance window
   - Prepare rollback plan
   - Set up monitoring

#### Phase 2: Schema Migration
**Step 1: Add New Columns (Non-Breaking)**
```sql
-- Add new columns with defaults
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
```

**Step 2: Create New Tables**
```sql
-- Create scale_values table
CREATE TABLE scale_values (...);

-- Note: User preferences are now in users table (merged for simplicity)

-- Create audit_log table
CREATE TABLE audit_log (...);
```

**Step 3: Migrate Data**
```sql
-- Populate scale_values from existing data
INSERT INTO scale_values (scale_id, value_name, value_order)
SELECT scale_id, scale_value, 0
FROM entries
WHERE scale_value IS NOT NULL
GROUP BY scale_id, scale_value;

-- Update entries to reference scale_value_id
UPDATE entries e
SET scale_value_id = sv.scale_value_id
FROM scale_values sv
WHERE e.scale_value = sv.value_name;
```

**Step 4: Add Constraints**
```sql
-- Add foreign keys
ALTER TABLE entries ADD CONSTRAINT fk_entries_scale_value 
FOREIGN KEY (scale_value_id) REFERENCES scale_values(scale_value_id);

-- Add CHECK constraints
ALTER TABLE entries ADD CONSTRAINT entry_has_value CHECK (
    (scale_value_id IS NOT NULL) OR (count_value IS NOT NULL)
);

-- Add UNIQUE constraints
ALTER TABLE entries ADD CONSTRAINT unique_user_deed_item_date 
UNIQUE (user_id, deed_item_id, entry_date);
```

**Step 5: Create Indexes**
```sql
-- Create all recommended indexes
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
-- ... (all other indexes)
```

#### Phase 3: Application Update
1. Update application code to use new schema
2. Deploy to staging for testing
3. Run integration tests
4. Deploy to production

#### Phase 4: Cleanup
1. Remove deprecated columns (after application update)
2. Drop unused indexes
3. Update statistics: `ANALYZE`
4. Monitor performance

### Rollback Strategy

**If Migration Fails:**
1. Stop application traffic
2. Restore from backup:
   ```bash
   pg_restore -d kitaab_db kitaab_backup_YYYYMMDD.dump
   ```
3. Revert application code
4. Resume traffic
5. Investigate and fix issues
6. Retry migration after fixes

### Backup Strategy

#### Backup Types

**1. Full Backup (Daily)**
```bash
# Full database backup
pg_dump -Fc -U kitaab_user kitaab_db > \
  /backups/kitaab_full_$(date +%Y%m%d).dump

# Compress backup
gzip /backups/kitaab_full_$(date +%Y%m%d).dump
```

**2. Incremental Backup (Continuous)**
- Use PostgreSQL WAL (Write-Ahead Log) archiving
- Enables point-in-time recovery
- Archive WAL files to secure storage

**3. Table-Level Backup (Selective)**
```bash
# Backup specific tables
pg_dump -t entries -t entry_history kitaab_db > entries_backup.dump
```

#### Backup Schedule

**Daily:**
- Full backup at 2:00 AM (low traffic)
- Compress and encrypt backup
- Upload to off-site storage (S3, etc.)

**Weekly:**
- Full backup + verification
- Test restore procedure
- Archive old backups (keep 4 weeks)

**Monthly:**
- Full backup + long-term archive
- Keep monthly backups for 12 months
- Document backup locations

#### Backup Storage

**On-Site:**
- Local backup server
- Fast recovery access
- Keep last 7 days

**Off-Site:**
- Cloud storage (S3, Azure Blob, etc.)
- Encrypted backups
- Geo-redundant storage
- Keep 30+ days

#### Backup Verification

**Automated Checks:**
1. Verify backup file integrity
2. Test restore on staging server (weekly)
3. Monitor backup success/failure
4. Alert on backup failures

**Manual Verification:**
- Monthly restore test
- Verify data completeness
- Test point-in-time recovery
- Document results

### Disaster Recovery

**Recovery Time Objective (RTO):** 4 hours
**Recovery Point Objective (RPO):** 1 hour (with WAL archiving)

**Recovery Procedures:**

**1. Database Server Failure:**
- Restore from latest backup
- Apply WAL files for point-in-time recovery
- Verify data integrity
- Resume application traffic

**2. Data Corruption:**
- Identify corrupted tables/rows
- Restore from backup
- Replay transactions from WAL
- Verify and resume

**3. Accidental Deletion:**
- Stop application immediately
- Restore from backup
- Identify and prevent cause
- Resume with monitoring

### Monitoring & Alerts

**Backup Monitoring:**
- Daily backup success/failure
- Backup file size anomalies
- Backup storage space warnings
- Restore test results

**Database Health:**
- Connection pool usage
- Query performance
- Disk space usage
- Replication lag (if using replicas)

---

## Conclusion

This architecture plan provides a comprehensive foundation for building and maintaining the Kitaab database system. Key principles:

1. **Data Integrity**: Constraints and validations at database level
2. **Performance**: Strategic indexing and query optimization
3. **Scalability**: Ready for growth from thousands to millions of users
4. **Security**: Multi-layered security approach
5. **Reliability**: Comprehensive backup and disaster recovery
6. **Maintainability**: Clear documentation and monitoring

The architecture is designed to evolve with the application's needs while maintaining high performance, security, and data integrity standards.

