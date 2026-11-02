"""
The tax rules of the world.

A tax is not a number. A tax is a rule about a place, a date and a
kind of thing, and the rule says three different things at once: the
rate, the base the rate is charged on, and what happens when the
seller and the buyer are in different places.

So the rules are kept apart from the transactions that use them. A
transaction says "this sale was in Germany on this date"; the rule
says what that means. Keeping them apart is what lets a rate change
in one place without rewriting the history of every sale, and what
lets the same transaction be read under the rule of the day.

The rule is found by country, by tax code, and by the date it was in
force. The place inside the country is finer than the country for
some taxes: the United States has a sales tax in every state and a
different rate in every county and city, so `state_code`,
`county_code` and `city_code` are all kept.

The rest of the rule is kept in `metadata_json`, because it is the
part that has no common shape between countries. An EU rule has to
say whether the supply is intra-EU and whether the tax is charged in
reverse; a United States rule has to say whether the seller has
nexus in that county; a Singapore rule has to say whether the goods
are imported; a UAE rule has to say whether the seller is in a
designated zone. Those four questions have nothing in common, so they
are held as named flags rather than as columns that would be null for
every other country.

`nominal_rate` is the rate as a percentage: 12 for Indonesian PPN, 9
for Singapore GST, 5 for UAE VAT.

`dpp_multiplier_numerator` and `dpp_multiplier_denominator` are the
fraction of the price the tax is charged on, for the rules that do not
charge it on the whole price. Indonesian PPN on ordinary goods is
charged on eleven twelfths of the price, so the numerator is 11 and
the denominator is 12. A rule that charges on the whole price has a
numerator and a denominator that are the same.
"""

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class TaxRule(Base):
    """
    One tax rule of one place, in force between two dates.

    `rule_version` is the version of the rule as the tax authority
    published it. It is kept so that a rule which is later corrected
    can be told apart from the rule that was in force at the time.

    `rounding_method` says how the tax is rounded. It is written down
    here rather than assumed, because rounding is part of the rule and
    two places round differently.
    """

    __tablename__ = "tax_rules"

    id = Column(Integer, primary_key=True, index=True)

    # Where the rule applies. The country is the coarse answer and
    # the codes below it are the fine one. A code that is null means
    # the rule applies to the whole of that level, so a rule with no
    # state code is a rule for every state.
    country_code = Column(String(2), nullable=False, index=True)
    state_code = Column(String(10), nullable=True, index=True)
    county_code = Column(String(20), nullable=True, index=True)
    city_code = Column(String(20), nullable=True, index=True)

    # Which tax this is. The code is the tax authority's own name for
    # it, such as "PPN", "VAT", "GST" or "SALES_TAX".
    tax_code = Column(String(30), nullable=False, index=True)

    # Which family the tax belongs to, which is how the engine knows
    # what to do with it before it has read the rest of the rule.
    tax_type = Column(String(30), nullable=False, index=True)

    # The rate, as a percentage.
    nominal_rate = Column(Numeric(9, 4), default=0, nullable=False)

    # The fraction of the price the tax is charged on. Indonesian PPN
    # on ordinary goods is eleven twelfths; everything else is the
    # whole price.
    dpp_multiplier_numerator = Column(Numeric(9, 4), default=1, nullable=False)
    dpp_multiplier_denominator = Column(Numeric(9, 4), default=1, nullable=False)

    # Whether the tax is added to the bill or withheld from it.
    tax_behavior = Column(String(20), default="ADDITIVE", nullable=False)

    # When the rule was in force. A rule with no end date is a rule
    # that is still in force.
    effective_from = Column(Date, nullable=True, index=True)
    effective_to = Column(Date, nullable=True, index=True)

    # The version of the rule as published.
    rule_version = Column(String(30), nullable=True)

    # How the tax is rounded.
    rounding_method = Column(String(30), default="ROUND_HALF_UP", nullable=True)

    # The flags that have no common shape between countries. The names
    # are the ones the engine looks for: reverse_charge_flag,
    # intra_eu_supply_flag, nexus_status, gst_registration_status,
    # designated_zone_flag, zero_rated_supply_flag and
    # import_gst_flag.
    metadata_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<TaxRule {self.country_code}/{self.tax_code}>"
