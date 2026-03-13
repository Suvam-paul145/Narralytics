# Narralytics Execution Guide 📖

This guide contains all the commands and steps necessary to run and deploy the Narralytics application.

## 1. Local Development Setup

### Backend (FastAPI)
```bash
# 1. Navigate to backend
cd backend

# 2. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Initialize Database (Optional, app does it automatically)
python test_db_init.py

# 5. Run the server
uvicorn main:app --reload --port 8000
```
*Access API Docs at: http://localhost:8000/docs*

### Frontend (React + Vite)
```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev
```
*Access App at: http://localhost:5173*

---

## 2. Environment Variables (.env)

### Backend (`backend/.env`)
```env
GEMINI_API_KEY=your_key
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_random_secret
AWS_REGION=us-east-1
DYNAMODB_TABLE=Narralytics_history
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:8000
```

---

## 3. AWS Deployment (Steps 19-20)

### DynamoDB Setup
```bash
aws dynamodb create-table \
    --table-name Narralytics_history \
    --attribute-definitions AttributeName=user_id,AttributeType=S AttributeName=timestamp,AttributeType=S \
    --key-schema AttributeName=user_id,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST
```

### Lambda Deployment (Backend)
```bash
# Zip the code
zip -r lambda_function.zip . -x "venv/*"

# Create/Update function
aws lambda create-function --function-name NarralyticsBackend \
    --runtime python3.9 \
    --handler main.handler \
    --role arn:aws:iam::your-account-id:role/your-role \
    --zip-file fileb://lambda_function.zip
```

---

## 4. Frontend Deployment (Step 21)
1. Push `frontend/` to a GitHub repository.
2. Connect to **Vercel**.
3. Set `VITE_API_URL` to your AWS API Gateway endpoint.
