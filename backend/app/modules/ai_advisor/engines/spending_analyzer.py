"""
Spending Analyzer - Detects spending patterns and anomalies.
Identifies "latte factor" (small daily expenses) and unusual spending.
"""
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
from decimal import Decimal


@dataclass
class SpendingAnomaly:
    """Represents an anomalous spending pattern."""
    anomaly_type: str  # "latte_factor", "unusual", "spike", "recurring_odd"
    amount: Decimal
    description: str
    severity: str  # "low", "medium", "high"
    date: datetime
    suggestion: str


@dataclass
class SpendingPattern:
    """Summary of spending behavior."""
    total_spending: Decimal
    avg_daily: Decimal
    top_categories: List[Tuple[str, Decimal]]
    daily_pattern: Dict[str, Decimal]  # Day of week -> total
    frequent_merchants: List[Tuple[str, int]]  # (name, count)
    recurring_suspicions: List[str]


class SpendingAnalyzer:
    """
    Analyzes spending patterns and detects anomalies.
    
    Identifies:
    - Latte Factor (small daily purchases that add up)
    - Unusual spending spikes
    - Recurring subscriptions
    - Spending by day of week
    """
    
    LATTE_FACTOR_THRESHOLD = Decimal("50000")  # 50K per day threshold
    SPIKE_MULTIPLIER = Decimal("2.0")  # 2x average = spike
    
    def __init__(self, transactions: List[Dict]):
        self.transactions = transactions
        self._setup_data()
    
    def _setup_data(self):
        """Pre-process transaction data."""
        self.by_date = defaultdict(list)
        self.by_category = defaultdict(Decimal)
        self.by_merchant = defaultdict(int)
        self.by_day = defaultdict(Decimal)
        
        for tx in self.transactions:
            if tx.get("type") != "expense":
                continue
            
            date = tx.get("date")
            if isinstance(date, str):
                date = datetime.fromisoformat(date)
            
            amount = Decimal(str(tx.get("amount", 0)))
            category = tx.get("category", "Lainnya")
            merchant = tx.get("merchant_name") or tx.get("description", "")[:50]
            
            self.by_date[date.date()].append(amount)
            self.by_category[category] += amount
            self.by_merchant[merchant] += 1
            self.by_day[date.strftime("%A")] += amount
    
    def analyze(self) -> SpendingPattern:
        """Perform full spending analysis."""
        return SpendingPattern(
            total_spending=self._total_spending(),
            avg_daily=self._avg_daily(),
            top_categories=self._top_categories(5),
            daily_pattern=dict(self.by_day),
            frequent_merchants=self._frequent_merchants(5),
            recurring_suspicions=self._detect_recurring()
        )
    
    def detect_anomalies(self) -> List[SpendingAnomaly]:
        """Detect spending anomalies."""
        anomalies = []
        
        # Latte factor detection
        anomalies.extend(self._detect_latte_factor())
        
        # Spike detection
        anomalies.extend(self._detect_spikes())
        
        # Unusual day detection
        anomalies.extend(self._detect_unusual_days())
        
        return sorted(anomalies, key=lambda x: x.severity == "high", reverse=True)
    
    def _total_spending(self) -> Decimal:
        """Calculate total spending."""
        return sum(self.by_category.values())
    
    def _avg_daily(self) -> Decimal:
        """Calculate average daily spending."""
        if not self.by_date:
            return Decimal("0")
        total = sum(sum(amounts) for amounts in self.by_date.values())
        return total / Decimal(len(self.by_date))
    
    def _top_categories(self, n: int) -> List[Tuple[str, Decimal]]:
        """Get top N spending categories."""
        sorted_cats = sorted(
            self.by_category.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return sorted_cats[:n]
    
    def _frequent_merchants(self, n: int) -> List[Tuple[str, int]]:
        """Get most frequent merchants."""
        sorted_merchants = sorted(
            self.by_merchant.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return sorted_merchants[:n]
    
    def _detect_latte_factor(self) -> List[SpendingAnomaly]:
        """Detect latte factor - small daily purchases."""
        anomalies = []
        
        for date, amounts in self.by_date.items():
            daily_total = sum(amounts)
            
            # Count small transactions
            small_tx = [a for a in amounts if a <= self.LATTE_FACTOR_THRESHOLD]
            
            if len(small_tx) >= 3:
                # Multiple small purchases in one day
                anomaly = SpendingAnomaly(
                    anomaly_type="latte_factor",
                    amount=sum(small_tx),
                    description=f"{len(small_tx)} transaksi kecil di {date}",
                    severity="medium",
                    date=datetime.combine(date, datetime.min.time()),
                    suggestion="Pertimbangkan untuk mengurangi pembelian kecil-kecilan yang tidak perlu."
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def _detect_spikes(self) -> List[SpendingAnomaly]:
        """Detect unusual spending spikes."""
        anomalies = []
        avg = self._avg_daily()
        
        if avg == 0:
            return anomalies
        
        for date, amounts in self.by_date.items():
            daily_total = sum(amounts)
            
            if daily_total > avg * self.SPIKE_MULTIPLIER:
                anomaly = SpendingAnomaly(
                    anomaly_type="spike",
                    amount=daily_total,
                    description=f"Pembelanjaan tinggi di {date}: Rp {daily_total:,.0f}",
                    severity="high" if daily_total > avg * Decimal("3") else "medium",
                    date=datetime.combine(date, datetime.min.time()),
                    suggestion="Ada pembelanjaan tidak biasa. Apakah ini planned expense?"
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def _detect_unusual_days(self) -> List[SpendingAnomaly]:
        """Detect unusual spending by day of week."""
        anomalies = []
        
        if not self.by_day:
            return anomalies
        
        # Find day with highest spending
        max_day = max(self.by_day.items(), key=lambda x: x[1])
        max_amount = max_day[1]
        avg_day = self._total_spending() / Decimal(len(self.by_day))
        
        if max_amount > avg_day * Decimal("2"):
            anomaly = SpendingAnomaly(
                anomaly_type="unusual",
                amount=max_amount,
                description=f"Hari {max_day[0]} punya pengeluaran tertinggi",
                severity="low",
                date=datetime.now(),
                suggestion="Perhatikan pengeluaran di hari {max_day[0]}."
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def _detect_recurring(self) -> List[str]:
        """Detect possible recurring subscriptions."""
        # Look for regular amounts on similar days
        amount_groups = defaultdict(list)
        
        for tx in self.transactions:
            if tx.get("type") != "expense":
                continue
            
            amount = Decimal(str(tx.get("amount", 0)))
            # Round to nearest 1000 for grouping
            rounded = (amount / 1000).quantize(Decimal("1")) * 1000
            
            if rounded >= 10000:  # Only significant amounts
                amount_groups[rounded].append(tx)
        
        recurring = []
        for amount, txs in amount_groups.items():
            if len(txs) >= 2:
                # Check if same day of month
                days = set()
                for tx in txs:
                    date = tx.get("date")
                    if isinstance(date, str):
                        date = datetime.fromisoformat(date)
                    days.add(date.day)
                
                if len(days) <= 3:  # Consistent day of month
                    recurring.append(f"Subscription ~Rp {amount:,.0f}/bulan")
        
        return recurring


def analyze_spending(transactions: List[Dict]) -> Tuple[SpendingPattern, List[SpendingAnomaly]]:
    """Main entry point for spending analysis."""
    analyzer = SpendingAnalyzer(transactions)
    return analyzer.analyze(), analyzer.detect_anomalies()
