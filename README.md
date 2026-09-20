# FinManager - Personal Finance Application

A comprehensive personal finance management application with:

- **Backend**: FastAPI + SQLite + SQLAlchemy + Pydantic
- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **Features**: Dashboard, Transactions, Accounts, Budgets, Goals, Debts, Recurring, Calculators, Analytics
- **PWA**: Installable on mobile devices

## Architecture

```
User
  ↓
Vercel (Frontend) → https://your-app.vercel.app
  ↓
Railway (Backend API) → https://your-app.railway.app/api
  ↓
Railway PostgreSQL (Database)
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- npm or yarn
- Git

### Local Development

1. **Clone and setup**
```bash
git clone <your-repo-url>
cd financial-manager
```

2. **Backend setup**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run backend
python3 -m uvicorn app.main:app --reload --port 8000
```

3. **Frontend setup**
```bash
cd frontend
npm install

# Run frontend
npm run dev
```

4. **Open browser**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variable:
   - `VITE_API_URL` = your-backend-url/api
5. Deploy

### Backend (Railway)

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repository
4. Add environment variables:
   - `DATABASE_URL` = (Railway will provide PostgreSQL URL)
   - `DEBUG` = false
5. Set start command: `cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Deploy

### Database

Railway provides PostgreSQL automatically. The app will auto-create tables on startup.

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=https://your-backend.railway.app/api
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DEBUG=false
```

## API Endpoints

### Accounts
- `GET /api/accounts/` - List all accounts
- `POST /api/accounts/` - Create account
- `GET /api/accounts/{id}` - Get account
- `PUT /api/accounts/{id}` - Update account
- `DELETE /api/accounts/{id}` - Delete account
- `GET /api/accounts/summary/total-balance` - Get total balance

### Categories
- `GET /api/categories/` - List categories
- `POST /api/categories/` - Create category
- `POST /api/categories/seed-defaults` - Seed default categories

### Transactions
- `GET /api/transactions/` - List transactions
- `POST /api/transactions/` - Create transaction
- `GET /api/transactions/{id}` - Get transaction
- `PUT /api/transactions/{id}` - Update transaction
- `DELETE /api/transactions/{id}` - Delete transaction

### Budgets
- `GET /api/budgets/` - List budgets
- `POST /api/budgets/` - Create budget
- `GET /api/budgets/{id}` - Get budget
- `PUT /api/budgets/{id}` - Update budget
- `DELETE /api/budgets/{id}` - Delete budget

### Goals
- `GET /api/goals/` - List goals
- `POST /api/goals/` - Create goal
- `GET /api/goals/{id}` - Get goal
- `PUT /api/goals/{id}` - Update goal
- `POST /api/goals/{id}/contribute` - Add contribution

### Debts
- `GET /api/debts/` - List debts
- `POST /api/debts/` - Create debt
- `POST /api/debts/{id}/payment` - Record payment

### Dashboard
- `GET /api/dashboard/summary` - Dashboard summary
- `GET /api/dashboard/cash-flow` - Cash flow trend

### Analytics
- `GET /api/analytics/financial-health` - Financial health score
- `GET /api/analytics/cash-flow-trend` - Cash flow trends
- `GET /api/analytics/expense-breakdown` - Expense breakdown

### Calculators
- `POST /api/calculators/discount` - Calculate discount
- `POST /api/calculators/loan-payment` - Calculate loan payment
- `POST /api/calculators/compound-interest` - Calculate compound interest

## Project Structure

```
financial-manager/
├── backend/
│   ├── app/
│   │   ├── api/routes/     # API endpoints
│   │   ├── models/        # Database models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   └── core/          # Config, database
│   ├── tests/
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # UI components
│   │   ├── services/     # API calls
│   │   └── utils/        # Utilities
│   ├── public/            # Static assets, PWA
│   └── package.json
└── README.md
```

## Features

- [x] Dashboard with charts
- [x] Transaction management
- [x] Account/wallet management
- [x] Budget tracking
- [x] Financial goals
- [x] Debt management
- [x] Recurring transactions
- [x] Financial calculators
- [x] Analytics & insights
- [x] PWA support
- [x] Mobile responsive

## Tech Stack

**Backend:**
- FastAPI - Modern Python web framework
- SQLAlchemy - ORM
- Pydantic - Data validation
- SQLite/PostgreSQL - Database

**Frontend:**
- React 18 - UI library
- Vite - Build tool
- Tailwind CSS - Styling
- Recharts - Charts
- React Router - Navigation
- Lucide - Icons

## License

MIT
