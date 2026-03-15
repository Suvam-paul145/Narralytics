# 🧪 Narralytics Backend Testing Guide

Comprehensive guide to test your backend system and verify all components are working correctly.

---

## 🎯 Testing Overview

This guide covers:
1. **Health Checks** - Basic system verification
2. **Authentication Testing** - OAuth and JWT flow
3. **Dataset Upload Testing** - File processing pipeline
4. **API Endpoint Testing** - All routes and responses
5. **LLM Integration Testing** - AI functionality
6. **Database Testing** - MongoDB operations
7. **Error Handling Testing** - Edge cases and failures

---

## 🚀 Quick Health Check

### 1. Server Status
```bash
curl http://localhost:8000/health
```
**Expected Response:**
```json
{"status": "ok"}
```

### 2. API Documentation
Open in browser: `http://localhost:8000/docs`

Should show interactive Swagger UI with all endpoints.

---

## 🔐 Authentication Testing

### Test 1: OAuth Redirect
```bash
curl -I http://localhost:8000/auth/google
```
**Expected:** 307 redirect to `accounts.google.com`

### Test 2: Complete OAuth Flow
1. Open: `http://localhost:8000/auth/google`
2. Sign in with Google
3. Should redirect to: `http://localhost:5173/auth/callback#token=eyJ...`
4. Extract JWT token from URL fragment

### Test 3: JWT Verification
```bash
# Replace YOUR_JWT_TOKEN with actual token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/auth/me
```
**Expected Response:**
```json
{
  "sub": "103847562819374650",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

---

## 📁 Dataset Upload Testing

### Test 1: Create Test CSV
```bash
# Create test file
cat > test_sales.csv << EOF
date,revenue,region,product
2024-01-01,1000,North,Widget A
2024-01-02,1500,South,Widget B
2024-01-03,1200,East,Widget A
2024-01-04,1800,West,Widget C
2024-01-05,2000,North,Widget B
EOF
```

### Test 2: Upload Dataset
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test_sales.csv" \
  http://localhost:8000/datasets/upload
```

**Expected Response:**
```json
{
  "dataset_id": "abc123-def456-...",
  "filename": "test_sales.csv",
  "row_count": 5,
  "columns": ["date", "revenue", "region", "product"],
  "date_columns": ["date"],
  "numeric_columns": ["revenue"],
  "message": "Dataset ready. Generating dashboard..."
}
```

### Test 3: List Datasets
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/datasets/
```

**Expected Response:**
```json
{
  "datasets": [
    {
      "dataset_id": "abc123-def456-...",
      "original_filename": "test_sales.csv",
      "row_count": 5,
      "uploaded_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## 📊 Dashboard Testing

### Test 1: Auto-Generate Dashboard
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8000/dashboard/auto/YOUR_DATASET_ID
```

**Expected Response:**
```json
{
  "dataset_id": "abc123-def456-...",
  "chart_count": 6,
  "charts": [
    {
      "chart_id": "c1",
      "title": "Revenue Trend Over Time",
      "chart_type": "line",
      "x_key": "date",
      "y_key": "revenue",
      "data": [
        {"date": "2024-01-01", "revenue": 1000},
        {"date": "2024-01-02", "revenue": 1500}
      ],
      "sql": "SELECT date, SUM(revenue) AS revenue FROM data GROUP BY date ORDER BY date",
      "insight": "Revenue shows an upward trend with 25% growth",
      "error": null
    }
  ]
}
```

---

## 🗣️ Query Testing

### Test 1: Natural Language Query
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Show me top 3 regions by revenue",
    "dataset_id": "YOUR_DATASET_ID",
    "output_count": 1,
    "history": []
  }' \
  http://localhost:8000/query
```

**Expected Response:**
```json
{
  "cannot_answer": false,
  "dataset_id": "abc123-def456-...",
  "output_count": 1,
  "options": [
    {
      "spec": {
        "title": "Top 3 Regions by Revenue",
        "chart_type": "bar",
        "sql": "SELECT region, SUM(revenue) AS total_revenue FROM data GROUP BY region ORDER BY total_revenue DESC LIMIT 3",
        "x_key": "region",
        "y_key": "total_revenue"
      },
      "data": [
        {"region": "West", "total_revenue": 1800},
        {"region": "North", "total_revenue": 3000},
        {"region": "South", "total_revenue": 1500}
      ],
      "error": null
    }
  ]
}
```

### Test 2: Cannot Answer Query
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Show me customer satisfaction scores",
    "dataset_id": "YOUR_DATASET_ID",
    "output_count": 1,
    "history": []
  }' \
  http://localhost:8000/query
```

**Expected Response:**
```json
{
  "cannot_answer": true,
  "reason": "This dataset does not contain customer satisfaction information. Available columns are: date, revenue, region, product.",
  "dataset_id": "abc123-def456-...",
  "output_count": 1
}
```

---

## 💬 Chat Testing

### Test 1: Business Question
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What was the total revenue?",
    "dataset_id": "YOUR_DATASET_ID",
    "history": []
  }' \
  http://localhost:8000/chat
```

**Expected Response:**
```json
{
  "answer": "The total revenue across all regions was $7,500, with the North region contributing the highest amount at $3,000. This represents strong performance across all geographic areas.",
  "supporting_sql": "SELECT SUM(revenue) AS total_revenue FROM data",
  "data_used": [
    {"total_revenue": 7500}
  ],
  "cannot_answer": false,
  "forecast": null,
  "is_forecast": false
}
```

### Test 2: Forecast Request
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What will revenue be next month?",
    "dataset_id": "YOUR_DATASET_ID",
    "history": []
  }' \
  http://localhost:8000/chat
```

**Expected Response:**
```json
{
  "answer": "Based on the historical trend, revenue is projected to continue growing. The forecast suggests next month could see approximately $2,200 in revenue.",
  "supporting_sql": "SELECT date, SUM(revenue) AS revenue FROM data GROUP BY date ORDER BY date",
  "is_forecast": true,
  "forecast": {
    "success": true,
    "forecast": [
      {
        "period": "Forecast +1",
        "value": 2200,
        "lower_bound": 1870,
        "upper_bound": 2530
      }
    ],
    "method": "Linear extrapolation",
    "disclaimer": "This is a statistical estimate, not a guaranteed prediction."
  }
}
```

---

## 📄 Report Testing

### Test 1: Generate PDF Report
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "YOUR_DATASET_ID",
    "charts": [
      {
        "title": "Revenue Trend",
        "insight": "Revenue shows 25% growth",
        "chart_type": "line",
        "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
      }
    ],
    "include_stats": true
  }' \
  --output report.pdf \
  http://localhost:8000/report/generate
```

**Expected:** PDF file downloaded as `report.pdf`

---

## 🗄️ Database Testing

### Test MongoDB Connection
Create `test_mongodb.py`:

```python
import asyncio
from database.mongodb import connect_mongodb, get_db

async def test_mongodb():
    print("Testing MongoDB connection...")
    
    try:
        await connect_mongodb()
        db = get_db()
        
        # Test write
        result = await db.test_collection.insert_one({"test": "data", "timestamp": "2024-01-15"})
        print(f"✓ Write successful: {result.inserted_id}")
        
        # Test read
        doc = await db.test_collection.find_one({"_id": result.inserted_id})
        print(f"✓ Read successful: {doc}")
        
        # Test query
        count = await db.test_collection.count_documents({"test": "data"})
        print(f"✓ Query successful: {count} documents found")
        
        # Cleanup
        await db.test_collection.delete_one({"_id": result.inserted_id})
        print("✓ Cleanup successful")
        
        print("🎉 MongoDB connection test passed!")
        
    except Exception as e:
        print(f"❌ MongoDB test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_mongodb())
```

Run: `python test_mongodb.py`

### Test SQLite Operations
Create `test_sqlite.py`:

```python
import pandas as pd
from sqlite.loader import load_csv_to_sqlite
from sqlite.executor import execute_query
from sqlite.schema_detector import detect_schema
import os

def test_sqlite():
    print("Testing SQLite operations...")
    
    # Create test data
    df = pd.DataFrame({
        'date': ['2024-01-01', '2024-01-02', '2024-01-03'],
        'revenue': [1000, 1500, 1200],
        'region': ['North', 'South', 'East']
    })
    
    try:
        # Test schema detection
        schema = detect_schema(df)
        print(f"✓ Schema detection: {len(schema['columns'])} columns")
        print(f"  - Numeric: {schema['numeric_columns']}")
        print(f"  - Categorical: {schema['categorical_columns']}")
        
        # Test SQLite creation
        db_path = "test_dataset.db"
        load_csv_to_sqlite(df, db_path)
        print(f"✓ SQLite creation: {db_path}")
        
        # Test query execution
        result = execute_query(db_path, "SELECT * FROM data LIMIT 2")
        print(f"✓ Query execution: {len(result)} rows returned")
        print(f"  Sample: {result[0] if result else 'No data'}")
        
        # Test aggregation
        agg_result = execute_query(db_path, "SELECT region, SUM(revenue) as total FROM data GROUP BY region")
        print(f"✓ Aggregation: {len(agg_result)} groups")
        
        # Cleanup
        os.remove(db_path)
        print("✓ Cleanup successful")
        
        print("🎉 SQLite test passed!")
        
    except Exception as e:
        print(f"❌ SQLite test failed: {e}")
        if os.path.exists(db_path):
            os.remove(db_path)

if __name__ == "__main__":
    test_sqlite()
```

Run: `python test_sqlite.py`

---

## 🤖 LLM Testing

### Test Gemini API Connection
Create `test_gemini.py`:

```python
from llm.auto_dashboard import generate_auto_dashboard
from llm.chart_engine import get_chart_specs
from llm.chat_engine import get_chat_response

def test_gemini():
    print("Testing Gemini API connection...")
    
    # Sample schema
    schema = {
        "row_count": 5,
        "columns": [
            {"name": "date", "dtype": "datetime", "sample_values": ["2024-01-01", "2024-01-02"]},
            {"name": "revenue", "dtype": "numeric", "min": 1000, "max": 2000, "sample_values": ["1000", "1500"]},
            {"name": "region", "dtype": "categorical", "sample_values": ["North", "South", "East"]}
        ],
        "date_columns": ["date"],
        "numeric_columns": ["revenue"],
        "categorical_columns": ["region"]
    }
    
    try:
        # Test auto dashboard
        print("Testing auto dashboard generation...")
        charts = generate_auto_dashboard(schema)
        print(f"✓ Auto dashboard: {len(charts)} charts generated")
        if charts:
            print(f"  Sample chart: {charts[0].get('title', 'No title')}")
        
        # Test chart engine
        print("Testing chart engine...")
        result = get_chart_specs(schema, "Show revenue by region", [], 1)
        print(f"✓ Chart engine: {'Success' if not result.get('cannot_answer') else 'Cannot answer'}")
        
        # Test chat engine
        print("Testing chat engine...")
        chat_result = get_chat_response(schema, "test_data.csv", "What is the total revenue?", [])
        print(f"✓ Chat engine: {'Success' if not chat_result.get('cannot_answer') else 'Cannot answer'}")
        
        print("🎉 Gemini API test passed!")
        
    except Exception as e:
        print(f"❌ Gemini API test failed: {e}")
        print("Check your GEMINI_API_KEY in .env file")

if __name__ == "__main__":
    test_gemini()
```

Run: `python test_gemini.py`

---

## 🚨 Error Testing

### Test 1: Invalid JWT
```bash
curl -H "Authorization: Bearer invalid_token" \
     http://localhost:8000/auth/me
```
**Expected:** 401 Unauthorized

### Test 2: Missing Dataset
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/dashboard/auto/nonexistent-id
```
**Expected:** 404 Dataset not found

### Test 3: Invalid File Upload
```bash
echo "not a csv" > invalid.txt
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@invalid.txt" \
  http://localhost:8000/datasets/upload
```
**Expected:** 400 Only CSV and Excel files are supported

### Test 4: SQL Injection Attempt
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Show me data; DROP TABLE data; --",
    "dataset_id": "YOUR_DATASET_ID",
    "output_count": 1
  }' \
  http://localhost:8000/query
```
**Expected:** Safe handling, no SQL injection

---

## 📊 Performance Testing

### Test 1: Large Dataset Upload
```python
# Create large test file
import pandas as pd

# Generate 10,000 rows
data = {
    'date': pd.date_range('2020-01-01', periods=10000, freq='H'),
    'revenue': np.random.randint(100, 5000, 10000),
    'region': np.random.choice(['North', 'South', 'East', 'West'], 10000),
    'product': np.random.choice(['Widget A', 'Widget B', 'Widget C'], 10000)
}
df = pd.DataFrame(data)
df.to_csv('large_dataset.csv', index=False)
```

Upload and measure response time.

### Test 2: Concurrent Requests
```bash
# Run 10 concurrent health checks
for i in {1..10}; do
  curl http://localhost:8000/health &
done
wait
```

---

## ✅ Test Checklist

### Basic Functionality
- [ ] Server starts without errors
- [ ] Health endpoint returns 200
- [ ] API docs accessible at /docs
- [ ] MongoDB connection successful
- [ ] Gemini API key working

### Authentication
- [ ] OAuth redirect works
- [ ] JWT token generated
- [ ] Protected endpoints require auth
- [ ] Invalid tokens rejected

### Dataset Management
- [ ] CSV upload successful
- [ ] Excel upload successful
- [ ] Schema detection accurate
- [ ] SQLite database created
- [ ] Dataset listing works
- [ ] Dataset deletion works

### AI Features
- [ ] Auto dashboard generates charts
- [ ] Natural language queries work
- [ ] Chat responses are coherent
- [ ] Cannot answer gate works
- [ ] Forecast generation works

### Report Generation
- [ ] PDF generation successful
- [ ] Charts embedded correctly
- [ ] Executive summary generated
- [ ] File download works

### Error Handling
- [ ] Invalid requests return proper errors
- [ ] Missing data handled gracefully
- [ ] LLM failures don't crash system
- [ ] SQL injection prevented

---

## 🔧 Troubleshooting

### Common Issues

**"GEMINI_API_KEY is not configured"**
- Check `.env` file has correct API key
- Restart server after adding key

**"MongoDB connection failed"**
- Verify MongoDB URI in `.env`
- Check network access in Atlas
- Ensure password is correct

**"Dataset not found"**
- Use correct dataset_id from upload response
- Ensure user owns the dataset

**"Cannot answer" responses**
- Check if query matches available columns
- Verify schema detection worked correctly

---

## 📈 Success Metrics

A fully working backend should achieve:
- ✅ 100% health check success
- ✅ <2 second response times for queries
- ✅ <5 second auto dashboard generation
- ✅ <10 second PDF generation
- ✅ 0% SQL injection vulnerabilities
- ✅ Proper error handling for all edge cases

---

**🎉 Complete testing coverage for your Narralytics backend!**