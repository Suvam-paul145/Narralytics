# 🔄 Narralytics Backend System Workflow

Visual guide to how the backend processes requests from authentication to report generation.

---

## 🎯 System Overview

The backend handles 5 major workflows:

1. **Authentication** - Google OAuth → JWT tokens
2. **Dataset Upload** - CSV/Excel → SQLite + MongoDB
3. **Auto Dashboard** - Schema → AI-generated charts
4. **Query & Chat** - Natural language → Visualizations
5. **Report Generation** - Charts → PDF with AI summary

---

## 1️⃣ Authentication Flow

```
Browser → /auth/google → Google OAuth → /auth/callback → JWT Token → Frontend
```

**Components:**
- `routers/auth.py` - OAuth routes
- `auth/oauth.py` - Google API calls
- `auth/jwt_handler.py` - Token creation
- `database/users.py` - User storage

**MongoDB Document:**
```javascript
{
  "google_sub": "103847562819374650",
  "email": "user@example.com",
  "name": "John Doe",
  "created_at": "2024-01-15T10:00:00Z",
  "datasets": []
}
```

---

## 2️⃣ Dataset Upload Flow

```
CSV File → Parse (Pandas) → Detect Schema → Create SQLite → Save Metadata → Response
```

**Steps:**
1. Validate file type (.csv/.xlsx)
2. Parse with Pandas
3. Detect column types (numeric/datetime/categorical)
4. Normalize column names (remove spaces, special chars)
5. Create SQLite database with "data" table
6. Save metadata to MongoDB
7. Link to user's datasets array

**Files Created:**
- `uploads/uuid.csv` - Original file
- `uploads/uuid.db` - SQLite database

**Why SQLite?**
- Fast SQL queries (milliseconds)
- Isolated per dataset
- No server setup needed
- Easy to delete/move

---

## 3️⃣ Auto Dashboard Generation

```
Schema → LLM Prompt → Gemini → 6-10 Chart Specs → Execute SQL → Return Data
```

**Process:**
1. Load dataset schema from MongoDB
2. Build prompt with column info
3. Send to Google Gemini 1.5 Flash
4. LLM analyzes and returns chart specifications
5. Execute SQL for each chart
6. Attach data to chart specs
7. Return complete dashboard

**Chart Selection Logic:**
- **Line**: Time-series (date X-axis)
- **Bar**: Category comparison (categorical X-axis)
- **Pie**: Proportions (max 6 slices)
- **Scatter**: Correlations (numeric X and Y)

---

## 4️⃣ Query & Chat Flow

### Natural Language to Chart

```
"Show top 5 products" → LLM → SQL + Chart Type → Execute → Return Options
```

**Features:**
- Supports 1 or 2 chart output options
- Maintains conversation history (last 6 turns)
- Schema injection prevents hallucination
- Cannot answer gate for out-of-scope queries

### Conversational Chat

```
"What was total revenue?" → LLM → Narrative Answer + SQL → Execute → Refine Answer
```

**Features:**
- Business analyst persona
- 2-4 sentence executive answers
- Supporting SQL for specific numbers
- Explicit forecast detection

---

## 5️⃣ Report Generation Flow

```
Select Charts → Generate Summary (LLM) → Build PDF (ReportLab) → Download
```

**Steps:**
1. User selects charts from canvas
2. Frontend captures chart screenshots (base64 PNG)
3. LLM generates executive summary
4. Build statistical overview table
5. Create PDF with ReportLab
6. Embed charts and insights
7. Stream PDF to browser

---

## 🔐 Security Flow

Every protected request:

```
Request → Extract JWT → Verify Signature → Get User ID → Check Authorization → Process
```

**Data Isolation:**
- Each user can only access their own datasets
- MongoDB queries filtered by user_id
- JWT contains user identity

---

## 📊 Data Storage Strategy

| Storage | What | Why |
|---------|------|-----|
| MongoDB | Users, metadata, history | Flexible schema, cloud-native |
| SQLite | Query tables | Fast SQL, isolated |
| Local Files | Original CSV/Excel | Backup, re-processing |

---

## 🚀 Performance Features

1. **Schema Caching** - Detected once, reused forever
2. **Async Operations** - Non-blocking MongoDB calls
3. **Read-only SQL** - Safe and fast
4. **Conversation Limits** - Last 10 turns only

---

## 🔄 Error Handling

- **LLM Errors** → "cannot_answer: true" → Friendly message
- **SQL Errors** → Empty data + error → Error card
- **MongoDB Errors** → Log + continue → Non-fatal
- **File Errors** → 400 with reason → User retry

---

## 🎯 Why This Architecture?

1. **Separation of Concerns** - Each module has one job
2. **Testability** - Independent module testing
3. **Scalability** - Stateless, ready for AWS Lambda
4. **Security First** - JWT auth, SQL injection prevention
5. **Developer Experience** - Clear structure, type hints

---

**Complete workflow documentation for the Narralytics backend system**
