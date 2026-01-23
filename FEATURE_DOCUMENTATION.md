# Comprehensive Feature Documentation
## Tournament Leaderboard Application

---

## Table of Contents
1. [Overview](#overview)
2. [Technical Architecture](#technical-architecture)
3. [Core Features](#core-features)
4. [User Interface (UI)](#user-interface-ui)
5. [User Experience (UX)](#user-experience-ux)
6. [Data Flow & Integration](#data-flow--integration)
7. [Admin Features](#admin-features)
8. [Public Leaderboard Features](#public-leaderboard-features)

---

## Overview

This is a **real-time tournament leaderboard application** designed for Roblox gaming tournaments. It tracks player performance, displays rankings, and manages tournament data across multiple events. The application supports two main tournament formats: **Hobby Horizon** (multi-day with tournament types) and **RVNC Jan 24th** (single-day format).

### Key Capabilities
- Real-time leaderboard updates with auto-refresh
- Multi-event support (switch between different tournaments)
- Multi-day tournament tracking (Saturday/Sunday)
- Dual tournament types for Sunday (All-Day and Special 1PM)
- Automatic player registration via webhook integration
- Manual player management through admin dashboard
- Pending winner approval workflow
- Game status control (START/STOP tournament)
- Roblox API integration for user data and avatars

---

## Technical Architecture

### **Technology Stack**

#### Frontend
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS 4.1
- **Animations**: Framer Motion 12.23
- **Icons**: Lucide React
- **Type Safety**: TypeScript 5.9

#### Backend
- **Database**: Supabase (PostgreSQL)
- **API**: Next.js API Routes (Server Actions)
- **Caching**: Next.js Cache Revalidation
- **External APIs**: Roblox Users API, Roblox Thumbnails API

#### Infrastructure
- **Deployment**: Vercel (Next.js optimized)
- **Data Persistence**: Supabase PostgreSQL with JSON fallback
- **Real-time Updates**: Path revalidation + auto-refresh polling

### **Database Schema**

#### Players Table
```typescript
{
  id: string (UUID)
  roblox_user_id: string
  username: string
  displayname: string
  wins: number
  points: number
  avatar_url: string
  created_at: timestamp
  day: string | null (nullable for RVNC events)
  tournament_type: 'all-day' | 'special' | null
  event: string (e.g., 'hobby-horizon', 'rvnc-jan-24th')
}
```

#### Pending Winners Table
```typescript
{
  username: string
  wins: number
  points: number
  day: string | null
  tournament_type: 'all-day' | 'special' | null
}
```

#### Game Status Table
- Stores current tournament state: `'START'` or `'STOP'`

### **API Architecture**

#### Server Actions (`lib/actions.ts`)
- `getPlayers()` - Fetch players with filtering
- `getPendingWinners()` - Get unapproved winners
- `addPlayerAction()` - Manually register player
- `deletePlayerAction()` - Remove player
- `updateWinsAction()` - Increment/decrement wins
- `updatePointsAction()` - Increment/decrement points
- `approvePendingWinnerAction()` - Convert pending to registered player

#### API Routes
1. **`/api/webhook/roblox`** (POST)
   - Receives tournament results from Roblox game
   - Supports multiple formats (single winner, top 10, array)
   - Processes winners with point allocation
   - Creates/updates player records
   - Batch fetches avatars

2. **`/api/game/control`** (POST)
   - Updates tournament status (START/STOP)
   - Revalidates admin page

3. **`/api/game/status`** (GET)
   - Returns current tournament status
   - Force-dynamic (no caching)

### **Roblox Integration**

#### User Data Fetching (`lib/roblox.ts`)
- **Search API**: `https://users.roblox.com/v1/users/search`
- **Retry Logic**: Exponential backoff (3 retries, up to 8s delay)
- **Timeout**: 30 seconds per request
- **Exact Match**: Case-insensitive username matching

#### Avatar Fetching
- **Single Avatar**: `https://thumbnails.roblox.com/v1/users/avatar-headshot`
- **Batch Avatars**: `https://thumbnails.roblox.com/v1/batch` (POST)
- **Size**: 420x420px, PNG format
- **Retry Logic**: 2 retries with 2s, 4s delays
- **Timeout**: 20 seconds per request

### **Data Flow Patterns**

1. **Webhook → Database → UI**
   - Roblox game sends POST to `/api/webhook/roblox`
   - Webhook processes winners (4 phases)
   - Database updated (Supabase)
   - Path revalidation triggers UI refresh

2. **Admin Action → Database → UI**
   - Admin performs action (add/update/delete)
   - Server action executes
   - Database updated
   - Path revalidation + router refresh

3. **Auto-Refresh → UI Update**
   - Client-side polling (15s interval)
   - Router refresh triggers server component re-render
   - Fresh data fetched from database

---

## Core Features

### **1. Multi-Event Support**

The application supports multiple tournament events simultaneously:

- **RVNC Jan 24th**: Single-day format, no day/tournament filtering
- **Hobby Horizon**: Multi-day format with Saturday/Sunday and tournament types

**Implementation**:
- Event selection via dropdown menu (hamburger icon)
- URL parameter: `?event=hobby-horizon` or `?event=rvnc-jan-24th`
- Database filtering by `event` column
- Backward compatibility: old players default to `hobby-horizon`

### **2. Day-Based Filtering (Hobby Horizon)**

- **Saturday**: All-day tournament only
- **Sunday**: Two tournament types (All-Day and Special 1PM)

**Auto-Detection**:
- Current day determined by system time
- Special tournament: Sunday 1PM-2PM (auto-detected)
- Manual override via URL parameters

### **3. Tournament Type System**

- **All-Day**: Full-day tournament (default for Saturday, option for Sunday)
- **Special (1PM)**: Sunday-only tournament from 1PM-2PM

**URL Parameters**:
- `?day=saturday` or `?day=sunday`
- `?tournament=all-day` or `?tournament=special`

### **4. Scoring System**

#### Points Allocation (Top 10)
- **1st Place**: 100 points
- **2nd Place**: 70 points
- **3rd Place**: 50 points
- **4th Place**: 40 points
- **5th Place**: 30 points
- **6th Place**: 20 points
- **7th-10th Place**: 10 points each

#### Wins Allocation
- **Only 1st Place**: Receives 1 win
- **All other ranks**: 0 wins

#### Ranking Logic
1. Primary: Points (descending)
2. Secondary: Wins (descending)
3. Tertiary: Creation time (for tie-breaking)

### **5. Pending Winner System**

**Workflow**:
1. Webhook receives winner data
2. If player doesn't exist → Create pending winner entry
3. Admin sees pending winners in red-highlighted section
4. Admin approves → Player registered with accrued wins/points
5. Pending entry removed

**Features**:
- Accrual: Multiple wins accumulate in pending state
- Approval: One-click approval with Roblox user verification
- Error Handling: Retry logic for Roblox API failures

### **6. Game Status Control**

**States**:
- **START**: Tournament is active (green indicator)
- **STOP**: Tournament paused/intermission (red indicator)

**Features**:
- Visual status indicator with pulse animation
- START/STOP buttons with loading states
- Prevents actions when disabled
- Real-time status updates

---

## User Interface (UI)

### **Public Leaderboard Page** (`/leaderboard`)

#### Visual Design
- **Background**: Light slate (`bg-slate-50`)
- **Typography**: Bold, uppercase headings with tight tracking
- **Layout**: Centered, max-width container (`max-w-lg`)
- **Color Scheme**: Slate grays, cyan accents, amber trophies

#### Header Section
1. **Promotional Title**: "CONGRATS TO THE HARD CORE WINNERS"
   - Large, bold, centered
   - Subtitle: "Tournament ended"

2. **Navigation Bar**:
   - Back arrow (left) - placeholder
   - "LEADERBOARD" title (center)
   - Event menu (right) - hamburger icon

3. **Filter Tabs** (Hobby Horizon only):
   - **Day Tabs**: SATURDAY / SUNDAY
     - Active: Dark text with cyan underline
     - Inactive: Light gray text
   - **Tournament Tabs** (Sunday only): ALL DAY / SPECIAL (1PM)
     - Same styling as day tabs

#### Top Podium (Top 3 Players)

**Layout**: Horizontal podium with 3 positions
- **2nd Place** (left): Smaller, lower
- **1st Place** (center): Largest, elevated (`-mt-8`)
- **3rd Place** (right): Smaller, lower

**Visual Elements**:
- **Crown Icon**: Yellow crown above 1st place (animated scale-in)
- **Rank Indicator**: Number with green up arrow
- **Avatar**: Circular, white border, shadow
- **Player Info**:
  - Display name (bold)
  - Username (gray, prefixed with @)
  - Points (blue, large)
  - Wins (amber trophy icon)

**Animations**:
- Staggered entrance (0s, 0.2s, 0.3s delays)
- Spring physics (stiffness: 300)
- Crown scale-in (0.5s delay)

#### Leaderboard Rows (4th+)

**Layout**: Vertical list with rounded cards

**Visual Elements**:
- **Rank**: Large number (left)
- **Trend Arrow**: Red down arrow (static for 4th+)
- **Avatar**: 48px circular
- **Player Info**:
  - Display name (bold, dark)
  - Username (gray, small)
- **Stats** (right-aligned):
  - Points (blue, large, tabular numbers)
  - Wins (amber trophy icon)

**Styling**:
- White background
- Rounded corners (`rounded-[2rem]`)
- Shadow (`shadow-sm`)
- Spacing between rows

**Animations**:
- Framer Motion layout animations
- Spring physics (stiffness: 500, damping: 30)
- Fade-in with upward motion

#### Auto-Refresh
- Invisible component
- Polls every 15 seconds
- Triggers router refresh
- No visual indicator (seamless)

### **Admin Dashboard** (`/admin`)

#### Visual Design
- **Background**: Black (`bg-black`)
- **Typography**: White text, bold headings
- **Layout**: Max-width container (`max-w-4xl`)
- **Color Scheme**: Dark theme with glass-morphism panels

#### Header
- **Title**: "Admin Dashboard" (large, bold)
- **Actions**:
  - Event menu (hamburger)
  - "View Leaderboard" link (opens in new tab)

#### Game Control Panel
- **Status Indicator**:
  - Green pulsing dot (START)
  - Red dot (STOP)
  - Large status text (RUNNING / INTERMISSION)
- **Control Buttons**:
  - START (green, disabled when running)
  - STOP (red, disabled when stopped)
  - Loading spinner during API calls

#### Filter Sections (Hobby Horizon)
- **Day Selector**: Glass panel with tabs
- **Tournament Selector**: Glass panel with tabs (Sunday only)

#### Add Player Form
- **Input**: Username field (Roblox username)
- **Button**: "Add" (blue)
- **Hidden Fields**: Day, tournament_type, event
- **Validation**: Required username

#### Pending Winners Section
**Visual Design**:
- Red accent border (left side)
- Red background tint (`bg-red-500/5`)
- Pulsing red dot indicator
- Red text colors

**Player Card**:
- Question mark avatar (red theme)
- Username (large, red)
- Stats: Unregistered wins/points
- Day/tournament info
- Approve button (green checkmark)
- Error message display (if approval fails)

#### Registered Players List
**Player Card**:
- **Avatar**: 48px circular (or "No Avatar" placeholder)
- **Info**:
  - Display name (large, bold)
  - Username, wins, points, day/tournament
- **Controls**:
  - Wins: Minus/Plus buttons (±1)
  - Points: Minus/Plus buttons (±10)
  - Delete: Trash icon (red)
- **Styling**: Glass panel with rounded corners

**Empty State**: "No players added yet." (centered, gray)

---

## User Experience (UX)

### **Navigation & Flow**

#### Public Leaderboard
1. **Entry Point**: Root redirects to `/leaderboard`
2. **Event Selection**: Click hamburger → Select event
3. **Day Selection**: Click day tab (Hobby Horizon)
4. **Tournament Selection**: Click tournament tab (Sunday)
5. **Auto-Refresh**: Seamless updates every 15s

#### Admin Dashboard
1. **Entry Point**: Navigate to `/admin`
2. **Event Selection**: Click hamburger → Select event
3. **Day/Tournament Selection**: Click tabs to filter
4. **Player Management**: Add/update/delete players
5. **Pending Approval**: Review and approve winners
6. **Game Control**: Start/stop tournament

### **Responsive Design**

#### Mobile
- Padding: `p-4` (reduced from `p-6`)
- Avatar sizes: Smaller (24px → 28px)
- Text sizes: Responsive (`text-sm sm:text-base`)
- Touch targets: Adequate spacing for buttons

#### Desktop
- Max-width containers prevent excessive width
- Centered layouts for readability
- Hover states on interactive elements

### **Loading States**

#### Admin Actions
- **Button Loading**: Spinner icon replaces action icon
- **Disabled State**: Reduced opacity, cursor-not-allowed
- **Error Display**: Red text below button (5s auto-dismiss)

#### Data Fetching
- **Suspense Boundaries**: Fallback UI for async components
- **Error Boundaries**: Graceful error pages
- **Empty States**: Helpful messages when no data

### **Error Handling**

#### User-Facing Errors
- **Roblox API Failures**: Clear error messages
- **Network Errors**: Retry logic with exponential backoff
- **Validation Errors**: Form validation feedback
- **Server Errors**: Error pages with refresh prompts

#### Developer-Facing
- **Console Logging**: Comprehensive debug logs
- **Error Tracking**: Try-catch blocks with error messages
- **Fallback Data**: Empty arrays/defaults prevent crashes

### **Performance Optimizations**

#### Client-Side
- **Image Optimization**: Next.js Image component
- **Code Splitting**: React Suspense boundaries
- **Animation Performance**: Framer Motion with GPU acceleration
- **Tabular Numbers**: Consistent number width (no layout shift)

#### Server-Side
- **Path Revalidation**: Targeted cache invalidation
- **Batch Operations**: Batch avatar fetching
- **Rate Limiting**: 100ms delays between Roblox API calls
- **Database Indexing**: Indexes on day, tournament_type, event

### **Accessibility**

#### Semantic HTML
- Proper heading hierarchy
- Button elements for actions
- Form labels and inputs

#### Visual Indicators
- Color + icon for status (not color-only)
- Hover states for interactive elements
- Focus states for keyboard navigation

#### Screen Reader Support
- `sr-only` class for icon-only buttons
- Alt text for images
- ARIA labels where needed

---

## Data Flow & Integration

### **Webhook Integration Flow**

```
Roblox Game
    ↓ POST /api/webhook/roblox
    ↓ { username, day, tournament_type, event, ... }
Next.js API Route
    ↓ Phase 1: Fetch Roblox user data (with retries)
    ↓ Phase 2: Check existing players, create/update
    ↓ Phase 3: Batch fetch avatars
    ↓ Phase 4: Update player records
Supabase Database
    ↓ INSERT/UPDATE players
    ↓ Revalidate paths
Public Leaderboard
    ↓ Auto-refresh displays new data
```

### **Admin Action Flow**

```
Admin Dashboard
    ↓ User clicks action (add/update/delete)
    ↓ Form submission / Button click
Server Action
    ↓ Validate input
    ↓ Fetch Roblox data (if needed)
    ↓ Database operation
    ↓ Revalidate paths
UI Update
    ↓ Router refresh
    ↓ Server component re-render
    ↓ Fresh data displayed
```

### **Pending Winner Approval Flow**

```
Webhook creates pending winner
    ↓
Admin sees pending winner (red highlight)
    ↓
Admin clicks approve button
    ↓
Server Action:
    1. Fetch pending winner data
    2. Fetch Roblox user (with retries)
    3. Fetch avatar (with retries)
    4. Create player with accrued wins/points
    5. Remove pending entry
    ↓
UI updates (pending removed, player added)
```

---

## Admin Features

### **Player Management**

#### Add Player
- **Input**: Roblox username
- **Process**:
  1. Fetch Roblox user data
  2. Fetch avatar
  3. Create player record
  4. Auto-assign day/tournament based on context
- **Error Handling**: User not found, API failures

#### Update Player Stats
- **Wins**: Increment/decrement by 1
- **Points**: Increment/decrement by 10
- **Validation**: Minimum 0 (no negative values)
- **Real-time**: Immediate UI update

#### Delete Player
- **Action**: One-click delete
- **Confirmation**: None (immediate)
- **Cleanup**: Removes from database

### **Pending Winner Management**

#### View Pending Winners
- **Filtering**: By day, tournament, event
- **Display**: Red-highlighted cards
- **Information**: Username, unregistered wins/points, day/tournament

#### Approve Pending Winner
- **Process**:
  1. Fetch Roblox user data (3 retries)
  2. Fetch avatar (2 retries)
  3. Create player with accrued stats
  4. Remove pending entry
- **Loading State**: Spinner, disabled button
- **Error Display**: Red text below button
- **Duration**: 20-30 seconds (Roblox API delays)

### **Game Control**

#### Start Tournament
- **Action**: Click START button
- **State**: Changes to RUNNING (green)
- **Effect**: Updates database, revalidates admin page

#### Stop Tournament
- **Action**: Click STOP button
- **State**: Changes to INTERMISSION (red)
- **Effect**: Updates database, revalidates admin page

### **Filtering & Navigation**

#### Event Selection
- **Menu**: Hamburger icon dropdown
- **Options**: RVNC Jan 24th, Hobby Horizon
- **Effect**: Filters all data by event

#### Day Selection (Hobby Horizon)
- **Tabs**: Saturday, Sunday
- **Effect**: Filters players by day
- **Auto-clear**: Tournament param when switching away from Sunday

#### Tournament Selection (Sunday)
- **Tabs**: All Day, Special (1PM)
- **Effect**: Filters players by tournament type
- **Visibility**: Only shown on Sunday

---

## Public Leaderboard Features

### **Real-Time Updates**

#### Auto-Refresh
- **Interval**: 15 seconds
- **Method**: Router refresh (server component re-render)
- **Seamless**: No loading indicators, no page flash
- **Configurable**: Interval can be adjusted

#### Manual Refresh
- **Method**: Browser refresh (F5)
- **Effect**: Full page reload with fresh data

### **Visual Rankings**

#### Top 3 Podium
- **Purpose**: Highlight winners
- **Layout**: Horizontal podium (2nd, 1st, 3rd)
- **Animations**: Staggered entrance, crown animation
- **Information**: Rank, avatar, name, points, wins

#### Leaderboard List
- **Purpose**: Show all players (4th+)
- **Layout**: Vertical list
- **Information**: Rank, avatar, name, points, wins
- **Animations**: Layout animations on rank changes

### **Filtering**

#### Event Filtering
- **Method**: Event menu dropdown
- **Options**: RVNC Jan 24th, Hobby Horizon
- **Persistence**: URL parameter

#### Day Filtering (Hobby Horizon)
- **Method**: Day tabs
- **Options**: Saturday, Sunday
- **Persistence**: URL parameter
- **Auto-default**: Current day if not specified

#### Tournament Filtering (Sunday)
- **Method**: Tournament tabs
- **Options**: All Day, Special (1PM)
- **Persistence**: URL parameter
- **Auto-default**: All Day if not specified

### **Data Display**

#### Player Information
- **Display Name**: Primary identifier (bold)
- **Username**: Secondary identifier (gray, @ prefix)
- **Avatar**: Circular image (or placeholder)
- **Points**: Large, blue, tabular numbers
- **Wins**: Amber trophy icon with number

#### Ranking Information
- **Rank Number**: Large, bold
- **Trend Indicator**: Arrow (green up for top 3, red down for 4th+)
- **Sorting**: Points → Wins → Creation time

---

## Summary

This tournament leaderboard application is a **comprehensive, production-ready system** for managing and displaying Roblox tournament results. It combines:

- **Robust Backend**: Supabase database, Next.js server actions, webhook integration
- **Modern Frontend**: React 19, Tailwind CSS, Framer Motion animations
- **Excellent UX**: Auto-refresh, responsive design, error handling
- **Admin Tools**: Full CRUD operations, pending winner approval, game control
- **Multi-Event Support**: Flexible event/day/tournament filtering
- **Roblox Integration**: User data fetching, avatar management, retry logic

The application is designed for **real-time tournament management** with a focus on **reliability**, **performance**, and **user experience**.
