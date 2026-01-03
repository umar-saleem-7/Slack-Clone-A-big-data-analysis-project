# Slack Clone - Big Data Project

A scalable team communication platform built with modern web technologies and a distributed storage architecture, designed to handle large-scale message data efficiently.

## 🏗️ Architecture Overview

This project implements a **Slack-like communication platform** with a focus on scalability and performance using free and open-source technologies.

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React + Vite | Modern, fast UI with real-time updates |
| **Backend** | Node.js + Express | REST API and WebSocket server |
| **Authentication** | JWT | Secure token-based auth |
| **Metadata DB** | PostgreSQL | Users, workspaces, channels (ACID) |
| **Message Store** | Apache Cassandra | High-throughput message storage |
| **Cache** | Redis | Recent messages, session data |
| **File Storage** | MinIO (S3-compatible) | Local object storage for files |
| **Search** | OpenSearch | Full-text message search |
| **Real-time** | WebSocket | Live messaging and presence |

### Storage Layer Design

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                        │
│              (React + WebSocket Client)                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  API Gateway                            │
│           (Express + WebSocket Server)                  │
└──┬──────────┬──────────┬──────────┬──────────┬─────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐  ┌─────────┐ ┌───────┐ ┌─────┐  ┌──────────┐
│ Post │  │Cassandra│ │ Redis │ │MinIO│  │OpenSearch│
│greSQL│  │         │ │       │ │     │  │          │
└──────┘  └─────────┘ └───────┘ └─────┘  └──────────┘
Metadata   Messages    Cache    Files     Search
```

## ✨ Features

### Core Features
- ✅ **User Authentication** - Secure JWT-based registration and login
- ✅ **Workspaces** - Create, join, and manage multiple workspaces
- ✅ **Public Channels** - Visible to all workspace members, auto-join on click
- ✅ **Private Channels** - Invitation-only, admin/creator can add members
- ✅ **Real-time Messaging** - Instant message delivery via WebSocket
- ✅ **Optimistic Updates** - Messages appear instantly before server confirmation
- ✅ **Typing Indicators** - See when others are typing

### Media & Files
- ✅ **File Sharing** - Upload and share files in channels
- ✅ **Voice Messages** - Record and send voice messages with inline playback
- ✅ **Image Preview** - View images inline with fullscreen expand
- ✅ **File Downloads** - Download shared files with presigned URLs

### User Experience
- ✅ **State Persistence** - Workspace and channel selection saved across refresh
- ✅ **Message History** - Persistent message storage with pagination
- ✅ **Message Search** - Full-text search across channels
- ✅ **Leave/Join Channels** - Easy channel membership management
- ✅ **Modern UI** - Clean, professional design with smooth animations

### Admin Features
- ✅ **Workspace Settings** - Update name, description
- ✅ **Member Management** - Add/remove members from private channels
- ✅ **Channel Creation** - Admin-only channel creation

## 📋 Prerequisites

- **Docker Desktop** (for Windows/Mac) or Docker Engine (for Linux)
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)

## 🚀 Quick Start

### 1. Start Database Services

```bash
docker-compose up -d
```

This starts: PostgreSQL (5432), Cassandra (9042), Redis (6379), OpenSearch (9200), MinIO (9000/9001)

**Wait 2-3 minutes** for all services to be healthy.

### 2. Setup Backend

```bash
cd backend
npm install

# Copy and configure environment
copy .env.example .env
# Edit .env with your settings

# Initialize databases
npm run init-cassandra
npm run init-opensearch

# Start server
npm start
```

Backend runs at `http://localhost:3001`

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## 📖 Usage Guide

### Getting Started

1. **Register** - Create an account with email, name, and password
2. **Create Workspace** - Start a new workspace or join existing
3. **Create Channels** - Add public or private channels (admin only)
4. **Start Messaging** - Click a channel and send messages!

### Channel Types

| Type | Visibility | Access |
|------|-----------|--------|
| **Public** | All workspace members | Auto-join when clicked |
| **Private** | Members only | Admin/creator adds members |

### Media Features

- **Voice Message**: Click 🎤 to record, preview, and send
- **Image Upload**: Click 📎 to attach images (preview inline)
- **File Sharing**: Share any file type (up to 10MB)

## 🗄️ Database Schemas

### PostgreSQL (Metadata)
- Users, Workspaces, Channels, Memberships, File Metadata
- See: `init-scripts/postgres-init.sql`

### Cassandra (Messages)
- Partitioned by channel_id, clustered by timestamp
- See: `init-scripts/cassandra-init.cql`

### Redis (Cache)
- Recent messages: `channel:messages:{channelId}`
- Online users tracking

### OpenSearch (Search)
- Full-text indexed messages
- Searchable by text, user, channel

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Workspaces
- `GET /api/workspaces` - Get user's workspaces
- `POST /api/workspaces` - Create workspace
- `PUT /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace
- `POST /api/workspaces/:id/join` - Join workspace
- `POST /api/workspaces/:id/leave` - Leave workspace

### Channels
- `GET /api/channels/workspace/:id` - Get channels
- `POST /api/channels` - Create channel
- `POST /api/channels/:id/join` - Join channel
- `POST /api/channels/:id/leave` - Leave channel
- `POST /api/channels/:id/members` - Add member
- `DELETE /api/channels/:id/members/:userId` - Remove member

### Messages
- `GET /api/messages/:channelId` - Get messages
- `POST /api/messages` - Send message
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id` - Get file info & URL
- `DELETE /api/files/:id` - Delete file

### Search
- `GET /api/search?q=keyword&workspaceId=...` - Search messages

## 🔌 WebSocket Events

### Client → Server
- `auth` - Authenticate connection
- `join_channel` - Subscribe to channel
- `leave_channel` - Unsubscribe from channel
- `send_message` - Send message
- `typing_start/stop` - Typing indicators

### Server → Client
- `auth_success` - Authentication successful
- `new_message` - New message received
- `user_typing` - User is typing

## 📊 Scalability Features

1. **Write-Heavy Workload** - Cassandra handles high message throughput
2. **Read Optimization** - Redis caches recent messages
3. **Horizontal Scaling** - All databases support scaling
4. **Partitioning** - Messages partitioned by channel_id

## 🛠️ Troubleshooting

### Cassandra Connection
```bash
docker exec slack-cassandra cqlsh -e "describe keyspaces"
```

### PostgreSQL Connection
```bash
docker exec -it slack-postgres psql -U slack_user -d slack_metadata
```

### Redis Connection
```bash
docker exec slack-redis redis-cli ping  # Returns: PONG
```

### MinIO Connection
- Console: http://localhost:9001 (minioadmin/minioadmin)

## 📝 Project Structure

```
Slack-clone/
├── docker-compose.yml          # Docker services
├── init-scripts/               # Database init scripts
├── backend/                    # Node.js backend
│   ├── src/
│   │   ├── config/            # Database connections
│   │   ├── middleware/        # Auth, error handling
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── websocket/         # WebSocket handlers
│   │   └── server.js
│   └── package.json
└── frontend/                   # React frontend
    ├── src/
    │   ├── components/        # UI components
    │   ├── pages/             # Page components
    │   ├── services/          # API/WebSocket clients
    │   └── styles/            # CSS files
    └── package.json
```

## 📄 License

This project is created for educational purposes as part of a Big Data Analysis course project.

## 👥 Contributors

- Umar Saleem, Hafiz Muhammad Mustafa, Kaneez Fatima

## 🙏 Acknowledgments

- Inspired by Slack's architecture
- Built with free and open-source technologies
- Designed for learning distributed systems and scalable architectures
