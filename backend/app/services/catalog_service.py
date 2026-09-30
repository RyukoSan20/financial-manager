"""
Lightweight Catalog Matcher Service
FastEmbed ONNX + FAISS + RapidFuzz - No PyTorch dependency
Singleton pattern to prevent model reload on every request
"""

import logging
import threading
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Indonesian product categories
CATEGORIES_DICT = {
    "Makanan & Minuman": [
        "ROTI", "SUSU", "KOPI", "MILK", "TEH", "MIE", "SNACK", "CIMORY", 
        "AIR", "RICE", "KEJU", "COKLAT", "BISCUIT", "WAFFER", "CEREAL",
        "YOGURT", "ES", "JUS", "SARI", "TEMPE", "TAHU", "TELUR",
        "NASI", "AYAM", "IKAN", "DAGING", "SAUS", "KECAP", "GORENGAN",
        "INDOMARET", "ALFRAMART", "VOUCHER", "PAKET", "MAKANAN"
    ],
    "Kebutuhan Rumah": [
        "PLASTIK", "TISSUE", "SABUN", "RINSO", "SUNLIGHT", "PEWANGI",
        "PEMBERSIH", "OBAT", "SEMPROT", "SENTER", "BATTERY", "BATERAI",
        "LAMPU", "TALANG", "GORDEN", "SARUNG", "BANTAL", "SELIMUT",
        "JARUM", "BENANG", "PENJEPIT", "PLESTER"
    ],
    "Perawatan Diri": [
        "SHAMPOO", "PASTA", "GIGI", "PANTENE", "REXO", "NIVEA", "FACIAL",
        "SABUN MUKA", "LOTION", "KRIM", "SUNBLOCK", "PARFUM", "DEODORAN",
        "RAKITAN", "PAPAN", "SISIR", "Sikat Gigi", "MINYAK", "VCO"
    ],
    "Minuman & Teh": [
        "TEH", "KOPI", "COKLAT", "SUSU", "JUS", "AIR", "MINERAL",
        "LEMON", "JERUK", "TEH BOTOL", "KOPI BUBUK", "BUBUK", "PACK"
    ],
    "Obat-obatan": [
        "OBAT", "VITAMIN", "SUPPLEMENT", "ANTIBIOTIK", "PARASETAMOL",
        "IBUPROFEN", "MASKER", "HAND SANITIZER", "ALKOHOL", "BETADINE",
        "OBAT LUKA", "Tolak ANGIN", "ANTIMO", "WOODS"
    ],
    "Lain-lain": []
}

# Indonesian Master Catalog (expandable)
MASTER_CATALOG = [
    # Rotibunk
    {"canonical_name": "Sari Roti Krim Keju 72g", "category": "Makanan & Minuman"},
    {"canonical_name": "Sari Roti Tawar 600g", "category": "Makanan & Minuman"},
    {"canonical_name": "Sari Roti Sandwich 450g", "category": "Makanan & Minuman"},
    {"canonical_name": "Sari Roti Coklat 400g", "category": "Makanan & Minuman"},
    
    # Susu & Dairy
    {"canonical_name": "Cimory Milk Mix Berry 225ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Cimory Yoghurt Drink 250ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Cimory Custard Pudding 120g", "category": "Makanan & Minuman"},
    {"canonical_name": "Indomaret Susu UHT 125ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Frisian Flag Susu Cair 250ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Ultra Milk Full Cream 1000ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Ultra Milk Low Fat 1000ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Bear Brand Susu Murni 180ml", "category": "Makanan & Minuman"},
    
    # Air Mineral
    {"canonical_name": "Indomaret Air Mineral 240ml", "category": "Minuman & Teh"},
    {"canonical_name": "Aqua Air Mineral 600ml", "category": "Minuman & Teh"},
    {"canonical_name": "Le Mineral Air 600ml", "category": "Minuman & Teh"},
    {"canonical_name": "Cleo Air Mineral 600ml", "category": "Minuman & Teh"},
    {"canonical_name": "Nestle Pure Life 600ml", "category": "Minuman & Teh"},
    
    # Teh & Kopi
    {"canonical_name": "Teh Pucuk Harum 350ml", "category": "Minuman & Teh"},
    {"canonical_name": "Teh Botol Sosro 450ml", "category": "Minuman & Teh"},
    {"canonical_name": "Kopi Susu Gula Aren 180ml", "category": "Minuman & Teh"},
    {"canonical_name": "Kopi Janji Jiwa 300ml", "category": "Minuman & Teh"},
    {"canonical_name": "Cappuccino 150ml", "category": "Minuman & Teh"},
    
    # Mie Instan
    {"canonical_name": "Supermie Goreng 85g", "category": "Makanan & Minuman"},
    {"canonical_name": "Mie Sedaap Goreng 85g", "category": "Makanan & Minuman"},
    {"canonical_name": "Indomaret Mie 75g", "category": "Makanan & Minuman"},
    {"canonical_name": "Mie Sedap Chicken 75g", "category": "Makanan & Minuman"},
    {"canonical_name": "Indomaret Rebo 80g", "category": "Makanan & Minuman"},
    
    # Household
    {"canonical_name": "Indomaret Sabun Mandi 80g", "category": "Kebutuhan Rumah"},
    {"canonical_name": "Lifebuoy Sabun 80g", "category": "Kebutuhan Rumah"},
    {"canonical_name": "Rinso Anti Noda 900g", "category": "Kebutuhan Rumah"},
    {"canonical_name": "Sunlight Sabun Cuci 780ml", "category": "Kebutuhan Rumah"},
    {"canonical_name": "Bayclin Pemutih 800ml", "category": "Kebutuhan Rumah"},
    {"canonical_name": "So Klin Lantai 850ml", "category": "Kebutuhan Rumah"},
    
    # Personal Care
    {"canonical_name": "Shampo Clear Men 170ml", "category": "Perawatan Diri"},
    {"canonical_name": "Pantene Sampo 170ml", "category": "Perawatan Diri"},
    {"canonical_name": "Head Shoulders 170ml", "category": "Perawatan Diri"},
    {"canonical_name": "Pasta Gigi Pepsodent 150g", "category": "Perawatan Diri"},
    {"canonical_name": "Pasta Gigi Close Up 150g", "category": "Perawatan Diri"},
    {"canonical_name": "Listerine 250ml", "category": "Perawatan Diri"},
    
    # Obat
    {"canonical_name": "Paracetamol 500mg", "category": "Obat-obatan"},
    {"canonical_name": "OBH Combi 100ml", "category": "Obat-obatan"},
    {"canonical_name": "Vitamin C 500mg", "category": "Obat-obatan"},
    {"canonical_name": "Counterpain Krim 30g", "category": "Obat-obatan"},
    {"canonical_name": "Hansaplast Koyo 6pcs", "category": "Obat-obatan"},
]


class LightweightCatalogMatcher:
    """
    Singleton Catalog Matcher using FastEmbed ONNX + FAISS.
    No PyTorch dependency - uses ONNX Runtime for ~150MB RAM instead of 800MB+.
    """
    _instance = None
    _lock = threading.Lock()
    _initialized = False

    def __new__(cls, *args, **kwargs):
        """Singleton pattern - one instance per process lifetime."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(LightweightCatalogMatcher, cls).__new__(cls)
        return cls._instance

    def __init__(self, master_catalog: List[Dict[str, str]] = None):
        if self._initialized:
            return
        
        self.catalog = master_catalog or MASTER_CATALOG
        self.names = [c["canonical_name"] for c in self.catalog]
        self.index = None
        self.embedding_model = None
        self._initialized = True
        self._init_embeddings()

    def _init_embeddings(self):
        """Initialize FastEmbed embeddings and FAISS index."""
        try:
            from fastembed import TextEmbedding
            import faiss
            import numpy as np
            
            # Use BAAI/bge-small-en-v1.5 - lightweight multilingual model
            # This is ONNX-based, no PyTorch needed
            self.embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            logger.info("FastEmbed model loaded successfully")
            
            if self.names:
                # Generate embeddings
                embeddings = list(self.embedding_model.embed(self.names))
                embeddings_np = np.array(embeddings).astype('float32')
                
                # Normalize for cosine similarity
                faiss.normalize_L2(embeddings_np)
                
                # Create FAISS index
                dim = embeddings_np.shape[1]
                self.index = faiss.IndexFlatIP(dim)
                self.index.add(embeddings_np)
                
                logger.info(f"FAISS index created with {len(self.catalog)} items, dim={dim}")
                
        except ImportError as e:
            logger.warning(f"FastEmbed not available: {e}")
        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {e}")

    def auto_classify(self, name: str) -> str:
        """Rule-based category classification."""
        name_upper = name.upper()
        
        for category, keywords in CATEGORIES_DICT.items():
            if any(kw in name_upper for kw in keywords):
                return category
        
        return "Lain-lain"

    def match(self, raw_name: str) -> Dict[str, Any]:
        """Match single item to catalog with confidence score."""
        if not raw_name:
            return {"canonical_name": "", "category": "Lain-lain", "confidence": 0.0}
        
        # Default result
        result = {
            "canonical_name": raw_name,
            "category": self.auto_classify(raw_name),
            "confidence": 0.5
        }
        
        if not self.index or not self.embedding_model:
            return result
        
        try:
            from rapidfuzz import process, fuzz
            import numpy as np
            import faiss
            
            # Semantic search with FAISS
            q_emb = list(self.embedding_model.embed([raw_name]))
            q_vec = np.array(q_emb).astype('float32')
            faiss.normalize_L2(q_vec)
            
            distances, indices = self.index.search(q_vec, k=3)
            
            sem_score = float(distances[0][0]) if len(distances) > 0 and distances[0][0] > 0 else 0
            
            # Fuzzy match with RapidFuzz
            fz_match = process.extractOne(raw_name, self.names, scorer=fuzz.token_sort_ratio)
            fz_score = (fz_match[1] / 100.0) if fz_match else 0
            
            # Combined score: 60% semantic + 40% fuzzy
            final_score = (sem_score * 0.6) + (fz_score * 0.4)
            
            best_idx = indices[0][0] if len(indices) > 0 else -1
            
            if final_score >= 0.55 and 0 <= best_idx < len(self.catalog):
                matched = self.catalog[best_idx]
                result = {
                    "canonical_name": matched["canonical_name"],
                    "category": matched.get("category", "Lain-lain"),
                    "confidence": round(final_score, 2)
                }
            else:
                # No good match - use rule-based category
                result["confidence"] = round(final_score, 2)
                
        except Exception as e:
            logger.warning(f"Match failed for '{raw_name}': {e}")
        
        return result

    def match_and_enrich_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enrich all items with catalog matching."""
        enriched = []
        
        for item in items:
            raw_name = item.get('name', '')
            match_info = self.match(raw_name)
            
            # Preserve original prices - check all possible key names
            price_per_unit = (
                item.get('price_per_unit') or 
                item.get('price') or 
                item.get('unit_price') or 
                0
            )
            total_price = (
                item.get('total_price') or 
                item.get('total') or 
                item.get('amount') or
                item.get('price', 0)  # fallback to price if no total
            )
            
            enriched_item = {
                'name': raw_name,
                'canonical_name': match_info['canonical_name'],
                'quantity': item.get('quantity', 1),
                'price_per_unit': price_per_unit,
                'total_price': total_price,
                'category': match_info['category'],
                'match_confidence': match_info['confidence']
            }
            enriched.append(enriched_item)
        
        return enriched


# Singleton instance
catalog_matcher = LightweightCatalogMatcher()


def match_items_to_catalog(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convenience function for matching items."""
    return catalog_matcher.match_and_enrich_items(items)
