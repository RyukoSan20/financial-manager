"""
Audit Generator - Proactive financial health audit with AI narration.
"""
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass


@dataclass
class AuditFinding:
    """Individual finding from financial audit."""
    severity: str  # "info", "warning", "alert", "critical"
    category: str
    title: str
    description: str
    current_value: float
    target_value: float
    suggestion: str
    action_type: str  # "budget_adjust", "savings_plan", "debt_strategy", "awareness"


@dataclass
class FinancialAuditReport:
    """Complete financial audit report."""
    report_id: str
    generated_at: str
    period: str
    overall_status: str  # "healthy", "needs_attention", "critical"
    
    # Scores
    overall_score: int
    previous_score: int
    score_change: int
    
    # Findings
    findings: List[AuditFinding]
    positive_highlights: List[str]
    
    # Recommendations
    immediate_actions: List[str]
    monthly_plan: Dict[str, str]
    
    # Context
    user_profile: Dict[str, Any]


class AuditGenerator:
    """
    Generates proactive financial audit reports.
    Uses deterministic calculations + AI narration.
    """
    
    def __init__(self):
        self.report_id_counter = 0
    
    def generate_audit(
        self,
        user_data: Dict[str, Any],
        financial_data: Dict[str, Any],
        historical_data: Dict[str, Any] = None
    ) -> FinancialAuditReport:
        """
        Generate comprehensive financial audit.
        
        Args:
            user_data: User profile (income, city, dependents, etc.)
            financial_data: Current financial status
            historical_data: Previous months data for comparison
        """
        self.report_id_counter += 1
        
        # Calculate ratios
        from .financial_ratios import calculate_financial_health
        
        monthly_income = financial_data.get("monthly_income", 0)
        monthly_expense = financial_data.get("monthly_expense", 0)
        total_cash = financial_data.get("total_cash", 0)
        total_debt = financial_data.get("total_debt", 0)
        monthly_debt = financial_data.get("monthly_debt_payment", 0)
        
        health = calculate_financial_health(
            monthly_income=monthly_income,
            monthly_expense=monthly_expense,
            total_cash=total_cash,
            total_debt=total_debt,
            monthly_debt_payment=monthly_debt
        )
        
        # Generate findings
        findings = self._analyze_findings(health, user_data, financial_data)
        
        # Generate highlights
        highlights = self._generate_highlights(health, financial_data)
        
        # Generate recommendations
        immediate, plan = self._generate_recommendations(
            findings, health, user_data, financial_data
        )
        
        # Determine overall status
        if health.overall_score >= 80:
            status = "healthy"
        elif health.overall_score >= 60:
            status = "needs_attention"
        else:
            status = "critical"
        
        # Calculate score change
        previous_score = historical_data.get("overall_score", health.overall_score) if historical_data else health.overall_score
        
        return FinancialAuditReport(
            report_id=f"AUDIT_{datetime.utcnow().strftime('%Y%m')}_{self.report_id_counter:04d}",
            generated_at=datetime.utcnow().isoformat(),
            period=f"Bulan {datetime.utcnow().strftime('%B %Y')}",
            overall_status=status,
            overall_score=health.overall_score,
            previous_score=previous_score,
            score_change=health.overall_score - previous_score,
            findings=findings,
            positive_highlights=highlights,
            immediate_actions=immediate,
            monthly_plan=plan,
            user_profile=user_data
        )
    
    def _analyze_findings(
        self,
        health,
        user_data: Dict,
        financial_data: Dict
    ) -> List[AuditFinding]:
        """Analyze and generate findings."""
        findings = []
        
        # Emergency fund finding
        emergency_months = health.emergency_fund_months.value
        if emergency_months < 3:
            findings.append(AuditFinding(
                severity="critical" if emergency_months < 1 else "alert",
                category="emergency_fund",
                title="Dana Darurat Tidak Cukup",
                description=f"Dana darurat Anda hanya {emergency_months:.1f} bulan, idealnya minimal 3-6 bulan",
                current_value=emergency_months,
                target_value=6,
                suggestion=f"Tambahkan Rp {financial_data.get('monthly_expense', 0) * 3:,.0f} ke dana darurat",
                action_type="savings_plan"
            ))
        
        # Savings ratio finding
        savings_rate = health.savings_ratio.value
        if savings_rate < 10:
            findings.append(AuditFinding(
                severity="alert",
                category="savings",
                title="Rasio Tabungan Rendah",
                description=f"Tabungan Anda hanya {savings_rate:.1f}% dari penghasilan, idealnya minimal 20%",
                current_value=savings_rate,
                target_value=20,
                suggestion="Terapkan metode 50/30/20: 50% kebutuhan, 30% keinginan, 20% tabungan",
                action_type="budget_adjust"
            ))
        
        # DSR finding
        dsr = health.dsr_ratio.value
        if dsr > 30:
            findings.append(AuditFinding(
                severity="warning" if dsr < 45 else "alert",
                category="debt",
                title="DSR Di Atas Batas Aman",
                description=f"Cicilan utang {dsr:.1f}% dari penghasilan (batas aman: <30%)",
                current_value=dsr,
                target_value=30,
                suggestion="Prioritaskan pelunasan utang dengan bunga tertinggi",
                action_type="debt_strategy"
            ))
        
        # Spending pattern finding
        expense = financial_data.get("monthly_expense", 0)
        income = financial_data.get("monthly_income", 1)
        if expense > income * 0.9:
            findings.append(AuditFinding(
                severity="warning",
                category="spending",
                title="Pengeluaran Hampir Sama dengan Penghasilan",
                description="Pengeluaran Anda hampir menghabiskan seluruh penghasilan",
                current_value=float(expense),
                target_value=float(income) * 0.8,
                suggestion="Identifikasi pengeluaran yang bisa dikurangi (langganan, jajan)",
                action_type="budget_adjust"
            ))
        
        return findings
    
    def _generate_highlights(
        self,
        health,
        financial_data: Dict
    ) -> List[str]:
        """Generate positive highlights."""
        highlights = []
        
        if health.savings_ratio.value >= 20:
            highlights.append(f"✅ Rasio tabungan Anda {health.savings_ratio.value:.1f}% - sudah di atas target!")
        
        if health.emergency_fund_months.value >= 6:
            highlights.append(f"✅ Dana darurat Anda cukup untuk {health.emergency_fund_months.value:.1f} bulan")
        
        if health.dsr_ratio.value <= 15:
            highlights.append(f"✅ DSR Anda {health.dsr_ratio.value:.1f}% - sangat sehat!")
        
        if health.overall_score >= 80:
            highlights.append("🌟 Skor kesehatan finansial Anda dalam kategori BAIK")
        
        return highlights
    
    def _generate_recommendations(
        self,
        findings: List[AuditFinding],
        health,
        user_data: Dict,
        financial_data: Dict
    ) -> tuple[List[str], Dict[str, str]]:
        """Generate actionable recommendations."""
        immediate = []
        plan = {}
        
        # Critical findings first
        for finding in findings:
            if finding.severity == "critical":
                immediate.append(f"🚨 PRIORITAS: {finding.title} - {finding.suggestion}")
        
        # Warnings
        for finding in findings:
            if finding.severity == "alert":
                immediate.append(f"⚠️ {finding.title}: {finding.suggestion}")
        
        # Monthly plan
        if health.savings_ratio.value < 20:
            monthly_savings_target = financial_data.get("monthly_income", 0) * 0.2
            plan["tabungan"] = f"Tambahkan Rp {monthly_savings_target:,.0f}/bulan ke tabungan"
        
        if health.emergency_fund_months.value < 6:
            target = financial_data.get("monthly_expense", 0) * 6
            current = financial_data.get("total_cash", 0)
            plan["dana_darurat"] = f"Target dana darurat Rp {target:,.0f} (progress: Rp {current:,.0f})"
        
        if health.dsr_ratio.value > 30:
            plan["pelunasan_utang"] = "Prioritaskan utang dengan bunga tertinggi"
        
        return immediate, plan
    
    def generate_narrative(self, report: FinancialAuditReport) -> str:
        """Generate AI narrative for the audit report."""
        # Indonesian context
        city = report.user_profile.get("city", "Jakarta")
        
        # Average expenses for context
        avg_expense = report.user_profile.get("avg_expense_city", 5000000)
        
        if report.overall_score >= 90:
            grade = "A"
        elif report.overall_score >= 80:
            grade = "B"
        elif report.overall_score >= 70:
            grade = "C"
        elif report.overall_score >= 50:
            grade = "D"
        else:
            grade = "E"

        narrative = f"""
📊 LAPORAN AUDIT KEUANGAN BULAN INI
=====================================

Halo! Saya telah menyelesaikan analisis kesehatan finansial Anda untuk {report.period}.

🎯 SKOR KESEHATAN: {report.overall_score}/100 ({grade})

{"🌟 Kondisi keuangan Anda SEHAT!" if report.overall_status == "healthy" else "⚠️ Keuangan Anda PERLU PERHATIAN" if report.overall_status == "needs_attention" else "🚨 Keuangan Anda DALAM KONDISI KRITIS"}

📈 PERUBAHAN: {"+" if report.score_change >= 0 else ""}{report.score_change} poin dari bulan lalu

"""

        # Findings narrative
        if report.findings:
            narrative += "🔍 TEMUAN UTAMA:\n"
            for finding in report.findings[:3]:
                narrative += f"\n• {finding.title}\n  {finding.description}\n  💡 {finding.suggestion}\n"

        # Highlights
        if report.positive_highlights:
            narrative += "\n✨ KEUNGGULAN ANDA:\n"
            for highlight in report.positive_highlights:
                narrative += f"  {highlight}\n"

        # Recommendations
        if report.immediate_actions:
            narrative += "\n🎯 TINDAKAN SEGERA:\n"
            for action in report.immediate_actions[:3]:
                narrative += f"  {action}\n"

        # Monthly plan
        if report.monthly_plan:
            narrative += "\n📅 RENCANA BULAN DEPAN:\n"
            for key, value in report.monthly_plan.items():
                narrative += f"  • {key.title()}: {value}\n"

        narrative += """
💬 TIPS KHUSUS INDONESIA:
• Perhatikan pengeluaran di mal/toko - coba catat setiap impulse buy
• Manfaatkan promo & diskon resmi untuk kebutuhan pokok
• Inflation rate Indonesia ~3-5%/tahun - investasi di deposito atau reksa dana
• UMK/UMR di kota Anda perlu dipertimbangkan untuk budget realistis

Ada pertanyaan tentang keuangan Anda? Tanyakan saja!
"""

        return narrative


def generate_proactive_audit(
    user_data: Dict,
    financial_data: Dict,
    historical_data: Dict = None
) -> FinancialAuditReport:
    """Convenience function to generate audit report."""
    generator = AuditGenerator()
    return generator.generate_audit(user_data, financial_data, historical_data)
