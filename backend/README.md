# 🧠 Narralytics Backend

**Conversational AI for Instant Business Intelligence Dashboards**

A FastAPI-based backend that transforms CSV/Excel uploads into interactive dashboards using Google Gemini 1.5 Flash for natural language processing and chart generation.

---

## 🎯 What This Backend Does

Narralytics is an AI-powered business intelligence platform that:

1. **Authenticates users** via Google OAuth 2.0
2. **Accepts CSV/Excel uploads** and converts them to queryable SQLite databases
3. **Auto-generates dashboards** with 6-10 intelligent chart recommendations
4. **Processes natural language queries** to create custom visualizations
5. **Supports voice interaction** through text-to-speech integration
6. **Generates forecasts** using statistical extrapolation
7. **Creates PDF reports** with executive summaries and charts

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+ (Recommended: Python 3.14+)
- MongoDB (local or Atlas)
- Google Gemini API key

### Installation
```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys and configuration

# 4. Start the server
python start_server.py
```

### Access Points
- **API Server**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
│              Landing → Dashboard → Chat → Reports            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS + JWT Bearer Token
┌────────────────────────▼────────────────────────────────────┐
│                   FASTAPI APPLICATION                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routers: auth, datasets, dashboard, query, chat,     │   │
│  │          report                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ LLM Engines: auto_dashboard, chart_engine,           │   │
│  │              chat_engine, forecast_engine            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Data Layer: MongoDB (users, history, metadata)       │   │
│  │             SQLite (per-dataset query tables)        │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              EXTERNAL SERVICES                               │
│  • Google OAuth 2.0 (Authentication)                         │
│  • Google Gemini 1.5 Flash (AI/LLM)                          │
│  • MongoDB Atlas (User & History Storage)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
backend/
├── main.py                      # FastAPI app entry + CORS + startup
├── config.py                    # Environment configuration
├── requirements.txt             # Python dependencies
│
├── auth/                        # Authentication & Authorization
│   ├── oauth.py                 # Google OAuth flow
│   ├── jwt_handler.py           # JWT creation & verification
│   └── dependencies.py          # FastAPI auth dependency
│
├── database/                    # Data persistence layer
│   ├── mongodb.py               # MongoDB connection
│   ├── users.py                 # User CRUD operations
│   ├── datasets.py              # Dataset metadata CRUD
│   └── history.py               # Conversation history storage
│
├── routers/                     # API endpoint handlers
│   ├── auth.py                  # /auth/* - OAuth & JWT
│   ├── datasets.py              # /datasets/* - Upload & manage
│   ├── dashboard.py             # /dashboard/* - Auto-generation
│   ├── query.py                 # /query - NL to chart
│   ├── chat.py                  # /chat - Conversational AI
│   └── report.py                # /report - PDF generation
│
├── llm/                         # AI/LLM processing engines
│   ├── auto_dashboard.py        # Schema → 6-10 chart specs
│   ├── chart_engine.py          # NL query → 1-2 chart specs
│   ├── chat_engine.py           # NL question → narrative answer
│   ├── forecast_engine.py       # Statistical forecasting
│   └── report_engine.py         # Executive summary generation
│
├── sqlite/                      # SQLite data processing
│   ├── loader.py                # CSV → SQLite conversion
│   ├── executor.py              # Safe SQL query execution
│   └── schema_detector.py       # Column type detection
│
├── storage/                     # File storage abstraction
│   ├── local.py                 # Local filesystem (dev)
│   └── s3.py                    # AWS S3 (production)
│
├── pdf/                         # Report generation
│   └── generator.py             # ReportLab PDF builder
│
├── models/                      # Pydantic schemas
│   └── schemas.py               # Request/response models
│
└── uploads/                     # Uploaded files (gitignored)
```

---

## 🔑 Key Features

### 1. Google OAuth Authentication
- Secure user authentication via Google OAuth 2.0
- JWT token-based session management
- User profiles stored in MongoDB

### 2. Intelligent Dataset Processing
- Accepts CSV and Excel files
- Automatic schema detection (numeric, categorical, datetime columns)
- Converts to SQLite for fast querying
- Per-user dataset isolation

### 3. Auto Dashboard Generation
- Analyzes dataset schema automatically
- Generates 6-10 chart recommendations
- Covers trends, comparisons, distributions, correlations
- Executes SQL and returns ready-to-render data

### 4. Natural Language Query Processing
- Converts plain English to SQL queries
- Supports 1 or 2 chart output options
- Maintains conversation context
- Prevents hallucination with schema injection

### 5. Conversational Chat Interface
- Business analyst persona
- Generates narrative answers with supporting data
- Explicit forecast requests supported
- Historical context maintained

### 6. Statistical Forecasting
- Linear extrapolation for time-series data
- Confidence ranges included
- Only triggered on explicit user request
- Clear disclaimers about estimates

### 7. PDF Report Generation
- Executive summary generation via LLM
- Chart embedding with insights
- Statistical overview tables
- Professional formatting with ReportLab

---

## 🗄️ Database Design

### MongoDB Collections

#### `users`
```javascript
{
  "google_sub": "unique_google_id",      // Primary key
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "created_at": ISODate(),
  "last_login": ISODate(),
  "plan": "free",
  "datasets": [                          // Embedded references
    {
      "dataset_id": "uuid",
      "name": "sales_2023.csv",
      "row_count": 1000,
      "columns": ["date", "revenue", ...],
      "db_path": "/path/to/uuid.db"
    }
  ]
}
```

#### `datasets`
```javascript
{
  "dataset_id": "uuid",                  // Primary key
  "user_id": "google_sub",               // Owner
  "original_filename": "sales.csv",
  "row_count": 1000,
  "column_count": 8,
  "columns": [                           // Full schema
    {
      "name": "revenue",
      "dtype": "numeric",
      "min": 100,
      "max": 5000,
      "mean": 1250.50,
      "sample_values": ["100", "250", "500"]
    }
  ],
  "date_columns": ["order_date"],
  "numeric_columns": ["revenue", "quantity"],
  "categorical_columns": ["region", "product"],
  "db_path": "./uploads/uuid.db",
  "source_file_path": "./uploads/uuid.csv",
  "file_size_bytes": 52428,
  "uploaded_at": ISODate(),
  "last_queried": ISODate()
}
```

#### `conversation_history`
```javascript
{
  "user_id": "google_sub",
  "session_id": "uuid",                  // Groups conversation
  "dataset_id": "uuid",
  "timestamp": ISODate(),
  "type": "chart_query | chat | auto_gen | pdf",
  "payload": {
    "prompt": "Show me revenue trends",
    "response_summary": "Generated line chart...",
    "chart_types": "line",
    "sql_generated": "SELECT ...",
    "output_count": 1,
    "was_forecast": false,
    "execution_ms": 450
  }
}
```

### SQLite (Per-Dataset)
- Each uploaded dataset gets its own SQLite database
- Table name: `data`
- Columns normalized (spaces → underscores, special chars removed)
- Date columns converted to YYYY-MM-DD format
- Used for fast SQL query execution

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/google` | None | Redirect to Google OAuth |
| GET | `/auth/callback` | None | OAuth callback, returns JWT |
| GET | `/auth/me` | JWT | Get current user profile |

### Dataset Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/datasets/upload` | JWT | Upload CSV/Excel file |
| GET | `/datasets/` | JWT | List user's datasets |
| DELETE | `/datasets/{id}` | JWT | Delete dataset |

### Dashboard & Visualization
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/dashboard/auto/{dataset_id}` | JWT | Auto-generate dashboard |
| POST | `/query` | JWT | NL query → 1-2 charts |
| POST | `/chat` | JWT | Conversational Q&A |
| GET | `/history/{dataset_id}` | JWT | Get conversation history |

### Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/report/generate` | JWT | Generate PDF report |

### System
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Health check |

---

## 🤖 LLM Architecture

### Five Specialized Engines

#### 1. Auto Dashboard (`auto_dashboard.py`)
- **Input**: Dataset schema only
- **Output**: 6-10 chart specifications
- **Purpose**: Generate comprehensive dashboard on upload
- **Prompt Strategy**: Schema analysis + variety rules

#### 2. Chart Engine (`chart_engine.py`)
- **Input**: Schema + NL query + output_count (1 or 2)
- **Output**: 1-2 chart specifications with SQL
- **Purpose**: Convert natural language to visualizations
- **Prompt Strategy**: SQL generation + chart type selection

#### 3. Chat Engine (`chat_engine.py`)
- **Input**: Schema + NL question + conversation history
- **Output**: Narrative answer + optional SQL
- **Purpose**: Business analyst Q&A
- **Prompt Strategy**: Executive persona + context awareness

#### 4. Forecast Engine (`forecast_engine.py`)
- **Input**: Historical SQL result
- **Output**: Statistical extrapolation
- **Purpose**: Time-series predictions
- **Method**: NumPy linear regression (no LLM)

#### 5. Report Engine (`report_engine.py`)
- **Input**: Chart titles + insights
- **Output**: Executive summary paragraph
- **Purpose**: PDF report introduction
- **Prompt Strategy**: Management consultant persona

### Hallucination Prevention

1. **Schema Injection**: Every LLM call receives exact column names, types, and samples
2. **Cannot Answer Gate**: Both chart and chat engines return `cannot_answer: true` for out-of-scope queries
3. **SQL Validation**: Only SELECT queries allowed, single statement, read-only mode
4. **Column Verification**: LLM instructed to use ONLY listed columns

---

## 🔒 Security Features

1. **Authentication**: Google OAuth 2.0 + JWT tokens
2. **Authorization**: User-scoped dataset access
3. **SQL Injection Prevention**: Parameterized queries, read-only mode
4. **File Upload Validation**: CSV/Excel only, size limits
5. **CORS**: Configured for specific frontend origin
6. **Environment Variables**: Sensitive credentials in .env

---

## 🚀 AWS Migration Ready

This backend is designed for zero-code AWS Lambda migration:

- **Mangum handler** already included in `main.py`
- **MongoDB Atlas** works identically in cloud
- **SQLite /tmp** path compatible with Lambda ephemeral storage
- **Storage abstraction** allows easy swap to S3
- **Stateless design** perfect for serverless

Migration checklist in `AWS_MIGRATION_GUIDE.md`

---

## 📊 Technology Stack

- **Framework**: FastAPI 0.104+
- **Python**: 3.11+
- **Database**: MongoDB Atlas (users, history), SQLite (query data)
- **AI/LLM**: Google Gemini 1.5 Flash
- **Authentication**: Google OAuth 2.0, JWT
- **Data Processing**: Pandas, NumPy
- **PDF Generation**: ReportLab
- **Cloud Ready**: Mangum (AWS Lambda adapter)

---

## 📝 Environment Variables

See `.env.example` for required configuration:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=<YOUR_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:5173

# JWT
JWT_SECRET=<generate-with-secrets.token_hex(32)>
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=narralytics

# Gemini AI
GEMINI_API_KEY=AIza...

# Storage
UPLOAD_DIR=./uploads

# AWS (Production only)
AWS_REGION=us-east-1
AWS_BUCKET=narralytics-uploads
DYNAMODB_TABLE=narralytics_history
```

---

## 🎓 Learning Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Google Gemini API](https://ai.google.dev/docs)
- [MongoDB Motor (Async)](https://motor.readthedocs.io/)
- [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)

---

## 📄 License

See LICENSE file in repository root.

---

## 👥 Contributing

This is a hackathon project. For questions or contributions, please open an issue.

---

**Built with ❤️ for intelligent business analytics**
