# AuraFinance

A comprehensive AI-powered finance application featuring a React frontend and valid Python backend.

## Project Structure

- **frontend/**: React application (Vite + TypeScript + TailwindCSS)
- **backend/**: FastAPI application (Python + SQLAlchemy)

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment(Optional):
   ```bash
   python -m venv venv
   # Windows
   .\venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   Copy `.env.example` to `.env`.
   ```bash
   cp .env.example .env
   ```

5. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

## Features

- **Dashboard**: Overview of financial status.
- **Market Trends**: Real-time market analysis.
- **AI Recommendations**: Personalized financial advice.
- **Portfolio**: Management and tracking of assets.
