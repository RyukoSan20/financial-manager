"""
Local Catalog Matcher Service
FAISS Vector Search + RapidFuzz + Auto-Categorization
"""

import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Indonesian product categories
CATEGORIES_DICT = {
    "Makanan & Minuman": [
        "ROTI", "SUSU", "KOPI", "MILK", "TEH", "MIE", "SNACK", "CIMORY", 
        "AIR", "RICE", "KEJU", "COKLAT", "BISCUIT", "WAFFER", "CEREAL",
        "YOGURT", "ES", "JUS", "SARI", "TEMPE", "TAHU", "TELUR",
        "NASI", "AYAM", "IKAN", "DAGING", "SAUS", "KECAP", "GORENGAN"
    ],
    "Kebutuhan Rumah": [
        "PLASTIK", "TISSUE", "SABUN", "RINSO", "SUNLIGHT", "PEWANGI",
        "PEMBERSIH", "OBAT", "SEMPROT", "SENTER", "BATTERY", "BATERAI",
        "LAMPU", "TALANG", "PLTA", "GORDEN", "SARUNG", "BANTAL"
    ],
    "Perawatan Diri": [
        "SHAMPOO", "PASTA", "GIGI", "PANTENE", "REXO", "NIVEA", "FACIAL",
        "SABUN MUKA", "LOTION", "KRIM", "SUNBLOCK", "PARFUM", "DEODORAN",
        "RAKITAN", "PAPAN", "SISIR", "Sikat Gigi"
    ],
    "Minuman & Teh": [
        "TEH", "KOPI", "COKLAT", "SUSU", "JUS", "AIR", "MINERAL",
        "LEMON", "JERUK", "TEH BOTOL", "KOPI BUBUK"
    ],
    "Obat-obatan": [
        "OBAT", "VITAMIN", "SUPPLEMENT", "ANTIBIOTIK", "PARASETAMOL",
        "IBUPROFEN", "MASKER", "HAND SANITIZER", "ALKOHOL"
    ],
    "Lain-lain": []
}

# Indonesian Master Catalog (sample - expandable)
MASTER_CATALOG = [
    {"canonical_name": "Sari Roti Krim Keju 72g", "category": "Makanan & Minuman"},
    {"canonical_name": "Sari Roti Tawar 600g", "category": "Makanan & Minuman"},
    {"canonical_name": "Cimory Milk Mix Berry 225ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Cimory Yoghurt Drink 250ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Indomaret Air Mineral 240ml", "category": "Minuman & Teh"},
    {"canonical_name": "Aqua Air Mineral 600ml", "category": "Minuman & Teh"},
    {"canonical_name": "Le Mineral Air 600ml", "category": "Minuman & Teh"},
    {"canonical_name": "Teh Pucuk Harum 350ml", "category": "Minuman & Teh"},
    {"canonical_name": "Kopi Susu Gula Aren 180ml", "category": "Minuman & Teh"},
    {"canonical_name": "Indomaret Susu UHT 125ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Frisian Flag Susu Cair 250ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Ultra Milk Full Cream 1000ml", "category": "Makanan & Minuman"},
    {"canonical_name": "Supermie Goreng 85g", "category": "Makanan & Minuman"},
    {"canonical_name": "Mie Sedaap Goreng 85g", "category": "Makanan & Minuman"},
    {"canonical_name": "Indomaret Sabun Mandi 80g", "category": "Kebutuhan Rumah"},
    {"canonical_name": "Lifebuoy Sabun 80g", "category": "Kebutuhan Rumah"},
    {"canonical_name": "Rinso Anti Noda 900g", "category": "Kebutuhan Rumah"},
    {"canonical_name": "Sunlight Sabun Cuci 780ml", "category": "Kebutuhan Rumah"},
    {"canonical_name": "Shampo Clear Men 170ml", "category": "Perawatan Diri"},
    {"canonical_name": "Pantene Sampo 170ml", "category": "Perawatan Diri"},
    {"canonical_name": "Pasta Gigi Pepsodent 150g", "category": "Perawatan Diri"},
    {"canonical_name": "Paracetamol 500mg", "category": "Obat-obatan"},
    {"canonical_name": "Obat Maag", "category": "Obat-obatan"},
    {"canonical_name": "Vitamin C 500mg", "category": "Obat-obatan"},
]


class LocalCatalogMatcher:
    def __init__(self):
        self.catalog = MASTER_CATALOG
        self.names = [c["canonical_name"] for c in self.catalog]
        self.index = None
        self.embeddings = None
        self.model = None
        self._initialized = False

    def _initialize(self):
        """Lazy initialization of ML components."""
        if self._initialized:
            return
        
        try:
            from sentence_transformers import SentenceTransformer
            import faiss
            import numpy as np
            
            # Load lightweight multilingual model
            self.model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
            
            if self.names:
                # Generate embeddings
                self.embeddings = self.model.encode(self.names, convert_to_numpy=True)
                
                # Normalize for cosine similarity
                faiss.normalize_L2(self.embeddings)
                
                # Create FAISS index
                self.index = faiss.IndexFlatIP(self.embeddings.shape[1])
                self.index.add(self.embeddings)
            
            self._initialized = True
            logger.info(f"Catalog matcher initialized with {len(self.catalog)} items")
            
        except ImportError as e:
            logger.warning(f"ML libraries not available: {e}")
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize catalog matcher: {e}")
            self._initialized = True

    def auto_classify(self, name: str) -> str:
        """Rule-based category classification."""
        name_upper = name.upper()
        
        for category, keywords in CATEGORIES_DICT.items():
            if any(kw in name_upper for kw in keywords):
                return category
        
        return "Lain-lain"

    def match_item(self, raw_name: str) -> Dict[str, Any]:
        """Match single item to catalog with confidence score."""
        self._initialize()
        
        result = {
            'name': raw_name,
            'canonical_name': raw_name,
            'category': self.auto_classify(raw_name),
            'match_confidence': 0.5
        }
        
        if not self.index or not self.model:
            return result
        
        try:
            from rapidfuzz import process, fuzz
            import numpy as np
            import faiss
            
            # Semantic search with FAISS
            q_vec = self.model.encode([raw_name], convert_to_numpy=True)
            faiss.normalize_L2(q_vec)
            distances, indices = self.index.search(q_vec, k=3)
            
            sem_score = float(distances[0][0]) if len(distances) > 0 else 0
            
            # Fuzzy match with RapidFuzz
            fz_match = process.extractOne(raw_name, self.names, scorer=fuzz.token_sort_ratio)
            fz_score = (fz_match[1] / 100.0) if fz_match else 0
            
            # Combined score (60% semantic + 40% fuzzy)
            final_score = (sem_score * 0.6) + (fz_score * 0.4)
            
            # If good match found
            if final_score >= 0.55:
                best_idx = indices[0][0] if len(indices) > 0 else -1
                if 0 <= best_idx < len(self.catalog):
                    matched = self.catalog[best_idx]
                    result['canonical_name'] = matched['canonical_name']
                    result['category'] = matched['category']
                    result['match_confidence'] = round(final_score, 2)
                    
        except Exception as e:
            logger.warning(f"Match failed for '{raw_name}': {e}")
        
        return result

    def match_and_enrich_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enrich all items with catalog matching and auto-categorization."""
        enriched = []
        
        for item in items:
            matched = self.match_item(item.get('name', ''))
            
            enriched_item = {
                'name': item.get('name', ''),
                'canonical_name': matched['canonical_name'],
                'quantity': item.get('quantity', 1),
                'price_per_unit': item.get('price_per_unit', 0),
                'total_price': item.get('total_price', 0),
                'category': matched['category'],
                'match_confidence': matched['match_confidence']
            }
            enriched.append(enriched_item)
        
        return enriched


# Singleton instance
catalog_matcher = LocalCatalogMatcher()


def match_items_to_catalog(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convenience function for matching items."""
    return catalog_matcher.match_and_enrich_items(items)
