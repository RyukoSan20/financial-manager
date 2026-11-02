"""
The calculators of this application.

Two kinds of calculator live here. The ones in `formulas.py` are the
general ones any country would want: discount, tip, loan, compound
interest, savings. The ones in `indonesia.py` follow Indonesian law
and Indonesian institutions, and they name the rule they come from
beside the number they produce.

The tax engine in `tax_engine.py` is the third kind: the tax of a
sale, under the law of the place the sale happened in. It is here
rather than in `services` because it is arithmetic and nothing else.

The names are brought out here so that a caller does not have to know
which file a calculator is in.
"""

from app.services.calculation.tax_engine import (  # noqa: F401
    PPN_RATE,
    TaxEngineError,
    compute_international_tax,
    compute_lines,
    compute_ppn,
    compute_tax,
    compute_transaction,
    resolve_rule,
)

__all__ = [
    "PPN_RATE",
    "TaxEngineError",
    "compute_international_tax",
    "compute_lines",
    "compute_ppn",
    "compute_tax",
    "compute_transaction",
    "resolve_rule",
]
