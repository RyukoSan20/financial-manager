"""
Bill Split Service - Split receipt items among users/categories.
"""

from typing import List, Dict, Any, Optional
from decimal import Decimal


def split_receipt_items(
    items: List[Dict[str, Any]],
    subtotal: float,
    discount_total: float,
    grand_total: float,
    assignments: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Split receipt items among users with proportional discount distribution.
    
    Args:
        items: List of items from parser [{name, quantity, price_per_unit, total_price}, ...]
        subtotal: Sum of all item prices
        discount_total: Total discount amount
        grand_total: Final amount paid
        assignments: Optional dict mapping item index to user_id
    
    Returns:
        {
            "per_user": {
                "user_id_1": {
                    "items": [...],
                    "subtotal": 10000,
                    "discount": 500,
                    "total": 9500
                }
            },
            "per_category": {
                "Makanan": {items: [...], total: 5000},
                "Minuman": {items: [...], total: 3000}
            },
            "unassigned": {
                "items": [...],
                "total": 1000
            }
        }
    """
    if not items:
        return {"per_user": {}, "per_category": {}, "unassigned": {"items": [], "total": 0}}
    
    # Calculate discount ratio
    discount_ratio = 1.0
    if subtotal > 0 and discount_total > 0:
        discount_ratio = (subtotal - discount_total) / subtotal
    
    result = {
        "per_user": {},
        "per_category": {},
        "unassigned": {"items": [], "total": 0}
    }
    
    for idx, item in enumerate(items):
        raw_price = item.get("total_price", 0)
        effective_price = round(raw_price * discount_ratio, 2)
        
        # Determine assignment
        user_id = "unassigned"
        if assignments and str(idx) in assignments:
            user_id = assignments[str(idx)]
        elif assignments and item.get("name"):
            # Try to find by item name
            for key, uid in assignments.items():
                if key.lower() in item.get("name", "").lower():
                    user_id = uid
                    break
        
        # Category based on item name (simple heuristic)
        category = categorize_item(item.get("name", ""))
        
        item_with_effective = {
            **item,
            "effective_price": effective_price,
            "original_price": raw_price,
            "index": idx
        }
        
        # Add to user group
        if user_id not in result["per_user"]:
            result["per_user"][user_id] = {"items": [], "subtotal": 0, "discount": 0, "total": 0}
        result["per_user"][user_id]["items"].append(item_with_effective)
        result["per_user"][user_id]["total"] += effective_price
        
        # Add to category group
        if category not in result["per_category"]:
            result["per_category"][category] = {"items": [], "total": 0}
        result["per_category"][category]["items"].append(item_with_effective)
        result["per_category"][category]["total"] += effective_price
    
    # Round totals
    for user_id in result["per_user"]:
        result["per_user"][user_id]["total"] = round(result["per_user"][user_id]["total"], 2)
        result["per_user"][user_id]["subtotal"] = round(sum(i["original_price"] for i in result["per_user"][user_id]["items"]), 2)
        result["per_user"][user_id]["discount"] = round(result["per_user"][user_id]["subtotal"] - result["per_user"][user_id]["total"], 2)
    
    for category in result["per_category"]:
        result["per_category"][category]["total"] = round(result["per_category"][category]["total"], 2)
    
    result["unassigned"]["total"] = round(sum(i["effective_price"] for i in result["unassigned"]["items"]), 2)
    
    return result


def categorize_item(item_name: str) -> str:
    """Simple category assignment based on item name keywords."""
    name_upper = item_name.upper()
    
    # Food keywords
    food_keywords = ["ROTI", "NASI", "MIE", "MIE", "SOTO", "BAKSO", "AYAM", "GORENG", 
                     "RENDANG", "GADO", "SALAD", "BURGER", "PIZZA", "PASTA", "NOODLE",
                     "CHICKEN", "BEEF", "PORK", "FISH", "SEAFOOD", "Sushi", "RAMEN"]
    
    # Drink keywords  
    drink_keywords = ["KOPI", "TEH", "COFFEE", "ES", "SUSU", "MILK", "JUICE", 
                      "SMOOTHIE", "SHAKE", "WATER", "AQUA", "COCA", "SPRITE", "FANTA",
                      "LEMON", "ORANGE", "MANGO", "AVOCADO", "JUS", "LATTE", "CAPPUCCINO"]
    
    # Transport
    transport_keywords = ["BENSIN", "PERTALITE", "PERTAMAX", "SOLAR", "PREMIUM",
                        "TOL", "PARKING", "PARKIR", "TRANSPORT", "TAXI", "GRAB", "GOJEK"]
    
    # Shopping
    shopping_keywords = ["PLASTIK", "KANTONG", "BAG", "SABUN", "SAMPOO", "PASTE",
                         "TOILET", "SOFTENER", "DETERGENT", "MINYAK", "GORENGAN"]
    
    for keyword in food_keywords:
        if keyword in name_upper:
            return "Makanan"
    
    for keyword in drink_keywords:
        if keyword in name_upper:
            return "Minuman"
    
    for keyword in transport_keywords:
        if keyword in name_upper:
            return "Transportasi"
    
    for keyword in shopping_keywords:
        if keyword in name_upper:
            return "Belanja"
    
    return "Lainnya"


def calculate_split_totals(split_result: Dict[str, Any]) -> Dict[str, float]:
    """Calculate total per user from split result."""
    totals = {}
    for user_id, data in split_result.get("per_user", {}).items():
        totals[user_id] = data["total"]
    return totals
