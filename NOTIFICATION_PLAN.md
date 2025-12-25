# Kitaab Notification Plan

## Overview
Timezone-aware daily notifications that maintain user's local time preference. When users travel, notifications continue at their original timezone until they update via the app.

## Core Concept

### User Journey
1. **User sets notification**: "9:00 PM Pakistan Time" (PKT = UTC+5)
2. **User travels to London**: Still receives at 9 PM PKT (2 PM GMT) until app visit
3. **App detects timezone change**: Prompts user to update
4. **User updates**: Notification changes to 9 PM GMT (2 AM PKT next day)

## Database Schema

### Notifications Table
```sql
CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    notification_time TIME NOT NULL, -- User's preferred local time (e.g., 21:00)
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC', -- IANA timezone (e.g., 'Asia/Karachi')
    is_active BOOLEAN DEFAULT TRUE,
    last_timezone_check TIMESTAMP WITH TIME ZONE, -- When app last checked timezone
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT one_active_notification_per_user UNIQUE (user_id) WHERE is_active = TRUE
);

-- Indexes
CREATE INDEX idx_notifications_timezone ON notifications(timezone, notification_time) WHERE is_active = TRUE;
CREATE INDEX idx_notifications_schedule ON notifications(notification_time, timezone) WHERE is_active = TRUE;
```

## Client-Side Implementation

### Timezone Detection
```javascript
// Get user's current timezone
function getCurrentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Returns: 'Asia/Karachi', 'Europe/London', 'America/New_York', etc.
}

// Check if timezone changed
async function checkTimezoneChange(userId, storedTimezone) {
  const currentTimezone = getCurrentTimezone();
  
  if (currentTimezone !== storedTimezone) {
    // Timezone changed - prompt user
    const shouldUpdate = await promptUser(
      `Your timezone changed from ${storedTimezone} to ${currentTimezone}. ` +
      `Update notification time?`
    );
    
    if (shouldUpdate) {
      await updateNotificationTimezone(userId, currentTimezone);
    }
  }
  
  // Update last check time
  await api.updateLastTimezoneCheck(userId);
}

// Update notification timezone
async function updateNotificationTimezone(userId, newTimezone) {
  const oldTimezone = await getStoredTimezone(userId);
  const notificationTime = await getStoredNotificationTime(userId);
  
  // Convert time to new timezone (maintain same local time)
  const newTimeUTC = convertToUTC(notificationTime, oldTimezone);
  const newLocalTime = convertFromUTC(newTimeUTC, newTimezone);
  
  await api.updateNotification({
    user_id: userId,
    notification_time: newLocalTime,
    timezone: newTimezone,
    last_timezone_check: new Date()
  });
}
```

### App Launch Handler
```javascript
// On app launch/foreground
async function onAppLaunch(userId) {
  // Get stored timezone from server
  const notification = await api.getNotification(userId);
  
  if (notification && notification.is_active) {
    // Check if timezone changed
    await checkTimezoneChange(userId, notification.timezone);
  }
}
```

## Server-Side Implementation

### Notification Scheduler (Cron Job)
```python
import pytz
from datetime import datetime, time
from psycopg2.pool import ThreadedConnectionPool

def schedule_notifications():
    """
    Scheduled job runs every minute.
    Finds users who should receive notifications now.
    """
    pool = get_connection_pool()
    
    with pool.getconn() as conn:
        with conn.cursor() as cur:
            # Get current UTC time
            now_utc = datetime.utcnow()
            
            # Query all active notifications
            cur.execute("""
                SELECT user_id, notification_time, timezone
                FROM notifications
                WHERE is_active = TRUE
            """)
            
            for user_id, notif_time, timezone_str in cur.fetchall():
                # Convert notification time to UTC
                user_tz = pytz.timezone(timezone_str)
                today = now_utc.date()
                
                # Create datetime in user's timezone
                local_dt = user_tz.localize(
                    datetime.combine(today, notif_time)
                )
                utc_dt = local_dt.astimezone(pytz.UTC)
                
                # Check if notification time is within last minute
                time_diff = abs((now_utc - utc_dt.replace(tzinfo=None)).total_seconds())
                
                if time_diff <= 60:  # Within 1 minute window
                    send_notification(user_id)
                    log_notification_sent(user_id, now_utc)

def convert_notification_time(notif_time, old_tz, new_tz):
    """
    Convert notification time from old timezone to new timezone.
    Maintains same local time (e.g., 9 PM stays 9 PM).
    """
    old_pytz = pytz.timezone(old_tz)
    new_pytz = pytz.timezone(new_tz)
    
    # Create datetime in old timezone
    today = datetime.now().date()
    old_dt = old_pytz.localize(datetime.combine(today, notif_time))
    
    # Convert to UTC
    utc_dt = old_dt.astimezone(pytz.UTC)
    
    # Convert to new timezone
    new_dt = utc_dt.astimezone(new_pytz)
    
    return new_dt.time()
```

### API Endpoints

#### Get User Notification
```python
@app.get("/api/notifications/{user_id}")
def get_notification(user_id: int):
    """Get user's notification settings"""
    with pool.getconn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT notification_time, timezone, is_active, last_timezone_check
                FROM notifications
                WHERE user_id = %s
            """, (user_id,))
            
            result = cur.fetchone()
            if result:
                return {
                    "notification_time": str(result[0]),
                    "timezone": result[1],
                    "is_active": result[2],
                    "last_timezone_check": result[3].isoformat() if result[3] else None
                }
            return None
```

#### Update Notification Timezone
```python
@app.put("/api/notifications/{user_id}/timezone")
def update_timezone(user_id: int, new_timezone: str):
    """Update notification timezone (called when user confirms change)"""
    with pool.getconn() as conn:
        with conn.cursor() as cur:
            # Get current notification settings
            cur.execute("""
                SELECT notification_time, timezone
                FROM notifications
                WHERE user_id = %s AND is_active = TRUE
            """, (user_id,))
            
            result = cur.fetchone()
            if not result:
                return {"error": "No active notification found"}
            
            old_time, old_tz = result
            
            # Convert time to new timezone
            new_time = convert_notification_time(old_time, old_tz, new_timezone)
            
            # Update database
            cur.execute("""
                UPDATE notifications
                SET notification_time = %s,
                    timezone = %s,
                    last_timezone_check = NOW(),
                    updated_at = NOW()
                WHERE user_id = %s
            """, (new_time, new_timezone, user_id))
            
            conn.commit()
            return {"success": True, "new_time": str(new_time), "new_timezone": new_timezone}
```

#### Update Last Timezone Check
```python
@app.post("/api/notifications/{user_id}/check-timezone")
def update_timezone_check(user_id: int):
    """Update last timezone check timestamp (called on app launch)"""
    with pool.getconn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE notifications
                SET last_timezone_check = NOW()
                WHERE user_id = %s
            """, (user_id,))
            conn.commit()
            return {"success": True}
```

## Notification Flow

### 1. User Sets Notification
```
User: "Notify me at 9:00 PM"
App: Detects timezone = 'Asia/Karachi'
Server: Stores { notification_time: '21:00', timezone: 'Asia/Karachi' }
```

### 2. Daily Notification
```
Cron Job (runs every minute):
1. Get all active notifications
2. For each notification:
   - Convert notification_time + timezone → UTC
   - Check if current UTC time matches (within 1 min window)
   - If match: Send push notification
```

### 3. User Travels (No App Visit)
```
User travels: Pakistan → London
Notification continues at: 9 PM PKT (2 PM GMT)
Reason: timezone not updated until app visit
```

### 4. User Opens App
```
App Launch:
1. Get stored timezone from server: 'Asia/Karachi'
2. Get current device timezone: 'Europe/London'
3. Compare: Different!
4. Show prompt: "Timezone changed. Update notification?"
5. If Yes: Update to 9 PM GMT
6. If No: Keep 9 PM PKT
```

### 5. After Update
```
Server: Updates { timezone: 'Europe/London', notification_time: '21:00' }
Next notification: 9 PM GMT (2 AM PKT next day)
```

## Timezone Conversion Examples

### Example 1: Pakistan to London
```
Original: 9:00 PM Asia/Karachi (UTC+5)
After travel: 9:00 PM Europe/London (UTC+0)

UTC equivalent:
- 9 PM PKT = 4 PM UTC
- 9 PM GMT = 9 PM UTC

User sees: Still 9 PM local time
Actual UTC: Changes from 4 PM to 9 PM
```

### Example 2: London to New York
```
Original: 9:00 PM Europe/London (UTC+0)
After travel: 9:00 PM America/New_York (UTC-5)

UTC equivalent:
- 9 PM GMT = 9 PM UTC
- 9 PM EST = 2 AM UTC (next day)

User sees: Still 9 PM local time
Actual UTC: Changes from 9 PM to 2 AM next day
```

## Edge Cases

### 1. DST (Daylight Saving Time)
```
Solution: Use IANA timezones (e.g., 'America/New_York')
- Automatically handles DST transitions
- pytz library handles conversions correctly
```

### 2. User Denies Timezone Update
```
Behavior: Notification continues at original timezone
- User receives at 9 PM PKT even in London
- Can manually update later via settings
```

### 3. Multiple Timezone Changes
```
Behavior: Each app visit checks and prompts
- User travels: PKT → GMT → EST
- Each visit prompts if different from stored
```

### 4. Notification Time in Past (After Update)
```
Example: User updates at 10 PM, new timezone makes it 2 AM next day
Solution: Schedule for next occurrence (tomorrow at 9 PM)
```

## Implementation Checklist

### Client-Side
- [ ] Add timezone detection on app launch
- [ ] Compare stored vs current timezone
- [ ] Show timezone change prompt
- [ ] Implement timezone update API call
- [ ] Handle user denial gracefully
- [ ] Update last_timezone_check on each app visit

### Server-Side
- [ ] Create notifications table with timezone field
- [ ] Implement notification scheduler (cron job)
- [ ] Add timezone conversion utilities
- [ ] Create API endpoints for timezone updates
- [ ] Handle DST transitions correctly
- [ ] Log notification sends for debugging

### Testing
- [ ] Test timezone detection on different devices
- [ ] Test notification scheduling across timezones
- [ ] Test DST transitions (spring forward, fall back)
- [ ] Test user denial flow
- [ ] Test multiple timezone changes
- [ ] Verify UTC conversions are correct

## Performance Considerations

### Scheduler Optimization
- **Query Efficiency**: Index on (timezone, notification_time) for fast lookups
- **Batch Processing**: Process notifications in batches
- **Caching**: Cache active notifications in Redis (refresh every minute)
- **Rate Limiting**: Prevent duplicate notifications (check last sent time)

### Client Optimization
- **Lazy Check**: Only check timezone on app launch/foreground (not background)
- **Debounce**: Don't prompt multiple times in same session
- **Cache**: Cache timezone check result for session duration

## Security Considerations

- **Timezone Validation**: Validate IANA timezone strings server-side
- **User Verification**: Ensure user_id matches authenticated user
- **Rate Limiting**: Limit timezone update requests per user
- **Audit Log**: Log timezone changes for debugging

