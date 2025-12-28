# Kitaab Backend Design - NestJS Architecture

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
   - 2.1. System Architecture
   - 2.2. Technology Stack
   - 2.3. Design Principles
3. [Project Structure](#3-project-structure)
   - 3.1. Module Organization
   - 3.2. Directory Structure
   - 3.3. Naming Conventions
4. [Core Modules](#4-core-modules)
   - 4.1. User Module
   - 4.2. Deed Module
   - 4.3. Entry Module
   - 4.4. Relation Module
   - 4.5. Permission Module
   - 4.6. Progress Tracking Module
   - 4.7. Communication Module
   - 4.8. Authentication Module
5. [Data Access Layer](#5-data-access-layer)
   - 5.1. Repository Pattern
   - 5.2. Database Connection Pooling
   - 5.3. Query Optimization
   - 5.4. Transaction Management
6. [Authentication & Authorization](#6-authentication--authorization)
   - 6.1. Authentication Strategy
   - 6.2. JWT Implementation
   - 6.3. Permission Middleware
   - 6.4. Role-Based Access Control
7. [Client-Side Encryption](#7-client-side-encryption)
   - 7.1. Encryption Service
   - 7.2. Key Management
   - 7.3. Data Sharing Flow
8. [API Design](#8-api-design)
   - 8.1. RESTful Principles
   - 8.2. Request/Response DTOs
   - 8.3. Error Handling
   - 8.4. API Versioning
   - 8.5. Complete API Endpoints Reference
   - 8.6. Table Coverage Verification
9. [Performance Optimization](#9-performance-optimization)
   - 9.1. Caching Strategy
   - 9.2. Database Query Optimization
   - 9.3. Response Compression
   - 9.4. Connection Pooling
10. [Scalability Patterns](#10-scalability-patterns)
    - 10.1. Horizontal Scaling
    - 10.2. Load Balancing
    - 10.3. Microservices Considerations
    - 10.4. Event-Driven Architecture
11. [Error Handling & Logging](#11-error-handling--logging)
    - 11.1. Global Exception Filters
    - 11.2. Structured Logging
    - 11.3. Error Tracking
12. [Validation & Security](#12-validation--security)
    - 12.1. Input Validation
    - 12.2. SQL Injection Prevention
    - 12.3. Rate Limiting
    - 12.4. CORS Configuration
13. [Testing Strategy](#13-testing-strategy)
    - 13.1. Unit Testing
    - 13.2. Integration Testing
    - 13.3. E2E Testing
    - 13.4. Performance Testing
14. [Monitoring & Observability](#14-monitoring--observability)
    - 14.1. Health Checks
    - 14.2. Metrics Collection
    - 14.3. Distributed Tracing
    - 14.4. Alerting
15. [Deployment & DevOps](#15-deployment--devops)
    - 15.1. Docker Configuration
    - 15.2. CI/CD Pipeline
    - 15.3. Environment Configuration
    - 15.4. Database Migrations
16. [Appendix](#16-appendix)
    - 16.1. Environment Variables
    - 16.2. API Endpoints Reference
    - 16.3. Common Patterns & Examples

---

## 1. Executive Summary

The Kitaab backend is built with NestJS, a progressive Node.js framework that provides a scalable, maintainable architecture for building efficient server-side applications. This design document outlines a production-ready backend architecture that aligns with the database design principles, emphasizing performance, security, scalability, and maintainability.

### Key Design Goals

1. **Scalability**: Handle millions of users and billions of entries with horizontal scaling support
2. **Performance**: Sub-50ms response times for critical operations (p95)
3. **Security**: Client-side encryption support, robust authentication, and authorization
4. **Maintainability**: Clean architecture, modular design, comprehensive testing
5. **Reliability**: Error handling, logging, monitoring, and graceful degradation

### Technology Stack

- **Framework**: NestJS 10+ (TypeScript)
- **Database**: PostgreSQL 14+ with TypeORM or Prisma
- **Caching**: Redis for session and query caching
- **Authentication**: JWT with refresh tokens
- **Validation**: class-validator, class-transformer
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest, Supertest
- **Monitoring**: Prometheus, Grafana (optional)

### Architecture Highlights

- **Modular Architecture**: Feature-based modules with clear boundaries
- **Repository Pattern**: Abstracted data access layer for testability
- **Service Layer**: Business logic separated from controllers
- **DTO Pattern**: Type-safe request/response handling
- **Middleware Chain**: Authentication, authorization, validation, logging
- **Connection Pooling**: Efficient database connection management
- **Caching Strategy**: Multi-layer caching for performance

---

## 2. Architecture Overview

### 2.1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│              (Web App, Mobile App, API Clients)              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTPS/REST API
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    API Gateway Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Rate       │  │   CORS       │  │   Logging     │     │
│  │   Limiting   │  │   Middleware │  │   Middleware  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  NestJS Application Layer                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Controller Layer                         │   │
│  │  (Request/Response handling, DTOs, Validation)       │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │                                    │
│  ┌───────────────────────▼──────────────────────────────┐   │
│  │              Service Layer                            │   │
│  │  (Business Logic, Encryption, Permission Checks)     │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │                                    │
│  ┌───────────────────────▼──────────────────────────────┐   │
│  │              Repository Layer                        │   │
│  │  (Data Access, Query Building, Transaction Mgmt)     │   │
│  └───────────────────────┬──────────────────────────────┘   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    Infrastructure Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  PostgreSQL  │  │    Redis     │  │   External   │       │
│  │  (Primary)   │  │   (Cache)    │  │   Services   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐                                            │
│  │  PostgreSQL  │                                            │
│  │  (Replica)   │                                            │
│  └──────────────┘                                            │
└──────────────────────────────────────────────────────────────┘
```

### 2.2. Technology Stack

#### Core Framework
- **NestJS 10+**: Progressive Node.js framework with TypeScript
- **TypeScript 5+**: Type-safe development
- **Node.js 20+**: LTS version for stability

#### Database & ORM
- **PostgreSQL 14+**: Primary database (as per database design)
- **TypeORM** or **Prisma**: ORM for type-safe database access
  - **Recommendation**: TypeORM for complex queries, Prisma for type safety
- **pg**: PostgreSQL driver
- **pg-pool**: Connection pooling

#### Caching & Session
- **Redis 7+**: Caching and session storage
- **@nestjs/cache-manager**: NestJS cache manager
- **cache-manager-redis-store**: Redis store adapter

#### Authentication & Security
- **@nestjs/jwt**: JWT token generation and validation
- **@nestjs/passport**: Authentication strategies
- **passport-jwt**: JWT strategy
- **bcrypt** or **argon2**: Password hashing
- **class-validator**: DTO validation
- **class-transformer**: DTO transformation

#### API Documentation
- **@nestjs/swagger**: OpenAPI/Swagger documentation
- **swagger-ui-express**: Swagger UI

#### Testing
- **Jest**: Unit and integration testing
- **Supertest**: E2E API testing
- **@nestjs/testing**: NestJS testing utilities

#### Monitoring & Logging
- **@nestjs/terminus**: Health checks
- **winston** or **pino**: Structured logging
- **@nestjs/prometheus**: Metrics collection (optional)

### 2.3. Design Principles

#### 1. Separation of Concerns
- **Controllers**: Handle HTTP requests/responses, validation
- **Services**: Business logic, orchestration
- **Repositories**: Data access, query building
- **DTOs**: Data transfer objects for type safety

#### 2. Dependency Injection
- Use NestJS built-in DI container
- Interfaces for abstractions (repository interfaces)
- Easy testing with mock implementations

#### 3. Single Responsibility Principle
- Each module handles one domain (User, Deed, Entry, etc.)
- Services have focused responsibilities
- Repositories handle only data access

#### 4. DRY (Don't Repeat Yourself)
- Shared utilities and helpers
- Base classes for common patterns
- Reusable guards, interceptors, filters

#### 5. Type Safety
- TypeScript strict mode enabled
- DTOs for all API inputs/outputs
- Type-safe database queries

#### 6. Performance First
- Connection pooling for database
- Caching for frequently accessed data
- Lazy loading where appropriate
- Query optimization

#### 7. Security by Default
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- Rate limiting
- CORS configuration
- Authentication required by default

#### 8. Scalability Ready
- Stateless services (horizontal scaling)
- Connection pooling
- Caching layer
- Read/write separation (future)

---

## 3. Project Structure

### 3.1. Module Organization

The backend follows a feature-based module structure, where each domain (User, Deed, Entry, etc.) is organized as a self-contained module:

```
src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root module
├── common/                          # Shared utilities and decorators
│   ├── decorators/                  # Custom decorators (@CurrentUser, etc.)
│   ├── filters/                     # Exception filters
│   ├── guards/                      # Authentication/authorization guards
│   ├── interceptors/                # Request/response interceptors
│   ├── pipes/                       # Validation pipes
│   ├── interfaces/                  # Shared interfaces
│   └── utils/                       # Utility functions
├── config/                          # Configuration modules
│   ├── database.config.ts           # Database configuration
│   ├── redis.config.ts              # Redis configuration
│   └── app.config.ts                # Application configuration
├── modules/                         # Feature modules
│   ├── auth/                        # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/              # Passport strategies
│   │   ├── guards/                  # Auth guards
│   │   └── dto/                     # Auth DTOs
│   ├── user/                        # User module
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   ├── entities/                # TypeORM entities
│   │   └── dto/                     # User DTOs
│   ├── deed/                        # Deed module
│   ├── entry/                       # Entry module
│   ├── relation/                    # Relation module
│   ├── permission/                  # Permission module
│   ├── progress/                    # Progress tracking (merits/targets)
│   ├── communication/               # Messages, reflections, notifications
│   └── encryption/                  # Encryption service module
└── database/                        # Database utilities
    ├── migrations/                  # Database migrations
    ├── seeds/                       # Database seeds
    └── factories/                 # Test data factories
```

### 3.2. Directory Structure

Each feature module follows a consistent structure:

```
modules/user/
├── user.module.ts                   # Module definition
├── user.controller.ts               # HTTP endpoints
├── user.service.ts                  # Business logic
├── user.repository.ts               # Data access
├── entities/                        # Database entities
│   └── user.entity.ts
├── dto/                             # Data Transfer Objects
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   └── user-response.dto.ts
├── interfaces/                      # Module-specific interfaces
│   └── user-repository.interface.ts
└── user.controller.spec.ts         # Unit tests
```

### 3.3. Naming Conventions

#### Files
- **Modules**: `{feature}.module.ts` (e.g., `user.module.ts`)
- **Controllers**: `{feature}.controller.ts` (e.g., `user.controller.ts`)
- **Services**: `{feature}.service.ts` (e.g., `user.service.ts`)
- **Repositories**: `{feature}.repository.ts` (e.g., `user.repository.ts`)
- **Entities**: `{entity}.entity.ts` (e.g., `user.entity.ts`)
- **DTOs**: `{action}-{feature}.dto.ts` (e.g., `create-user.dto.ts`)
- **Tests**: `{file}.spec.ts` (e.g., `user.service.spec.ts`)

#### Classes
- **Controllers**: `{Feature}Controller` (e.g., `UserController`)
- **Services**: `{Feature}Service` (e.g., `UserService`)
- **Repositories**: `{Feature}Repository` (e.g., `UserRepository`)
- **DTOs**: `{Action}{Feature}Dto` (e.g., `CreateUserDto`)

#### Variables & Methods
- **camelCase**: Variables, methods, properties
- **PascalCase**: Classes, interfaces, types
- **UPPER_SNAKE_CASE**: Constants, environment variables

#### API Endpoints
- **RESTful**: `/api/v1/{resource}/{id?}`
- **Nested Resources**: `/api/v1/{resource}/{id}/{sub-resource}`
- **Actions**: `/api/v1/{resource}/{id}/{action}` (e.g., `/api/v1/users/123/activate`)

---

## 4. Core Modules

### 4.1. User Module

**Purpose**: Manage user accounts, authentication, and user preferences.

#### Module Structure
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
})
export class UserModule {}
```

#### Key Responsibilities
1. **User Registration**: Create new user accounts with email verification
2. **User Authentication**: Login, logout, token refresh
3. **User Profile**: Get/update user profile and preferences
4. **Password Management**: Change password, reset password
5. **Encryption Setup**: Generate and store encryption salt

#### API Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/v1/users/me` | Get current user profile | Yes |
| PATCH | `/api/v1/users/me` | Update current user profile | Yes |
| GET | `/api/v1/users/:userId` | Get user profile by ID (public info only) | Yes |
| PATCH | `/api/v1/users/me/preferences` | Update user preferences (language, theme, timezone) | Yes |

#### Service Methods
```typescript
class UserService {
  async createUser(dto: CreateUserDto): Promise<UserResponseDto>
  async findByEmail(email: string): Promise<User | null>
  async findById(userId: number): Promise<User | null>
  async updateUser(userId: number, dto: UpdateUserDto): Promise<UserResponseDto>
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void>
  async verifyEmail(userId: number, token: string): Promise<void>
  async generateEncryptionSalt(userId: number): Promise<Buffer>
}
```

### 4.2. Deed Module

**Purpose**: Manage deeds, deed items, scales, and scale values.

#### Module Structure
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Deed, DeedItem, Scale, ScaleValue]),
    UserModule,
  ],
  controllers: [DeedController],
  providers: [DeedService, DeedRepository, DeedItemRepository, ScaleRepository],
  exports: [DeedService],
})
export class DeedModule {}
```

#### Key Responsibilities
1. **Deed Management**: Create, read, update, delete deeds
2. **Deed Item Hierarchy**: Manage 3-level hierarchy with validation
3. **Display Order**: Handle reordering with DEFERRABLE constraints
4. **Scale Management**: Create and version scales
5. **Scale Values**: Manage scale options (encrypted)

#### API Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/deeds` | Create a new deed | Yes |
| GET | `/api/v1/deeds` | Get all deeds for current user (with optional category filter) | Yes |
| GET | `/api/v1/deeds/:deedId` | Get deed details | Yes |
| DELETE | `/api/v1/deeds/:deedId` | Delete deed | Yes |
| POST | `/api/v1/deeds/:deedId/items` | Create deed item | Yes |
| GET | `/api/v1/deeds/:deedId/items` | Get all items for deed (hierarchy) | Yes |
| GET | `/api/v1/deeds/:deedId/items/:itemId` | Get deed item details | Yes |
| PATCH | `/api/v1/deeds/:deedId/items/:itemId` | Update deed item | Yes |
| DELETE | `/api/v1/deeds/:deedId/items/:itemId` | Delete deed item | Yes |
| PATCH | `/api/v1/deeds/:deedId/items/reorder` | Reorder deed items (batch update) | Yes |
| POST | `/api/v1/deeds/:deedId/scales` | Create scale for deed | Yes |
| GET | `/api/v1/deeds/:deedId/scales` | Get all scales for deed | Yes |
| GET | `/api/v1/deeds/:deedId/scales/active` | Get active scale for deed | Yes |
| POST | `/api/v1/scales/:scaleId/values` | Create scale value | Yes |
| GET | `/api/v1/scales/:scaleId/values` | Get all values for scale | Yes |
| PATCH | `/api/v1/scales/:scaleId/values/:valueId` | Update scale value | Yes |
| DELETE | `/api/v1/scales/:scaleId/values/:valueId` | Delete scale value | Yes |

### 4.3. Entry Module

**Purpose**: Manage daily entries and entry history.

#### Module Structure
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Entry, EntryHistory]),
    DeedModule,
    UserModule,
    PermissionModule,
  ],
  controllers: [EntryController],
  providers: [EntryService, EntryRepository, EntryHistoryRepository],
  exports: [EntryService],
})
export class EntryModule {}
```

#### Key Responsibilities
1. **Entry Creation**: Create daily entries (scale-based or count-based)
2. **Entry Updates**: Update existing entries
3. **Entry History**: Track all changes (audit trail)
4. **Permission Checks**: Validate write permissions before creating entries
5. **Dashboard Queries**: Optimized queries for user dashboards

#### API Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/entries` | Create daily entry | Yes |
| GET | `/api/v1/entries` | Get entries for current user (with date range filter) | Yes |
| GET | `/api/v1/entries/dashboard` | Get dashboard entries (last 30 days, optimized) | Yes |
| GET | `/api/v1/entries/:entryId` | Get entry details | Yes |
| PATCH | `/api/v1/entries/:entryId` | Update entry | Yes |
| GET | `/api/v1/entries/:entryId/history` | Get entry history (audit trail) | Yes |
| GET | `/api/v1/entries/deed-item/:deedItemId` | Get entries for specific deed item | Yes |

### 4.4. Relation Module

**Purpose**: Manage unidirectional user connections (requester → requestee).

#### API Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/relations` | Send connection request to another user | Yes |
| GET | `/api/v1/relations` | Get all relations for current user (as requester and requestee) | Yes |
| GET | `/api/v1/relations/requests` | Get pending connection requests (received) | Yes |
| GET | `/api/v1/relations/sent` | Get sent connection requests | Yes |
| PATCH | `/api/v1/relations/:relationId/accept` | Accept a connection request | Yes |
| PATCH | `/api/v1/relations/:relationId/reject` | Reject a connection request | Yes |
| PATCH | `/api/v1/relations/:relationId/block` | Block a user (reject and prevent future requests) | Yes |
| DELETE | `/api/v1/relations/:relationId` | Remove a connection | Yes |

### 4.5. Permission Module

**Purpose**: Manage granular permissions for deed items (read/write access).

#### API Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/permissions` | Grant permission to a user for a deed item | Yes |
| GET | `/api/v1/permissions/deed-item/:deedItemId` | Get all permissions for a deed item | Yes |
| GET | `/api/v1/permissions/relation/:relationId` | Get all permissions for a relation | Yes |
| PATCH | `/api/v1/permissions/:permissionId/revoke` | Revoke a permission (set is_active = false) | Yes |
| GET | `/api/v1/permissions/check` | Check if user has permission for deed item | Yes |

### 4.6. Progress Tracking Module

**Purpose**: Manage merits (deed-specific achievements) and targets (multi-deed goals).

#### API Endpoints - Merits

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/merits` | Create a new merit | Yes |
| GET | `/api/v1/merits` | Get all merits for current user | Yes |
| GET | `/api/v1/merits/:meritId` | Get merit details | Yes |
| GET | `/api/v1/merits/deed-item/:deedItemId` | Get merits for a specific deed item | Yes |
| PATCH | `/api/v1/merits/:meritId` | Update merit | Yes |
| PATCH | `/api/v1/merits/:meritId/complete` | Mark merit as completed | Yes |
| DELETE | `/api/v1/merits/:meritId` | Delete merit | Yes |
| GET | `/api/v1/merits/:meritId/progress` | Get progress calculation for merit | Yes |

#### API Endpoints - Merit Items

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/merits/:meritId/items` | Add item to merit | Yes |
| GET | `/api/v1/merits/:meritId/items` | Get all items for a merit | Yes |
| GET | `/api/v1/merits/:meritId/items/:itemId` | Get merit item details | Yes |
| PATCH | `/api/v1/merits/:meritId/items/:itemId` | Update merit item | Yes |
| DELETE | `/api/v1/merits/:meritId/items/:itemId` | Delete merit item | Yes |

#### API Endpoints - Targets

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/targets` | Create a new target | Yes |
| GET | `/api/v1/targets` | Get all targets for current user | Yes |
| GET | `/api/v1/targets/:targetId` | Get target details | Yes |
| PATCH | `/api/v1/targets/:targetId` | Update target | Yes |
| PATCH | `/api/v1/targets/:targetId/complete` | Mark target as completed | Yes |
| DELETE | `/api/v1/targets/:targetId` | Delete target | Yes |
| GET | `/api/v1/targets/:targetId/progress` | Get progress calculation for target | Yes |

#### API Endpoints - Target Items

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/targets/:targetId/items` | Add item to target | Yes |
| GET | `/api/v1/targets/:targetId/items` | Get all items for a target | Yes |
| GET | `/api/v1/targets/:targetId/items/:itemId` | Get target item details | Yes |
| PATCH | `/api/v1/targets/:targetId/items/:itemId` | Update target item | Yes |
| DELETE | `/api/v1/targets/:targetId/items/:itemId` | Delete target item | Yes |

### 4.7. Communication Module

**Purpose**: Manage reflection messages, support messages, and notifications.

#### API Endpoints - Reflection Messages

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/reflections` | Create daily reflection message | Yes |
| GET | `/api/v1/reflections` | Get reflection history for user | Yes |
| GET | `/api/v1/reflections/:date` | Get reflection for specific date | Yes |
| GET | `/api/v1/reflections/:date/:type` | Get reflection by date and type (hasanaat/saiyyiaat) | Yes |
| PATCH | `/api/v1/reflections/:reflectionId` | Update reflection message | Yes |
| DELETE | `/api/v1/reflections/:reflectionId` | Delete reflection message | Yes |

#### API Endpoints - Messages (Support Chat)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/messages` | Send message to support | Yes |
| GET | `/api/v1/messages` | Get all messages for user (conversation) | Yes |
| GET | `/api/v1/messages/unread` | Get unread messages count | Yes |
| PATCH | `/api/v1/messages/:messageId/read` | Mark message as read | Yes |
| PATCH | `/api/v1/messages/:messageId/status` | Update message status (admin only) | Yes (Admin) |

#### API Endpoints - Notifications

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/notifications` | Create/update notification setting | Yes |
| GET | `/api/v1/notifications` | Get user's notification setting | Yes |
| PATCH | `/api/v1/notifications` | Update notification time/timezone | Yes |
| DELETE | `/api/v1/notifications` | Delete notification setting | Yes |

### 4.8. Authentication Module

**Purpose**: Handle user authentication, JWT tokens, and password management.

#### API Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/auth/register` | Register new user account (signup) | No |
| POST | `/api/v1/auth/login` | Login and get JWT tokens | No |
| POST | `/api/v1/auth/refresh` | Refresh access token using refresh token | No |
| POST | `/api/v1/auth/logout` | Logout and invalidate refresh token | Yes |
| POST | `/api/v1/auth/verify-email` | Verify email address with token | No |
| POST | `/api/v1/auth/resend-verification` | Resend email verification token | No |
| POST | `/api/v1/auth/forgot-password` | Request password reset | No |
| POST | `/api/v1/auth/reset-password` | Reset password with token | No |
| POST | `/api/v1/auth/change-password` | Change password (requires current password) | Yes |
| GET | `/api/v1/auth/me` | Get current authenticated user | Yes |

---

## 5. Data Access Layer

### 5.1. Repository Pattern

The repository pattern abstracts data access logic, making it easier to test and maintain.

#### Base Repository Interface
```typescript
interface IBaseRepository<T> {
  findById(id: number): Promise<T | null>;
  findAll(options?: FindOptions): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T>;
  delete(id: number): Promise<void>;
}
```

#### Implementation Example
```typescript
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findById(userId: number): Promise<User | null> {
    return this.repository.findOne({
      where: { userId },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.repository.create(userData);
    return this.repository.save(user);
  }

  async update(userId: number, updates: Partial<User>): Promise<User> {
    await this.repository.update(userId, updates);
    return this.findById(userId);
  }

  async delete(userId: number): Promise<void> {
    await this.repository.delete(userId);
  }
}
```

### 5.2. Database Connection Pooling

#### Configuration
```typescript
// database.config.ts
export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false, // Never true in production
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development',
  extra: {
    max: 20, // Maximum pool size
    min: 5,  // Minimum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
});
```

### 5.3. Query Optimization

#### Using Query Builder for Complex Queries
```typescript
async getEntriesByUser(
  userId: number,
  startDate: Date,
  endDate: Date,
): Promise<Entry[]> {
  return this.repository
    .createQueryBuilder('entry')
    .leftJoinAndSelect('entry.deedItem', 'deedItem')
    .leftJoinAndSelect('deedItem.deed', 'deed')
    .leftJoinAndSelect('entry.scaleValue', 'scaleValue')
    .where('entry.userId = :userId', { userId })
    .andWhere('entry.entryDate >= :startDate', { startDate })
    .andWhere('entry.entryDate <= :endDate', { endDate })
    .orderBy('entry.entryDate', 'DESC')
    .getMany();
}
```

### 5.4. Transaction Management

#### Using Query Runner
```typescript
async createEntryWithHistory(
  userId: number,
  dto: CreateEntryDto,
): Promise<Entry> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Create entry
    const entry = await queryRunner.manager.save(Entry, {
      userId,
      deedItemId: dto.deedItemId,
      entryDate: dto.entryDate,
      scaleValueId: dto.scaleValueId,
      countValue: dto.countValue,
    });

    // Create history
    await queryRunner.manager.save(EntryHistory, {
      entryId: entry.entryId,
      userId: entry.userId,
      scaleValueId: entry.scaleValueId,
      countValue: entry.countValue,
      changeType: 'created',
    });

    await queryRunner.commitTransaction();
    return entry;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

---

## 6. Authentication & Authorization

### 6.1. Authentication Strategy

#### JWT-Based Authentication
- **Access Tokens**: Short-lived (15 minutes), stored in memory
- **Refresh Tokens**: Long-lived (7 days), stored in database/Redis
- **Token Rotation**: Refresh tokens are rotated on each use

#### Implementation
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private userService: UserService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

### 6.2. JWT Implementation

#### Token Generation
```typescript
@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateTokens(user: User): Promise<TokenResponseDto> {
    const payload = { sub: user.userId, email: user.email };
    
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    // Store refresh token in database/Redis
    await this.storeRefreshToken(user.userId, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
```

### 6.3. Permission Middleware

#### Permission Guard
```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private permissionService: PermissionService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    const requiredPermission = this.reflector.get<PermissionType>(
      'permission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const { deedItemId, ownerId } = request.params;
    
    return this.permissionService.checkPermission(
      user.userId,
      ownerId,
      deedItemId,
      requiredPermission,
    );
  }
}
```

#### Usage
```typescript
@Controller('entries')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EntryController {
  @Post()
  @RequirePermission(PermissionType.WRITE)
  async createEntry(@Body() dto: CreateEntryDto) {
    // ...
  }
}
```

### 6.4. Role-Based Access Control

#### Roles (Future Enhancement)
```typescript
enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.some((role) => user.role === role);
  }
}
```

---

## 7. Client-Side Encryption

### 7.1. Encryption Service

**Purpose**: Handle encryption key management for client-side encrypted data.

#### Module Structure
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([EncryptedKey])],
  controllers: [EncryptionController],
  providers: [EncryptionService, EncryptionKeyRepository],
  exports: [EncryptionService],
})
export class EncryptionModule {}
```

#### Key Responsibilities
1. **Store Encrypted DEKs**: Store encrypted Data Encryption Keys for data items
2. **Retrieve Keys**: Get encrypted DEKs for users
3. **Share Data**: Create new encrypted DEK rows for sharing
4. **Revoke Access**: Delete encrypted key rows

#### API Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/v1/encryption/keys` | Store encrypted DEK for data item (owner creates) | Yes |
| GET | `/api/v1/encryption/keys/:dataType/:referenceId` | Get encrypted DEK for current user on data item | Yes |
| GET | `/api/v1/encryption/keys/user` | Get all encrypted keys for current user | Yes |
| POST | `/api/v1/encryption/keys/share` | Share encrypted data with another user (create new encrypted DEK row) | Yes |
| DELETE | `/api/v1/encryption/keys/:dataType/:referenceId` | Revoke access (delete encrypted key for user) | Yes |
| GET | `/api/v1/encryption/keys/:dataType/:referenceId/users` | Get all users with access to data item | Yes |

### 7.2. Key Management

#### Service Implementation
```typescript
@Injectable()
export class EncryptionService {
  constructor(
    private encryptionKeyRepository: EncryptionKeyRepository,
  ) {}

  async storeEncryptedKey(
    userId: number,
    dataType: string,
    referenceId: number,
    encryptedDek: Buffer,
    iv: Buffer,
    dataIv: Buffer,
  ): Promise<EncryptedKey> {
    return this.encryptionKeyRepository.create({
      userId,
      dataType,
      referenceId,
      encryptedDek,
      iv,
      dataIv,
    });
  }

  async getEncryptedKey(
    userId: number,
    dataType: string,
    referenceId: number,
  ): Promise<EncryptedKey | null> {
    return this.encryptionKeyRepository.findOne({
      where: { userId, dataType, referenceId },
    });
  }

  async shareEncryptedData(
    ownerId: number,
    recipientId: number,
    dataType: string,
    referenceId: number,
    encryptedDekForRecipient: Buffer,
    iv: Buffer,
    dataIv: Buffer,
  ): Promise<EncryptedKey> {
    // Verify owner has access
    const ownerKey = await this.getEncryptedKey(ownerId, dataType, referenceId);
    if (!ownerKey) {
      throw new ForbiddenException('You do not have access to this data');
    }

    // Create new encrypted key row for recipient
    return this.encryptionKeyRepository.create({
      userId: recipientId,
      dataType,
      referenceId,
      encryptedDek: encryptedDekForRecipient,
      iv,
      dataIv,
    });
  }

  async revokeAccess(
    userId: number,
    dataType: string,
    referenceId: number,
    ownerId: number,
  ): Promise<void> {
    // Only owner can revoke access
    const ownerKey = await this.getEncryptedKey(ownerId, dataType, referenceId);
    if (!ownerKey) {
      throw new ForbiddenException('Only owner can revoke access');
    }

    await this.encryptionKeyRepository.delete({
      userId,
      dataType,
      referenceId,
    });
  }
}
```

### 7.3. Data Sharing Flow

#### Sharing Process
1. **Owner creates encrypted data**: Client encrypts data with DEK, stores encrypted data and encrypted DEK
2. **Owner shares with user**: Client encrypts DEK with recipient's public key (or shared secret), backend stores new encrypted_key row
3. **Recipient accesses data**: Client retrieves encrypted DEK, decrypts it, uses it to decrypt data
4. **Revocation**: Owner deletes encrypted_key row for specific user

#### Example Flow
```
1. Owner creates deed item:
   - Client: Encrypt name with DEK → Store encrypted name in BYTEA
   - Client: Encrypt DEK with owner's KEK → Store in encrypted_keys table

2. Owner shares with User B:
   - Client: Get DEK (decrypt with owner's KEK)
   - Client: Encrypt DEK with User B's KEK
   - Backend: Store new encrypted_keys row (userId=UserB, encryptedDek=...)

3. User B accesses deed item:
   - Backend: Return encrypted name (BYTEA) and encrypted DEK for User B
   - Client: Decrypt DEK with User B's KEK
   - Client: Decrypt name with DEK
```

---

## 8. API Design

### 8.1. RESTful Principles

The Kitaab API follows RESTful principles for consistency and predictability:

#### Resource-Based URLs
- Use nouns, not verbs: `/api/v1/deeds` not `/api/v1/getDeeds`
- Use plural nouns: `/api/v1/deeds` not `/api/v1/deed`
- Use hierarchical paths for nested resources: `/api/v1/deeds/:deedId/items`

#### HTTP Methods
- **GET**: Retrieve resources (idempotent, safe)
- **POST**: Create new resources
- **PATCH**: Partial updates (preferred over PUT)
- **DELETE**: Remove resources
- **PUT**: Full replacement (use sparingly)

#### Status Codes
- **200 OK**: Successful GET, PATCH, DELETE
- **201 Created**: Successful POST
- **204 No Content**: Successful DELETE with no response body
- **400 Bad Request**: Invalid input
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Authenticated but insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Constraint violation (e.g., duplicate entry)
- **422 Unprocessable Entity**: Validation errors
- **500 Internal Server Error**: Server errors

#### Response Format
All responses follow a consistent structure:

```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... } // Optional additional details
  }
}
```

### 8.2. Request/Response DTOs

DTOs (Data Transfer Objects) ensure type safety and validation:

#### Request DTOs
```typescript
// Create Entry DTO
export class CreateEntryDto {
  @IsNotEmpty()
  @IsNumber()
  deedItemId: number;

  @IsNotEmpty()
  @IsDateString()
  entryDate: string;

  @IsOptional()
  @IsNumber()
  scaleValueId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  countValue?: number;

  @ValidateIf(o => !o.scaleValueId && !o.countValue)
  @IsNotEmpty()
  _validateValue(): void {
    if (!this.scaleValueId && !this.countValue) {
      throw new BadRequestException('Either scaleValueId or countValue must be provided');
    }
  }
}
```

#### Response DTOs
```typescript
// Entry Response DTO
export class EntryResponseDto {
  entryId: number;
  userId: number;
  deedItemId: number;
  entryDate: string;
  scaleValueId?: number;
  countValue?: number;
  createdByUserId?: number;
  createdAt: string;
  
  // Nested objects
  deedItem?: DeedItemResponseDto;
  scaleValue?: ScaleValueResponseDto;
}
```

### 8.3. Error Handling

#### Global Exception Filter
```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object') {
        message = exceptionResponse['message'] || message;
        code = exceptionResponse['code'] || code;
      } else {
        message = exceptionResponse as string;
      }
    }

    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }
}
```

### 8.4. API Versioning

#### URL-Based Versioning
All endpoints use `/api/v1/` prefix for versioning:

```typescript
@Controller('api/v1/entries')
export class EntryController {
  // Endpoints automatically versioned
}
```

### 8.5. Complete API Endpoints Reference

#### Authentication & User Management

**Authentication:**
- `POST /api/v1/auth/register` - Register new user (signup)
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/verify-email` - Verify email
- `POST /api/v1/auth/resend-verification` - Resend verification
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `POST /api/v1/auth/change-password` - Change password
- `GET /api/v1/auth/me` - Get current user

**User Profile:**
- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update current user profile
- `GET /api/v1/users/:userId` - Get user profile by ID
- `PATCH /api/v1/users/me/preferences` - Update preferences

#### Deed Management

**Deeds:**
- `POST /api/v1/deeds` - Create deed
- `GET /api/v1/deeds` - Get all deeds
- `GET /api/v1/deeds/:deedId` - Get deed details
- `DELETE /api/v1/deeds/:deedId` - Delete deed

**Deed Items:**
- `POST /api/v1/deeds/:deedId/items` - Create deed item
- `GET /api/v1/deeds/:deedId/items` - Get deed items (hierarchy)
- `GET /api/v1/deeds/:deedId/items/:itemId` - Get deed item details
- `PATCH /api/v1/deeds/:deedId/items/:itemId` - Update deed item
- `DELETE /api/v1/deeds/:deedId/items/:itemId` - Delete deed item
- `PATCH /api/v1/deeds/:deedId/items/reorder` - Reorder items

**Scales:**
- `POST /api/v1/deeds/:deedId/scales` - Create scale
- `GET /api/v1/deeds/:deedId/scales` - Get all scales
- `GET /api/v1/deeds/:deedId/scales/active` - Get active scale

**Scale Values:**
- `POST /api/v1/scales/:scaleId/values` - Create scale value
- `GET /api/v1/scales/:scaleId/values` - Get all scale values
- `PATCH /api/v1/scales/:scaleId/values/:valueId` - Update scale value
- `DELETE /api/v1/scales/:scaleId/values/:valueId` - Delete scale value

#### Entry Management

- `POST /api/v1/entries` - Create entry
- `GET /api/v1/entries` - Get entries (with filters)
- `GET /api/v1/entries/dashboard` - Get dashboard entries
- `GET /api/v1/entries/:entryId` - Get entry details
- `PATCH /api/v1/entries/:entryId` - Update entry
- `GET /api/v1/entries/:entryId/history` - Get entry history
- `GET /api/v1/entries/deed-item/:deedItemId` - Get entries by deed item

#### Social Features

**Relations:**
- `POST /api/v1/relations` - Send connection request
- `GET /api/v1/relations` - Get all relations
- `GET /api/v1/relations/requests` - Get pending requests
- `GET /api/v1/relations/sent` - Get sent requests
- `PATCH /api/v1/relations/:relationId/accept` - Accept request
- `PATCH /api/v1/relations/:relationId/reject` - Reject request
- `PATCH /api/v1/relations/:relationId/block` - Block user
- `DELETE /api/v1/relations/:relationId` - Remove relation

**Permissions:**
- `POST /api/v1/permissions` - Grant permission
- `GET /api/v1/permissions/deed-item/:deedItemId` - Get permissions for deed item
- `GET /api/v1/permissions/relation/:relationId` - Get permissions for relation
- `PATCH /api/v1/permissions/:permissionId/revoke` - Revoke permission
- `GET /api/v1/permissions/check` - Check permission

#### Progress Tracking

**Merits:**
- `POST /api/v1/merits` - Create merit
- `GET /api/v1/merits` - Get all merits
- `GET /api/v1/merits/:meritId` - Get merit details
- `GET /api/v1/merits/deed-item/:deedItemId` - Get merits by deed item
- `PATCH /api/v1/merits/:meritId` - Update merit
- `PATCH /api/v1/merits/:meritId/complete` - Complete merit
- `DELETE /api/v1/merits/:meritId` - Delete merit
- `GET /api/v1/merits/:meritId/progress` - Get progress

**Merit Items:**
- `POST /api/v1/merits/:meritId/items` - Add merit item
- `GET /api/v1/merits/:meritId/items` - Get merit items
- `GET /api/v1/merits/:meritId/items/:itemId` - Get merit item
- `PATCH /api/v1/merits/:meritId/items/:itemId` - Update merit item
- `DELETE /api/v1/merits/:meritId/items/:itemId` - Delete merit item

**Targets:**
- `POST /api/v1/targets` - Create target
- `GET /api/v1/targets` - Get all targets
- `GET /api/v1/targets/:targetId` - Get target details
- `PATCH /api/v1/targets/:targetId` - Update target
- `PATCH /api/v1/targets/:targetId/complete` - Complete target
- `DELETE /api/v1/targets/:targetId` - Delete target
- `GET /api/v1/targets/:targetId/progress` - Get progress

**Target Items:**
- `POST /api/v1/targets/:targetId/items` - Add target item
- `GET /api/v1/targets/:targetId/items` - Get target items
- `GET /api/v1/targets/:targetId/items/:itemId` - Get target item
- `PATCH /api/v1/targets/:targetId/items/:itemId` - Update target item
- `DELETE /api/v1/targets/:targetId/items/:itemId` - Delete target item

#### Communication

**Reflections:**
- `POST /api/v1/reflections` - Create reflection
- `GET /api/v1/reflections` - Get reflection history
- `GET /api/v1/reflections/:date` - Get reflection by date
- `GET /api/v1/reflections/:date/:type` - Get reflection by date and type
- `PATCH /api/v1/reflections/:reflectionId` - Update reflection
- `DELETE /api/v1/reflections/:reflectionId` - Delete reflection

**Messages:**
- `POST /api/v1/messages` - Send message
- `GET /api/v1/messages` - Get messages
- `GET /api/v1/messages/unread` - Get unread count
- `PATCH /api/v1/messages/:messageId/read` - Mark as read
- `PATCH /api/v1/messages/:messageId/status` - Update status (admin)

**Notifications:**
- `POST /api/v1/notifications` - Create/update notification
- `GET /api/v1/notifications` - Get notification setting
- `PATCH /api/v1/notifications` - Update notification
- `DELETE /api/v1/notifications` - Delete notification

#### Encryption (Client-Side Encryption Support)

- `POST /api/v1/encryption/keys` - Store encrypted DEK
- `GET /api/v1/encryption/keys/:dataType/:referenceId` - Get encrypted DEK
- `GET /api/v1/encryption/keys/user` - Get all user's keys
- `POST /api/v1/encryption/keys/share` - Share encrypted data
- `DELETE /api/v1/encryption/keys/:dataType/:referenceId` - Revoke access
- `GET /api/v1/encryption/keys/:dataType/:referenceId/users` - Get users with access

#### Health & Utility

- `GET /health` - Health check
- `GET /health/db` - Database health
- `GET /health/redis` - Redis health
- `GET /api/v1/stats` - User statistics

#### Admin (Optional)

- `GET /api/v1/admin/users` - List users
- `GET /api/v1/admin/users/:userId` - Get user (admin)
- `PATCH /api/v1/admin/users/:userId/activate` - Activate/deactivate user
- `GET /api/v1/admin/stats` - Platform statistics
- `GET /api/v1/admin/analytics` - Analytics data

### 8.6. Table Coverage Verification

All database tables are now covered with appropriate API endpoints:

| Table | Coverage | Endpoints |
|-------|----------|-----------|
| users | ✅ Complete | Auth, User profile endpoints |
| deeds | ✅ Complete | Deed CRUD endpoints |
| deed_items | ✅ Complete | Deed item CRUD, hierarchy, reorder |
| scales | ✅ Complete | Scale CRUD, versioning |
| scale_values | ✅ Complete | Scale value CRUD |
| entries | ✅ Complete | Entry CRUD, dashboard, history |
| entry_history | ✅ Complete | Via entries/:entryId/history |
| relations | ✅ Complete | Relation CRUD, status management |
| permissions | ✅ Complete | Permission grant/revoke, checks |
| merits | ✅ Complete | Merit CRUD, progress |
| merit_items | ✅ Complete | Merit item CRUD (sub-resource) |
| targets | ✅ Complete | Target CRUD, progress |
| target_items | ✅ Complete | Target item CRUD (sub-resource) |
| reflection_messages | ✅ Complete | Reflection CRUD |
| messages | ✅ Complete | Message CRUD, status |
| notifications | ✅ Complete | Notification CRUD |
| encrypted_keys | ✅ Complete | Encryption key management, sharing |

**Total API Endpoints: ~80+ endpoints** covering all database tables and use cases.

---

## 9. Performance Optimization

### 9.1. Caching Strategy

#### Multi-Layer Caching
1. **Application-Level Cache**: In-memory cache for frequently accessed data
2. **Redis Cache**: Distributed cache for shared data across instances
3. **Database Query Cache**: PostgreSQL query result caching

#### Implementation
```typescript
@Injectable()
export class DeedService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private deedRepository: DeedRepository,
  ) {}

  async getDeedsByUser(userId: number): Promise<DeedResponseDto[]> {
    const cacheKey = `deeds:user:${userId}`;
    const cached = await this.cacheManager.get<DeedResponseDto[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const deeds = await this.deedRepository.findByUserId(userId);
    await this.cacheManager.set(cacheKey, deeds, { ttl: 300 }); // 5 minutes
    
    return deeds;
  }
}
```

#### Cache Invalidation
```typescript
async createDeed(userId: number, dto: CreateDeedDto): Promise<DeedResponseDto> {
  const deed = await this.deedRepository.create({ userId, ...dto });
  
  // Invalidate cache
  await this.cacheManager.del(`deeds:user:${userId}`);
  
  return deed;
}
```

### 9.2. Database Query Optimization

#### Index Usage
- Leverage existing database indexes (as per database design)
- Use `EXPLAIN ANALYZE` to verify index usage
- Monitor slow queries and optimize

#### Query Optimization Tips
1. **Select Specific Columns**: Avoid `SELECT *`
2. **Use JOINs Efficiently**: Prefer JOINs over N+1 queries
3. **Limit Result Sets**: Use pagination
4. **Batch Operations**: Use `IN` clauses for multiple IDs

### 9.3. Response Compression

#### Enable Compression
```typescript
// main.ts
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(compression());
  // ...
}
```

### 9.4. Connection Pooling

Already covered in section 5.2. Key points:
- Configure appropriate pool sizes
- Monitor pool usage
- Adjust based on load

---

## 10. Scalability Patterns

### 10.1. Horizontal Scaling

#### Stateless Design
- No server-side session storage
- JWT tokens for authentication
- Shared Redis cache for distributed state

#### Load Distribution
- Multiple application instances behind load balancer
- Database connection pooling per instance
- Shared Redis for caching and sessions

### 10.2. Load Balancing

#### Nginx Configuration
```nginx
upstream backend {
    least_conn;
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    location / {
        proxy_pass http://backend;
    }
}
```

### 10.3. Microservices Considerations

#### Future Architecture
- **User Service**: Authentication, user management
- **Deed Service**: Deed and deed item management
- **Entry Service**: Entry recording and history
- **Social Service**: Relations and permissions
- **Progress Service**: Merits and targets
- **Communication Service**: Messages, reflections, notifications

#### Service Communication
- REST APIs for synchronous communication
- Message queues (RabbitMQ/Kafka) for async operations
- Event-driven architecture for decoupling

### 10.4. Event-Driven Architecture

#### Event Patterns
```typescript
@Injectable()
export class EntryService {
  constructor(
    private eventEmitter: EventEmitter2,
  ) {}

  async createEntry(dto: CreateEntryDto): Promise<Entry> {
    const entry = await this.entryRepository.create(dto);
    
    // Emit event
    this.eventEmitter.emit('entry.created', {
      entryId: entry.entryId,
      userId: entry.userId,
      deedItemId: entry.deedItemId,
    });
    
    return entry;
  }
}
```

---

## 11. Error Handling & Logging

### 11.1. Global Exception Filters

Already covered in section 8.3. Additional filters:

#### Validation Exception Filter
```typescript
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const exceptionResponse = exception.getResponse();

    response.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: exceptionResponse['message'],
      },
    });
  }
}
```

### 11.2. Structured Logging

#### Winston Configuration
```typescript
import * as winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

#### Usage
```typescript
@Injectable()
export class EntryService {
  private readonly logger = new Logger(EntryService.name);

  async createEntry(dto: CreateEntryDto): Promise<Entry> {
    this.logger.log(`Creating entry for user ${dto.userId}`);
    
    try {
      const entry = await this.entryRepository.create(dto);
      this.logger.log(`Entry ${entry.entryId} created successfully`);
      return entry;
    } catch (error) {
      this.logger.error(`Failed to create entry: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

### 11.3. Error Tracking

#### Sentry Integration (Optional)
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// In exception filter
catch(exception: unknown, host: ArgumentsHost) {
  Sentry.captureException(exception);
  // ... handle exception
}
```

---

## 12. Validation & Security

### 12.1. Input Validation

#### DTO Validation
```typescript
export class CreateEntryDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  deedItemId: number;

  @IsNotEmpty()
  @IsDateString()
  entryDate: string;

  @ValidateIf(o => !o.scaleValueId)
  @IsNumber()
  @Min(0)
  countValue?: number;
}
```

#### Global Validation Pipe
```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

### 12.2. SQL Injection Prevention

#### Parameterized Queries
TypeORM automatically uses parameterized queries:
```typescript
// Safe - uses parameters
this.repository.findOne({
  where: { userId: userInput },
});

// Also safe - query builder uses parameters
this.repository
  .createQueryBuilder('entry')
  .where('entry.userId = :userId', { userId: userInput })
  .getMany();
```

### 12.3. Rate Limiting

#### Implementation
```typescript
import * as rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

#### Per-Endpoint Rate Limiting
```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle(5, 60) // 5 requests per 60 seconds
  async login(@Body() dto: LoginDto) {
    // ...
  }
}
```

### 12.4. CORS Configuration

#### Setup
```typescript
// main.ts
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

## 13. Testing Strategy

### 13.1. Unit Testing

#### Service Tests
```typescript
describe('EntryService', () => {
  let service: EntryService;
  let repository: MockType<EntryRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EntryService,
        {
          provide: EntryRepository,
          useFactory: () => ({
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get<EntryService>(EntryService);
    repository = module.get(EntryRepository);
  });

  it('should create an entry', async () => {
    const dto = { deedItemId: 1, entryDate: '2024-01-01' };
    const entry = { entryId: 1, ...dto };

    repository.create.mockResolvedValue(entry);

    const result = await service.createEntry(1, dto);

    expect(result).toEqual(entry);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining(dto));
  });
});
```

### 13.2. Integration Testing

#### Database Integration Tests
```typescript
describe('EntryController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get token
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    
    authToken = response.body.data.accessToken;
  });

  it('/api/v1/entries (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deedItemId: 1,
        entryDate: '2024-01-01',
        countValue: 5,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('entryId');
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### 13.3. E2E Testing

#### Full Workflow Tests
```typescript
describe('Entry Workflow (e2e)', () => {
  it('should create entry and retrieve history', async () => {
    // Create entry
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ deedItemId: 1, entryDate: '2024-01-01', countValue: 5 });

    const entryId = createResponse.body.data.entryId;

    // Get history
    const historyResponse = await request(app.getHttpServer())
      .get(`/api/v1/entries/${entryId}/history`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(historyResponse.body.data).toHaveLength(1);
    expect(historyResponse.body.data[0].changeType).toBe('created');
  });
});
```

### 13.4. Performance Testing

#### Load Testing
- Use tools like **k6**, **Artillery**, or **Apache Bench**
- Test critical endpoints under load
- Monitor response times and error rates
- Identify bottlenecks

---

## 14. Monitoring & Observability

### 14.1. Health Checks

#### Implementation
```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
```

### 14.2. Metrics Collection

#### Prometheus Integration
```typescript
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [PrometheusModule.register()],
})
export class AppModule {}
```

### 14.3. Distributed Tracing

#### OpenTelemetry (Optional)
- Track requests across services
- Identify performance bottlenecks
- Monitor service dependencies

### 14.4. Alerting

#### Alert Rules
- High error rate (> 5% of requests)
- Slow response times (p95 > 500ms)
- Database connection pool exhaustion
- High memory/CPU usage

---

## 15. Deployment & DevOps

### 15.1. Docker Configuration

#### Dockerfile
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=kitaab
      - POSTGRES_USER=kitaab
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 15.2. CI/CD Pipeline

#### GitHub Actions Example
```yaml
name: CI/CD

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Deployment steps
```

### 15.3. Environment Configuration

#### Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=kitaab
DB_PASSWORD=secret
DB_NAME=kitaab

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=https://app.kitaab.com
```

### 15.4. Database Migrations

#### Migration Commands
```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

---

## 16. Appendix

### 16.1. Environment Variables

Complete list of environment variables (see section 15.3).

### 16.2. API Endpoints Reference

Complete API endpoints reference (see section 8.5).

### 16.3. Common Patterns & Examples

#### Current User Decorator
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Usage
@Get('me')
async getProfile(@CurrentUser() user: User) {
  return user;
}
```

#### Pagination Helper
```typescript
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
```

#### Response Interceptor
```typescript
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
```

---

**End of Document**


