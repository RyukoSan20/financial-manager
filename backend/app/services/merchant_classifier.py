"""
Comprehensive Transaction Classification System for Indonesian Financial Data.
Categorizes transactions by source, merchant type, and suggests appropriate categories.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class MerchantType(Enum):
    """Types of merchants/sources for transactions."""
    EWALLET = "ewallet"
    BANK = "bank"
    QRIS = "qris"
    RETAIL = "retail"
    FOOD_BEVERAGE = "food_beverage"
    TRANSPORT = "transport"
    SHOPPING = "shopping"
    BILLS = "bills"
    ENTERTAINMENT = "entertainment"
    HEALTHCARE = "healthcare"
    OTHER = "other"


@dataclass
class MerchantClassification:
    """Classification result for a merchant."""
    merchant_type: MerchantType
    source_type: str  # ewallet, bank_himbara, bank_swasta, bank_syariah, bank_digital, bank_internasional, retail, etc
    merchant_name: str
    display_name: str
    category_hint: str
    transaction_type_hint: str  # debit or credit
    confidence: float
    keywords: List[str]


class IndonesianMerchantClassifier:
    """
    Comprehensive classifier for Indonesian merchants and financial sources.
    Based on real market data and user behavior patterns.
    """
    
    # ============================================
    # E-WALLET CLASSIFICATION
    # ============================================
    EWALLETS = {
        # GoPay (Gojek ecosystem)
        "gopay": MerchantClassification(
            merchant_type=MerchantType.EWALLET,
            source_type="ewallet_gopay",
            merchant_name="gopay",
            display_name="GoPay",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["gopay", "gojek", "go-pay", "grab", "grabpay"]
        ),
        "gojek": MerchantClassification(
            merchant_type=MerchantType.EWALLET,
            source_type="ewallet_gopay",
            merchant_name="gojek",
            display_name="Gojek",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["gojek", "gopay", "gosend", "gocar"]
        ),
        
        # DANA
        "dana": MerchantClassification(
            merchant_type=MerchantType.EWALLET,
            source_type="ewallet_dana",
            merchant_name="dana",
            display_name="DANA",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["dana", "dana-id"]
        ),
        
        # ShopeePay
        "shopeepay": MerchantClassification(
            merchant_type=MerchantType.EWALLET,
            source_type="ewallet_shopeepay",
            merchant_name="shopeepay",
            display_name="ShopeePay",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["shopeepay", "spay", "shopee", "shope", "spice"]
        ),
        
        # OVO
        "ovo": MerchantClassification(
            merchant_type=MerchantType.EWALLET,
            source_type="ewallet_ovo",
            merchant_name="ovo",
            display_name="OVO",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["ovo", "ovo cash", "ovo legal"]
        ),
        
        # LinkAja
        "linkaja": MerchantClassification(
            merchant_type=MerchantType.EWALLET,
            source_type="ewallet_linkaja",
            merchant_name="linkaja",
            display_name="LinkAja",
            category_hint="bills_utilities",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["linkaja", "link aja", "link-aja", "lja"]
        ),
        
        # i.Saku (Neo+ bank digital)
        "isaku": MerchantClassification(
            merchant_type=MerchantType.EWALLET,
            source_type="ewallet_isaku",
            merchant_name="isaku",
            display_name="i.Saku",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["isaku", "i.saku", "neo+", "neobank"]
        ),
        
        # PayLater variants
        "paylater": MerchantClassification(
            merchant_type=MerchantType.EWALLET,
            source_type="ewallet_paylater",
            merchant_name="paylater",
            display_name="PayLater",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["paylater", "pay later", "cicil", "tempo"]
        ),
    }
    
    # ============================================
    # BANK HIMBARA (BUMN) CLASSIFICATION
    # ============================================
    BANK_HIMBARA = {
        # Bank Mandiri
        "mandiri": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_himbara_mandiri",
            merchant_name="mandiri",
            display_name="Bank Mandiri",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["mandiri", "bank mandiri", "lmandiri", "tl mandiri"]
        ),
        
        # BRI
        "bri": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_himbara_bri",
            merchant_name="bri",
            display_name="Bank BRI",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["bri", "bank bri", "bank rakyat indonesia", "lbri", "tl bri"]
        ),
        
        # BNI
        "bni": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_himbara_bni",
            merchant_name="bni",
            display_name="Bank BNI",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["bni", "bank bni", "bank negara indonesia", "lbni", "tl bni"]
        ),
        
        # BTN
        "btn": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_himbara_btn",
            merchant_name="btn",
            display_name="Bank BTN",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["btn", "bank btn", "bank tabungan negara"]
        ),
    }
    
    # ============================================
    # BANK SWASTA NASIONAL UTAMA
    # ============================================
    BANK_SWASTA = {
        # BCA - biggest retail bank
        "bca": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_swasta_bca",
            merchant_name="bca",
            display_name="Bank BCA",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["bca", "bank bca", "bank central asia", "lbca", "tl bca", "flazz"]
        ),
        
        # CIMB Niaga
        "cimb": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_swasta_cimb",
            merchant_name="cimb",
            display_name="CIMB Niaga",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["cimb", "cimb niaga", "bank cimb", "octo", "octoclicks"]
        ),
        
        # Bank Danamon
        "danamon": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_swasta_danamon",
            merchant_name="danamon",
            display_name="Bank Danamon",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["danamon", "bank danamon", "dana bonus"]
        ),
        
        # Permata Bank
        "permata": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_swasta_permata",
            merchant_name="permata",
            display_name="Permata Bank",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["permata", "bank permata", "permatabank"]
        ),
        
        # OCBC Indonesia
        "ocbc": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_swasta_ocbc",
            merchant_name="ocbc",
            display_name="OCBC Indonesia",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["ocbc", "bank ocbc", "ocbc nisp", "t中生", "one2pay"]
        ),
        
        # Maybank Indonesia
        "maybank": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_swasta_maybank",
            merchant_name="maybank",
            display_name="Maybank Indonesia",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["maybank", "bank maybank", "malayan banking"]
        ),
        
        # Bank Sinarmas (Simobi)
        "sinarmas": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_swasta_sinarmas",
            merchant_name="sinarmas",
            display_name="Bank Sinarmas",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["sinarmas", "simobi", "simobiplus", "bsim", "bank sinarmas"]
        ),
        
        # Bank Mega
        "mega": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_swasta_mega",
            merchant_name="mega",
            display_name="Bank Mega",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["mega", "bank mega", "megamobile"]
        ),
        
        # Bank BTPN / Jenius
        "jenius": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_digital_jenius",
            merchant_name="jenius",
            display_name="Jenius (BTPN)",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["jenius", "btpn", "bank btpn", "mcc"]
        ),
    }
    
    # ============================================
    # BANK SYARIAH
    # ============================================
    BANK_SYARIAH = {
        "bsi": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_syariah_bsi",
            merchant_name="bsi",
            display_name="BSI (Bank Syariah Indonesia)",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["bsi", "bank syaiah indonesia", "bsm", "muslim"]
        ),
        "muamalat": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_syariah_muamalat",
            merchant_name="muamalat",
            display_name="Bank Muamalat",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["muamalat", "bank muamalat", "al quran"]
        ),
        "jago_sharia": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_syariah",
            merchant_name="jago_syariah",
            display_name="Bank Jago Syariah",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["jago", "bank jago", "syariah"]
        ),
    }
    
    # ============================================
    # BANK PEMBANGUNAN DAERAH (BPD)
    # ============================================
    BANK_PD = {
        "jabar": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_pd_jabar",
            merchant_name="jabar",
            display_name="Bank BJB (Jawa Barat)",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["bjb", "bank jabar", "bank jabar banten", "jawa barat"]
        ),
        "jateng": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_pd_jateng",
            merchant_name="jateng",
            display_name="Bank BPD Jawa Tengah",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["jateng", "bank jateng", "bpd jawa tengah", "jawa tengah"]
        ),
        "jatim": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_pd_jatim",
            merchant_name="jatim",
            display_name="Bank BPD Jawa Timur",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["jatim", "bank jatim", "bpd jawa timur", "jawa timur"]
        ),
        "dki": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_pd_dki",
            merchant_name="dki",
            display_name="Bank DKI",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["dki", "bank dki", "bank dki jakarta", "jakarta"]
        ),
        "sumut": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_pd_sumut",
            merchant_name="sumut",
            display_name="Bank BPD Sumatera Utara",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["sumut", "bank sumut", "bpd sumut", "sumatera utara"]
        ),
        "sulsel": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_pd_sulsel",
            merchant_name="sulsel",
            display_name="Bank BPD Sulawesi Selatan",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["sulsel", "bank sulsel", "bpd sulawesi selatan"]
        ),
        "ntb": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_pd_ntb",
            merchant_name="ntb",
            display_name="Bank NTB",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["ntb", "bank ntb", "bpd ntb", "ntb", "lombok"]
        ),
    }
    
    # ============================================
    # BANK DIGITAL
    # ============================================
    BANK_DIGITAL = {
        "seabank": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_digital_seabank",
            merchant_name="seabank",
            display_name="SeaBank",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["seabank", "sea bank", "seabankindo"]
        ),
        "blu": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_digital_blu",
            merchant_name="blu",
            display_name="Blu by BCA",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["blu", "blu by bca", "blue", "bcadigital"]
        ),
        "jago": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_digital_jago",
            merchant_name="jago",
            display_name="Bank Jago",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["jago", "bank jago", "jago bank"]
        ),
        "allo": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_digital_allo",
            merchant_name="allo",
            display_name="Allo Bank",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["allo", "allo bank", "ct corp", "cashplus"]
        ),
        "woor": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_digital_woori",
            merchant_name="woori",
            display_name="Bank Woori Indonesia",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["woori", "bank woori", "woori indonesia"]
        ),
        "stanchart": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_internasional",
            merchant_name="stanchart",
            display_name="Standard Chartered",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["standard chartered", "stanchart", "sc"]
        ),
        "citibank": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_internasional",
            merchant_name="citibank",
            display_name="Citibank",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["citi", "citibank", "citi bank"]
        ),
        "hsbc": MerchantClassification(
            merchant_type=MerchantType.BANK,
            source_type="bank_internasional",
            merchant_name="hsbc",
            display_name="HSBC Indonesia",
            category_hint="bank_transfer",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["hsbc", "hongkong shanghai banking"]
        ),
    }
    
    # ============================================
    # RETAIL & MINIMARKET
    # ============================================
    RETAIL = {
        "alfamart": MerchantClassification(
            merchant_type=MerchantType.RETAIL,
            source_type="retail_alfamart",
            merchant_name="alfamart",
            display_name="Alfamart",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["alfamart", "alfa mart", "amart", "ammart"]
        ),
        "indomaret": MerchantClassification(
            merchant_type=MerchantType.RETAIL,
            source_type="retail_indomaret",
            merchant_name="indomaret",
            display_name="Indomaret",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["indomaret", "indo maret", "imart", "innomart"]
        ),
        "family_mart": MerchantClassification(
            merchant_type=MerchantType.RETAIL,
            source_type="retail_familymart",
            merchant_name="familymart",
            display_name="Family Mart",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["family mart", "familymart", "fmart", "famima"]
        ),
        " Lawson": MerchantClassification(
            merchant_type=MerchantType.RETAIL,
            source_type="retail_lawson",
            merchant_name="lawson",
            display_name="Lawson",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["lawson", "lawnson"]
        ),
        "indogrosir": MerchantClassification(
            merchant_type=MerchantType.RETAIL,
            source_type="retail_indogrosir",
            merchant_name="indogrosir",
            display_name="IndoGrosir",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["indogrosir", "indo grosir", "grosir"]
        ),
        "hypermart": MerchantClassification(
            merchant_type=MerchantType.RETAIL,
            source_type="retail_hypermart",
            merchant_name="hypermart",
            display_name="Hypermart",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["hypermart", "hyper mart", "matahari"]
        ),
        "carrefour": MerchantClassification(
            merchant_type=MerchantType.RETAIL,
            source_type="retail_carrefour",
            merchant_name="carrefour",
            display_name="Carrefour",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["carrefour", "carre four", "transmart"]
        ),
        "giant": MerchantClassification(
            merchant_type=MerchantType.RETAIL,
            source_type="retail_giant",
            merchant_name="giant",
            display_name="Giant Express",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["giant", "giant express", "hero"]
        ),
    }
    
    # ============================================
    # FOOD & BEVERAGE CHAINS
    # ============================================
    FOOD_BEVERAGE = {
        "mcDonald": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_mcdonalds",
            merchant_name="mcdonalds",
            display_name="McDonald's",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["mcdonald", "mcd", "macdonald", "mcdonalds", "burger", "fast food"]
        ),
        "kfc": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_kfc",
            merchant_name="kfc",
            display_name="KFC",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["kfc", "kentucky", "fried chicken"]
        ),
        "starbucks": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_starbucks",
            merchant_name="starbucks",
            display_name="Starbucks",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["starbucks", "starbuck", "biji kopi", "coffee"]
        ),
        "kopik_u": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_kopikita",
            merchant_name="kopikita",
            display_name="Kopi Kita",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["kopi kita", "kopikita"]
        ),
        "jco": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_jco",
            merchant_name="jco",
            display_name="J.CO Donuts",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["jco", "j cod", "donuts", "donat"]
        ),
        "dunkin": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_dunkin",
            merchant_name="dunkin",
            display_name="Dunkin' Donuts",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["dunkin", "dunkin donuts", "donat"]
        ),
        "hokben": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_hokben",
            merchant_name="hokben",
            display_name="HokBen",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["hokben", "hoka bento", "hokk", "japanese"]
        ),
        "pizza_hut": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_pizzahut",
            merchant_name="pizzahut",
            display_name="Pizza Hut",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["pizza hut", "pizzahut", "pizza"]
        ),
        "domino": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_dominos",
            merchant_name="dominos",
            display_name="Domino's Pizza",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["domino", "dominos", "pizza"]
        ),
        "rich": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_rich",
            merchant_name="rich",
            display_name="Rich & Famous",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["rich", "rich and famous", "cafe"]
        ),
        "awak": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_awak",
            merchant_name="awak",
            display_name="Awak Kafe",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["awak", "awak cafe", "awak kafe"]
        ),
        "warkop": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_warkop",
            merchant_name="warkop",
            display_name="Warkop / Kedai Kopi",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.80,
            keywords=["warkop", "kedai kopi", "warung kopi", "cafe", "kopi", "coffee shop"]
        ),
        "bakso": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_bakso",
            merchant_name="bakso",
            display_name="Bakso",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["bakso", "bakso malang", "meatball"]
        ),
        "soto": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_soto",
            merchant_name="soto",
            display_name="Soto / Sup",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["soto", "soup", "sup"]
        ),
        "nasi_goreng": MerchantClassification(
            merchant_type=MerchantType.FOOD_BEVERAGE,
            source_type="fnb_nasigoreng",
            merchant_name="nasigoreng",
            display_name="Nasi Goreng / Mie",
            category_hint="food_beverages",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["nasi goreng", "mie", "goreng", "fried rice", "noodle"]
        ),
    }
    
    # ============================================
    # TRANSPORTATION
    # ============================================
    TRANSPORT = {
        "grab": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_grab",
            merchant_name="grab",
            display_name="Grab",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["grab", "grabpay", "grab bike", "grabcar"]
        ),
        "gojek_transport": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_gojek",
            merchant_name="gojek",
            display_name="Gojek (Transport)",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["gojek", "gocar", "go ride", "go bluebird"]
        ),
        "bluebird": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_bluebird",
            merchant_name="bluebird",
            display_name="Bluebird",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["bluebird", "bbird", "taxi blue", "blue bird"]
        ),
        "silver": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_silver",
            merchant_name="silver",
            display_name="Silver Taxi",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["silver", "silver bird", "taxi silver"]
        ),
        "maxim": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_maxim",
            merchant_name="maxim",
            display_name="Maxim",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["maxim", "macsim", "taxi maxim"]
        ),
        "shell": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_bbm",
            merchant_name="shell",
            display_name="Shell",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["shell", "bensin", "bbm", "fuel", "pertamina", "pertalite", "pertamax", "vix", "total"]
        ),
        "pertamina": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_bbm",
            merchant_name="pertamina",
            display_name="Pertamina",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["pertamina", "spbu", "bensin", "bbm"]
        ),
        "parkir": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_parking",
            merchant_name="parkir",
            display_name="Parkir",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["parkir", "parking", "tol", "jalan tol", "highway"]
        ),
        "krl": MerchantClassification(
            merchant_type=MerchantType.TRANSPORT,
            source_type="transport_kereta",
            merchant_name="krl",
            display_name="KRL / Kereta",
            category_hint="transport",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["krl", "kereta", "kai", "garuda", "lion air", "citilink", "batik air", "transit"]
        ),
        "gojek_mart": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_delivery",
            merchant_name="gojekmart",
            display_name="GoMart (Gojek)",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["gomart", "go mart", "gojek mart"]
        ),
        "grabmart": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_delivery",
            merchant_name="grabmart",
            display_name="GrabMart",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["grabmart", "grab mart", "grab express"]
        ),
    }
    
    # ============================================
    # SHOPPING PLATFORMS
    # ============================================
    SHOPPING = {
        "shopee": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_shopee",
            merchant_name="shopee",
            display_name="Shopee",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["shopee", "shopi", "shope", "spay", "shopee food"]
        ),
        "tokopedia": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_tokopedia",
            merchant_name="tokopedia",
            display_name="Tokopedia",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["tokopedia", "tokped", "toko pedia"]
        ),
        "lazada": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_lazada",
            merchant_name="lazada",
            display_name="Lazada",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["lazada", "lazada indonesia", "lzd"]
        ),
        "bukalapak": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_bukalapak",
            merchant_name="bukalapak",
            display_name="Bukalapak",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["bukalapak", "buka lapak", "blibli", "blibli"]
        ),
        "tiktok": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_tiktokshop",
            merchant_name="tiktokshop",
            display_name="TikTok Shop",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["tiktok", "tik tok shop", "tiktokshop", "tiktok shop"]
        ),
        "blibli": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_blibli",
            merchant_name="blibli",
            display_name="Blibli",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["blibli", "blibli.com", "gopay"]
        ),
        "zalora": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_fashion",
            merchant_name="zalora",
            display_name="Zalora",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["zalora", "fashion", "clothing", "shoes"]
        ),
        "orami": MerchantClassification(
            merchant_type=MerchantType.SHOPPING,
            source_type="shopping_motherchild",
            merchant_name="orami",
            display_name="Orami",
            category_hint="shopping",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["orami", "mothercare", "kids", "baby"]
        ),
    }
    
    # ============================================
    # BILLS & UTILITIES
    # ============================================
    BILLS = {
        "pln": MerchantClassification(
            merchant_type=MerchantType.BILLS,
            source_type="bills_pln",
            merchant_name="pln",
            display_name="PLN (Listrik)",
            category_hint="bills_utilities",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["pln", "listrik", "token pln", "token listrik", "langganan listrik"]
        ),
        "pdam": MerchantClassification(
            merchant_type=MerchantType.BILLS,
            source_type="bills_pdam",
            merchant_name="pdam",
            display_name="PDAM (Air)",
            category_hint="bills_utilities",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["pdam", "air", "water", "langganan air"]
        ),
        "telkom": MerchantClassification(
            merchant_type=MerchantType.BILLS,
            source_type="bills_internet",
            merchant_name="telkom",
            display_name="Telkom (Internet/Telepon)",
            category_hint="bills_utilities",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["telkom", "indihome", "speedy", "telepon", "internet", "wifi"]
        ),
        "bpjs": MerchantClassification(
            merchant_type=MerchantType.BILLS,
            source_type="bills_bpjs",
            merchant_name="bpjs",
            display_name="BPJS Kesehatan",
            category_hint="bills_utilities",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["bpjs", "bpjs kesehatan", "bpjs ketenagakerjaan", "kesehatan"]
        ),
        "pulsa": MerchantClassification(
            merchant_type=MerchantType.BILLS,
            source_type="bills_pulsa",
            merchant_name="pulsa",
            display_name="Pulsa / Paket Data",
            category_hint="bills_utilities",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["pulsa", "paket data", "kuota", "internet", "telkomsel", "xl", "axis", "indosat", "tri", "smartfren"]
        ),
        "tv_kabel": MerchantClassification(
            merchant_type=MerchantType.BILLS,
            source_type="bills_tvkabel",
            merchant_name="tvkabel",
            display_name="TV Kabel / Streaming",
            category_hint="entertainment",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["first media", "kabelvision", "indovision", "transvision", "telkomvision"]
        ),
        "asuransi": MerchantClassification(
            merchant_type=MerchantType.BILLS,
            source_type="bills_insurance",
            merchant_name="asuransi",
            display_name="Asuransi",
            category_hint="bills_utilities",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["asuransi", "insurance", "prudential", "axa", "aia", "manulife", "allianz"]
        ),
    }
    
    # ============================================
    # ENTERTAINMENT
    # ============================================
    ENTERTAINMENT = {
        "netflix": MerchantClassification(
            merchant_type=MerchantType.ENTERTAINMENT,
            source_type="entertainment_streaming",
            merchant_name="netflix",
            display_name="Netflix",
            category_hint="entertainment",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["netflix", "nf"]
        ),
        "spotify": MerchantClassification(
            merchant_type=MerchantType.ENTERTAINMENT,
            source_type="entertainment_streaming",
            merchant_name="spotify",
            display_name="Spotify",
            category_hint="entertainment",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["spotify", "music", "podcast"]
        ),
        "youtube": MerchantClassification(
            merchant_type=MerchantType.ENTERTAINMENT,
            source_type="entertainment_streaming",
            merchant_name="youtube",
            display_name="YouTube Premium",
            category_hint="entertainment",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["youtube", "yt premium", "yt music", "yt premium"]
        ),
        "disney": MerchantClassification(
            merchant_type=MerchantType.ENTERTAINMENT,
            source_type="entertainment_streaming",
            merchant_name="disney",
            display_name="Disney+ Hotstar",
            category_hint="entertainment",
            transaction_type_hint="debit",
            confidence=0.95,
            keywords=["disney", "disney+", "hotstar", "star"]
        ),
        "bioskop": MerchantClassification(
            merchant_type=MerchantType.ENTERTAINMENT,
            source_type="entertainment_cinema",
            merchant_name="bioskop",
            display_name="Bioskop",
            category_hint="entertainment",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["cinema", "bioskop", "xx1", "jakarta", "surabaya", "bandung", "tix id", "tiket.com"]
        ),
        "game": MerchantClassification(
            merchant_type=MerchantType.ENTERTAINMENT,
            source_type="entertainment_gaming",
            merchant_name="game",
            display_name="Game / Aplikasi",
            category_hint="entertainment",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["steam", "garena", "riot", "moonton", "PUBG", "mobile legend", "free fire", "google play", "app store", "playstore"]
        ),
        "voucher": MerchantClassification(
            merchant_type=MerchantType.ENTERTAINMENT,
            source_type="entertainment_voucher",
            merchant_name="voucher",
            display_name="Voucher Game",
            category_hint="entertainment",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["voucher", "diamond", "uc", "pb", "garena shell", "steam wallet", "google play card"]
        ),
    }
    
    # ============================================
    # HEALTHCARE
    # ============================================
    HEALTHCARE = {
        "apotek": MerchantClassification(
            merchant_type=MerchantType.HEALTHCARE,
            source_type="healthcare_pharmacy",
            merchant_name="apotek",
            display_name="Apotek",
            category_hint="healthcare",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["apotek", "pharmacy", "kimia farma", "century", "guardian", "watson"]
        ),
        "rs": MerchantClassification(
            merchant_type=MerchantType.HEALTHCARE,
            source_type="healthcare_hospital",
            merchant_name="rumahsakit",
            display_name="Rumah Sakit",
            category_hint="healthcare",
            transaction_type_hint="debit",
            confidence=0.90,
            keywords=["rumah sakit", "rs", "hospital", "klinik", "doctor", "dokter"]
        ),
        "vitamin": MerchantClassification(
            merchant_type=MerchantType.HEALTHCARE,
            source_type="healthcare_vitamin",
            merchant_name="vitamin",
            display_name="Vitamin / Suplemen",
            category_hint="healthcare",
            transaction_type_hint="debit",
            confidence=0.85,
            keywords=["vitamin", "suplemen", "obat", "herbal", "jamu", "neozep", "woods", "OBH"]
        ),
    }
    
    # ============================================
    # QRIS MERCHANT PATTERNS
    # ============================================
    QRIS_KEYWORDS = {
        "merchant_name": [
            "qris", "qr", "quick response", "pembayaran", "payment"
        ],
        "common_merchants": {
            "minimarket": ["alfamart", "indomaret", "family mart", "lawson", "7-eleven"],
            "fnb": ["kopi", "cafe", "coffee", "warung", "restaurant", "makan", "food"],
            "transport": ["parkir", "bensin", "taxi", "ojek"],
            "utility": ["listrik", "air", "internet", "pulsa"],
        }
    }
    
    def __init__(self):
        """Initialize classifier with all merchant data."""
        # Combine all merchant dictionaries
        self.all_merchants: Dict[str, MerchantClassification] = {}
        for merchant_dict in [
            self.EWALLETS,
            self.BANK_HIMBARA,
            self.BANK_SWASTA,
            self.BANK_SYARIAH,
            self.BANK_PD,
            self.BANK_DIGITAL,
            self.RETAIL,
            self.FOOD_BEVERAGE,
            self.TRANSPORT,
            self.SHOPPING,
            self.BILLS,
            self.ENTERTAINMENT,
            self.HEALTHCARE,
        ]:
            self.all_merchants.update(merchant_dict)
    
    def classify(self, text: str, merchant_name: Optional[str] = None) -> MerchantClassification:
        """
        Classify a transaction based on text and/or merchant name.
        
        Args:
            text: Raw transaction text (SMS, description, etc.)
            merchant_name: Known merchant name if available
            
        Returns:
            MerchantClassification with type, category, and confidence
        """
        text_lower = text.lower()
        
        # If merchant name provided, try to match directly
        if merchant_name:
            merchant_match = self._match_merchant(merchant_name)
            if merchant_match:
                return merchant_match
        
        # Try to find matching keyword in text
        best_match = None
        best_score = 0
        
        for key, classification in self.all_merchants.items():
            score = 0
            matched_keywords = 0
            
            for keyword in classification.keywords:
                if keyword in text_lower:
                    # Exact match = higher score
                    score += 1.0
                    matched_keywords += 1
                elif keyword[:4] in text_lower:
                    # Partial match = lower score
                    score += 0.5
                    matched_keywords += 0.5
            
            # Boost score if merchant type keyword matches
            if classification.source_type.split('_')[0] in text_lower:
                score += 0.5
            
            if score > best_score:
                best_score = score
                best_match = classification
        
        if best_match and best_score >= 0.5:
            return best_match
        
        # Fallback: try to detect QRIS
        if any(k in text_lower for k in self.QRIS_KEYWORDS["merchant_name"]):
            return MerchantClassification(
                merchant_type=MerchantType.QRIS,
                source_type="qris_generic",
                merchant_name="qris",
                display_name="QRIS Payment",
                category_hint="other",
                transaction_type_hint="debit",
                confidence=0.70,
                keywords=[]
            )
        
        # No match found
        return MerchantClassification(
            merchant_type=MerchantType.OTHER,
            source_type="unknown",
            merchant_name="unknown",
            display_name="Unknown",
            category_hint="other",
            transaction_type_hint="debit",
            confidence=0.30,
            keywords=[]
        )
    
    def _match_merchant(self, merchant_name: str) -> Optional[MerchantClassification]:
        """Try to match merchant name to known classification."""
        merchant_lower = merchant_name.lower()
        
        for key, classification in self.all_merchants.items():
            for keyword in classification.keywords:
                if keyword in merchant_lower or merchant_lower in keyword:
                    return classification
        
        return None
    
    def get_category_suggestion(self, classification: MerchantClassification) -> str:
        """Map merchant type to transaction category."""
        category_map = {
            MerchantType.EWALLET: "food_beverages",
            MerchantType.BANK: "bank_transfer",
            MerchantType.RETAIL: "food_beverages",
            MerchantType.FOOD_BEVERAGE: "food_beverages",
            MerchantType.TRANSPORT: "transport",
            MerchantType.SHOPPING: "shopping",
            MerchantType.BILLS: "bills_utilities",
            MerchantType.ENTERTAINMENT: "entertainment",
            MerchantType.HEALTHCARE: "healthcare",
            MerchantType.QRIS: "other",
            MerchantType.OTHER: "other",
        }
        return category_map.get(classification.merchant_type, "other")
    
    def suggest_category_from_text(self, text: str) -> Tuple[str, float]:
        """
        Suggest category based on transaction text.
        
        Returns:
            Tuple of (category_name, confidence)
        """
        text_lower = text.lower()
        
        # Food & Beverages
        food_keywords = ["makan", "minum", "kopi", "cafe", "restaurant", "food", "drink", 
                        "mcd", "kfc", "starbucks", "bakso", "soto", "nasi", "mie"]
        if any(k in text_lower for k in food_keywords):
            return ("food_beverages", 0.85)
        
        # Transport
        transport_keywords = ["ojek", "taxi", "grab", "gojek", "bensin", "parkir", "tol", 
                           "krl", "kereta", "bus", "angkot"]
        if any(k in text_lower for k in transport_keywords):
            return ("transport", 0.85)
        
        # Shopping
        shopping_keywords = ["shopee", "tokopedia", "lazada", "beli", "belanja", "paket", "order"]
        if any(k in text_lower for k in shopping_keywords):
            return ("shopping", 0.85)
        
        # Bills
        bills_keywords = ["pln", "listrik", "pdam", "air", "bpjs", "telkom", "pulsa", "internet"]
        if any(k in text_lower for k in bills_keywords):
            return ("bills_utilities", 0.90)
        
        # Entertainment
        entertainment_keywords = ["netflix", "spotify", "youtube", "game", "bioskop", "cinema", "voucher"]
        if any(k in text_lower for k in entertainment_keywords):
            return ("entertainment", 0.85)
        
        # Healthcare
        health_keywords = ["apotek", "obat", "vitamin", "rumah sakit", "dokter", "klinik"]
        if any(k in text_lower for k in health_keywords):
            return ("healthcare", 0.85)
        
        # Default
        return ("other", 0.50)


# Global classifier instance
merchant_classifier = IndonesianMerchantClassifier()


def classify_transaction(text: str, merchant_name: Optional[str] = None) -> MerchantClassification:
    """Main entry point for transaction classification."""
    return merchant_classifier.classify(text, merchant_name)


def suggest_category(text: str) -> Tuple[str, float]:
    """Suggest category based on text."""
    return merchant_classifier.suggest_category_from_text(text)
