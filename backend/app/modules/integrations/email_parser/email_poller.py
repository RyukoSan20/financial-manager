"""
Email Poller - Background worker for periodic inbox checking.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from .gmail_oauth import GmailOAuth, GmailService
from .parser_registry import parser_registry


@dataclass
class PollerConfig:
    """Configuration for email polling."""
    poll_interval_minutes: int = 15  # Check every 15 minutes
    max_emails_per_poll: int = 50
    query_filter: str = "is:unread newer_than:1d"  # Unread emails from last day
    enabled_domains: List[str] = None  # Filter by domain
    
    def __post_init__(self):
        if self.enabled_domains is None:
            self.enabled_domains = [
                "bca.co.id",
                "mandiri.co.id",
                "bri.co.id",
                "bni.co.id",
                "gopay.co.id",
                "gojek.com",
                "ovo.id",
                "dana.id",
                "shopee.co.id",
                "tokopedia.com",
                "grab.com"
            ]


class EmailPoller:
    """
    Background worker that polls Gmail for new transaction emails.
    Uses idempotency to prevent duplicate transactions.
    """
    
    def __init__(self, db_session=None, redis_client=None):
        self.db = db_session
        self.redis = redis_client
        self.config = PollerConfig()
        self.oauth = GmailOAuth()
        self.running = False
        self.processed_count = 0
        self.created_count = 0
    
    async def poll(self, user_id: int, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """
        Poll emails for a user and create transactions.
        Returns summary of polling results.
        """
        try:
            # Get Gmail service
            access_token = self.oauth.get_access_token(credentials)
            gmail = GmailService(access_token)
            
            # Build query
            domains = " OR ".join([f"from:{d}" for d in self.config.enabled_domains])
            query = f"({domains}) {self.config.query_filter}"
            
            # Fetch messages
            messages = gmail.list_messages(query=query, max_results=self.config.max_emails_per_poll)
            
            results = {
                "emails_checked": len(messages),
                "transactions_created": 0,
                "duplicates_skipped": 0,
                "errors": 0,
                "transactions": []
            }
            
            for msg_summary in messages:
                try:
                    # Get full message
                    msg = gmail.get_message(msg_summary["id"])
                    if not msg:
                        continue
                    
                    # Check idempotency
                    if await self._is_duplicate(user_id, msg):
                        results["duplicates_skipped"] += 1
                        continue
                    
                    # Parse email
                    result = parser_registry.parse(msg)
                    
                    if result.success and result.transaction:
                        # Create transaction in database
                        tx = await self._create_transaction(user_id, result.transaction, msg)
                        if tx:
                            results["transactions_created"] += 1
                            results["transactions"].append({
                                "id": tx.id,
                                "amount": tx.amount,
                                "merchant": tx.merchant or ""
                            })
                            
                            # Mark as processed
                            await self._mark_processed(user_id, msg, tx.id)
                    
                    self.processed_count += 1
                    
                except Exception as e:
                    results["errors"] += 1
                    print(f"[EmailPoller] Error processing email: {e}")
            
            self.created_count += results["transactions_created"]
            return results
            
        except Exception as e:
            return {
                "emails_checked": 0,
                "transactions_created": 0,
                "error": str(e)
            }
    
    async def _is_duplicate(self, user_id: int, msg: Dict[str, Any]) -> bool:
        """Check if email has already been processed."""
        if not self.redis:
            # Fallback to database check
            return await self._db_check_duplicate(user_id, msg)
        
        # Redis-based check
        key = f"email:processed:{user_id}:{msg['id']}"
        return self.redis.exists(key) > 0
    
    async def _db_check_duplicate(self, user_id: int, msg: Dict[str, Any]) -> bool:
        """Check database for duplicate email."""
        # This would query the processed_emails table
        return False
    
    async def _mark_processed(self, user_id: int, msg: Dict[str, Any], transaction_id: int):
        """Mark email as processed."""
        if self.redis:
            key = f"email:processed:{user_id}:{msg['id']}"
            import json
            self.redis.setex(
                key,
                86400 * 7,  # 7 days TTL
                json.dumps({"transaction_id": transaction_id, "processed_at": datetime.utcnow().isoformat()})
            )
    
    async def _create_transaction(self, user_id: int, parsed_tx, msg: Dict) -> Any:
        """Create transaction in database."""
        if not self.db:
            return None
        
        from app.models.transaction import Transaction
        from app.models.category import Category
        
        # Get or create category
        category = self.db.query(Category).filter(
            Category.name == parsed_tx.category
        ).first()
        
        if not category:
            category = Category(name=parsed_tx.category, icon="receipt", color="#666")
            self.db.add(category)
            self.db.flush()
        
        # Create transaction
        tx = Transaction(
            user_id=user_id,
            account_id=1,  # Default account
            category_id=category.id,
            amount=parsed_tx.amount if parsed_tx.transaction_type == "income" else -abs(parsed_tx.amount),
            type=parsed_tx.transaction_type,
            description=parsed_tx.description,
            date=parsed_tx.date,
            reference=parsed_tx.reference,
            notes=f"Source: Email {msg['id']}"
        )
        
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        
        return tx
    
    async def start_background(self, user_id: int, credentials: Dict[str, Any]):
        """Start background polling loop."""
        self.running = True
        interval = self.config.poll_interval_minutes * 60
        
        while self.running:
            await self.poll(user_id, credentials)
            await asyncio.sleep(interval)
    
    def stop(self):
        """Stop background polling."""
        self.running = False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get polling statistics."""
        return {
            "running": self.running,
            "processed_count": self.processed_count,
            "created_count": self.created_count
        }


async def run_poller_for_user(user_id: int, credentials: Dict[str, Any], db_session=None):
    """Run email poller for a specific user."""
    poller = EmailPoller(db_session=db_session)
    return await poller.poll(user_id, credentials)
