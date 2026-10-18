"""
KMS Encryption Module - AES-256-GCM encryption for sensitive credentials.
Handles encryption of bank tokens, OAuth secrets, and PII data.
"""
import os
import base64
import hashlib
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend


class KMSEncryption:
    """
    AES-256-GCM encryption for storing sensitive credentials.
    Uses PBKDF2 for key derivation from master password.
    """
    
    def __init__(self, master_key: Optional[str] = None):
        self.master_key = master_key or os.getenv("KMS_MASTER_KEY", "default-dev-key-change-in-production")
        self.nonce_size = 12  # 96 bits for GCM
        self.tag_size = 16    # 128 bits authentication tag
    
    def _derive_key(self, salt: bytes) -> bytes:
        """Derive encryption key from master key using PBKDF2."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,  # 256 bits for AES-256
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return kdf.verify(self.master_key.encode(), salt)
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.
        Returns base64-encoded string: salt(16) + nonce(12) + ciphertext + tag(16)
        """
        if not plaintext:
            return ""
        
        # Generate random salt and nonce
        salt = os.urandom(16)
        nonce = os.urandom(self.nonce_size)
        
        # Derive key
        key = self._derive_key(salt)
        
        # Encrypt with AES-GCM
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
        
        # Combine: salt + nonce + ciphertext (includes tag)
        encrypted = salt + nonce + ciphertext
        
        return base64.b64encode(encrypted).decode('utf-8')
    
    def decrypt(self, encrypted: str) -> str:
        """
        Decrypt base64-encoded ciphertext.
        """
        if not encrypted:
            return ""
        
        try:
            data = base64.b64decode(encrypted)
            
            # Extract components
            salt = data[:16]
            nonce = data[16:16 + self.nonce_size]
            ciphertext = data[16 + self.nonce_size:]
            
            # Derive key and decrypt
            key = self._derive_key(salt)
            aesgcm = AESGCM(key)
            
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")
    
    def hash_sensitive(self, value: str) -> str:
        """
        Create one-way hash of sensitive data (NIK, account numbers).
        Uses SHA-256 with salt for rainbow table protection.
        """
        salt = os.urandom(16)
        hash_input = salt + value.encode('utf-8')
        digest = hashlib.sha256(hash_input).digest()
        return base64.b64encode(salt + digest).decode('utf-8')
    
    def verify_hash(self, value: str, hashed: str) -> bool:
        """Verify value against hashed version."""
        try:
            decoded = base64.b64decode(hashed)
            salt = decoded[:16]
            stored_hash = decoded[16:]
            hash_input = salt + value.encode('utf-8')
            computed = hashlib.sha256(hash_input).digest()
            return computed == stored_hash
        except:
            return False


# Singleton instance
kms = KMSEncryption()


def encrypt_token(token: str) -> str:
    """Encrypt bank/OAuth token for storage."""
    return kms.encrypt(token)


def decrypt_token(encrypted: str) -> str:
    """Decrypt stored token."""
    return kms.decrypt(encrypted)


def hash_pii(value: str) -> str:
    """Hash PII data (NIK, account number) for safe storage."""
    return kms.hash_sensitive(value)
