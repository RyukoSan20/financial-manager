# Financial Manager - Frontend

Modern React frontend for the Financial Manager application.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Charts & visualizations
- **React Router** - Client-side routing
- **Lucide React** - Icons

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview with balance, cash flow, budget progress |
| Transactions | `/transactions` | List, add, edit, delete transactions |
| Accounts | `/accounts` | Manage bank accounts, cash, e-wallets |
| Budgets | `/budgets` | Monthly/yearly budget tracking |
| Goals | `/goals` | Financial goals with progress tracking |
| Debts | `/debts` | Loan/debt management with amortization |
| Recurring | `/recurring` | Recurring income & expense rules |
| Calculators | `/calculators` | 7 financial calculators |
| Analytics | `/analytics` | Financial health score & trends |

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Connection

The frontend connects to the backend API at `http://localhost:8000/api`. 
Ensure the backend is running before starting the frontend.

```bash
# From backend directory
cd ../backend
python -m uvicorn app.main:app --reload
```

## Features

- Modern UI with Tailwind CSS
- Responsive design (mobile + desktop)
- Real-time data from API
- Interactive charts
- Financial calculators
- Financial health score
- Dark sidebar navigation
- Mobile bottom navigation
