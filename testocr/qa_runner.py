"""
QA Test Runner for Receipt Parser
Validates parser output against Ground Truth files
"""

import os
import json
import sys
from receipt_parser import parse_receipt


class QATestRunner:
    def __init__(self, test_dir: str):
        self.test_dir = test_dir
        self.results = []
    
    def find_test_files(self) -> list:
        """Find all .txt files that have corresponding _gt.json files."""
        files = []
        for filename in os.listdir(self.test_dir):
            if filename.endswith('.txt') and not filename.endswith('_gt.json'):
                base_name = filename.replace('.txt', '')
                gt_file = f"{base_name}_gt.json"
                if os.path.exists(os.path.join(self.test_dir, gt_file)):
                    files.append({
                        'ocr_file': filename,
                        'gt_file': gt_file,
                        'base_name': base_name
                    })
        return files
    
    def load_ground_truth(self, gt_path: str) -> dict:
        """Load ground truth JSON file."""
        with open(gt_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def compare_items(self, parsed_items: list, gt_items: list) -> dict:
        """Compare parsed items with ground truth items."""
        comparison = {
            "parsed_count": len(parsed_items),
            "expected_count": len(gt_items),
            "count_match": len(parsed_items) == len(gt_items),
            "item_matches": [],
            "all_match": True
        }
        
        for i, (parsed, expected) in enumerate(zip(parsed_items, gt_items)):
            match = {
                "index": i,
                "name_match": parsed['name'] == expected['name'],
                "total_match": parsed['total'] == expected['total'],
                "is_discount_match": parsed['is_discount'] == expected['is_discount']
            }
            match["fully_matched"] = all([
                match["name_match"],
                match["total_match"],
                match["is_discount_match"]
            ])
            
            if not match["fully_matched"]:
                comparison["all_match"] = False
            
            match["parsed"] = parsed
            match["expected"] = expected
            comparison["item_matches"].append(match)
        
        # If counts don't match, not all items match
        if len(parsed_items) != len(gt_items):
            comparison["all_match"] = False
        
        return comparison
    
    def run_test(self, ocr_path: str, gt_path: str) -> dict:
        """Run single test case."""
        # Load OCR text
        with open(ocr_path, 'r', encoding='utf-8') as f:
            raw_text = f.read()
        
        # Load ground truth
        gt = self.load_ground_truth(gt_path)
        
        # Parse receipt
        result = parse_receipt(raw_text)
        
        # Compare results
        item_comparison = self.compare_items(result.get('items', []), gt.get('expected_items', []))
        
        # Compare totals
        expected_total = gt.get('expected_total', gt.get('expected_subtotal', 0))
        parsed_total = result.get('net_total', 0)
        total_diff = abs(parsed_total - expected_total)
        total_match = total_diff <= 100  # Allow small rounding errors
        
        # Compare items
        parsed_items = result.get('items', [])
        expected_items = gt.get('expected_items', [])
        
        item_count_match = len(parsed_items) == len(expected_items)
        
        # For SROIE format, only compare total (no item details in gt)
        sroie_profile = 'ENGLISH_SROIE' in result.get('profile', '')
        
        # Overall result
        if sroie_profile:
            # SROIE: only compare merchant + total
            merchant_match = gt.get('merchant_name', '').upper() in result.get('merchant_name', '').upper()
            test_passed = merchant_match and total_match
        else:
            test_passed = total_match and item_count_match
        
        return {
            "test_name": os.path.basename(ocr_path),
            "profile": result['profile'],
            "passed": test_passed,
            "total_match": total_match,
            "total_diff": total_diff,
            "item_comparison": item_comparison,
            "parsed_total": result['net_total'],
            "expected_total": gt.get('expected_total', 0),
            "parsed": result,
            "expected": gt
        }
    
    def run_all_tests(self) -> dict:
        """Run all test cases."""
        test_files = self.find_test_files()
        
        if not test_files:
            return {
                "error": f"No test files found in {self.test_dir}",
                "total": 0,
                "passed": 0,
                "failed": 0
            }
        
        total = len(test_files)
        passed = 0
        failed = 0
        results = []
        
        print("=" * 70)
        print(f"QA TEST RUNNER - Receipt Parser Validation")
        print(f"Test Directory: {self.test_dir}")
        print(f"Total Test Cases: {total}")
        print("=" * 70)
        print()
        
        for tf in test_files:
            ocr_path = os.path.join(self.test_dir, tf['ocr_file'])
            gt_path = os.path.join(self.test_dir, tf['gt_file'])
            
            result = self.run_test(ocr_path, gt_path)
            results.append(result)
            
            status = "✅ PASS" if result['passed'] else "❌ FAIL"
            if result['passed']:
                passed += 1
            else:
                failed += 1
            
            print(f"[{status}] {result['test_name']}")
            print(f"         Profile: {result['profile']}")
            print(f"         Items: {result['item_comparison']['parsed_count']}/{result['item_comparison']['expected_count']}")
            print(f"         Total: Rp {result['parsed_total']:,} (expected Rp {result['expected_total']:,})")
            
            if not result['passed']:
                print(f"         ISSUES:")
                if not result['item_comparison']['all_match']:
                    print(f"           - Item mismatch detected")
                if not result['total_match']:
                    print(f"           - Total mismatch: {result['parsed_total']} vs {result['expected_total']}")
                if not result['item_comparison']['count_match']:
                    print(f"           - Count mismatch: {result['item_comparison']['parsed_count']} vs {result['item_comparison']['expected_count']}")
            
            print()
        
        print("=" * 70)
        print(f"RESULTS: {passed}/{total} tests passed")
        print(f"         {failed} tests failed")
        print("=" * 70)
        
        return {
            "total": total,
            "passed": passed,
            "failed": failed,
            "results": results
        }


def main():
    # Default test directory
    test_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Allow override via command line
    if len(sys.argv) > 1:
        test_dir = sys.argv[1]
    
    runner = QATestRunner(test_dir)
    results = runner.run_all_tests()
    
    # Exit with error code if any tests failed
    if results.get('failed', 0) > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
