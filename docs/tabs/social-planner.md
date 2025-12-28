# Social Planner

## Purpose
The Social Planner page manages social media content scheduling and publishing across multiple platforms. It provides a calendar view for planning and a content library.

## UI Behavior

### Layout Structure
1. **Header**:
   - Title
   - Connected accounts display
   - New Post button

2. **Calendar View**:
   - Month/week toggle
   - Scheduled posts on dates
   - Drag to reschedule
   - Click to edit

3. **Content Queue (Sidebar)**:
   - Upcoming scheduled posts
   - Draft posts
   - Published history

4. **Post Composer**:
   - Platform selection (multi-select)
   - Text content
   - Media upload
   - Schedule date/time
   - Preview per platform

### Interactions
- **Create Post**: Open composer modal
- **Schedule Post**: Set date/time for publishing
- **Edit Post**: Modify scheduled content
- **Reschedule**: Drag post to new date
- **View Analytics**: Post performance metrics

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/social/posts` | GET | List posts |
| `/api/social/posts` | POST | Create post |
| `/api/social/posts/:id` | PATCH | Update post |
| `/api/social/accounts` | GET | Connected accounts |

## Backend/API Interactions
- Posts stored with scheduled timestamp
- Media uploaded to storage
- Publishing handled by external service

## Automation (Neo8) Involvement
- **Scheduled Publishing**: n8n triggers at scheduled time
- **Platform APIs**: Facebook, Instagram, Twitter, LinkedIn
- **Analytics Sync**: Engagement metrics pulled periodically

## Supported Platforms
- Facebook
- Instagram
- Twitter/X
- LinkedIn
- (Extensible to others)

## Design Tokens
- Calendar: `bg-glass-surface`
- Post cards: Platform-colored accent
- Draft: `opacity-60`
- Published: `text-emerald-500` checkmark

## Test IDs
- `button-new-post`: Create button
- `post-card-{id}`: Post cards
- `calendar-day-{date}`: Calendar cells
- `platform-toggle-{platform}`: Platform selectors
