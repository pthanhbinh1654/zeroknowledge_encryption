"""
Crypto Service - Zero-Knowledge Cryptography
===========================================
Service hỗ trợ các thuật toán mã hóa theo yêu cầu:
- Symmetric: AES-256-GCM, XChaCha20-Poly1305, Camellia-CTR+HMAC
- Asymmetric: X25519, Kyber1024
- Signature: Ed25519, Dilithium3/5
- KDF: Argon2id
"""

import logging
import base64
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

from app.models.encrypted_file import (
    EncryptionAlgorithm,
    KeyWrapAlgorithm,
    SignatureAlgorithm,
    KeyDerivationFunction,
    CryptoAlgorithmInfo,
    KeyPairResponse
)

logger = logging.getLogger(__name__)

class CryptoService:
    """Service xử lý các thuật toán mã hóa theo Zero-Knowledge principles"""
    
    def __init__(self):
        self.algorithms = self._initialize_algorithms()
    
    def _initialize_algorithms(self) -> Dict[str, CryptoAlgorithmInfo]:
        """Khởi tạo danh sách thuật toán được hỗ trợ"""
        return {
            # Symmetric Encryption
            "AES-256-GCM": CryptoAlgorithmInfo(
                name="AES-256-GCM",
                type="symmetric",
                security_level="256-bit",
                description="AES-256 với GCM mode, kết hợp mã hóa và xác thực",
                recommended=True
            ),
            "XChaCha20-Poly1305": CryptoAlgorithmInfo(
                name="XChaCha20-Poly1305",
                type="symmetric",
                security_level="256-bit",
                description="XChaCha20 stream cipher với Poly1305 authentication",
                recommended=True
            ),
            "Camellia-CTR-HMAC": CryptoAlgorithmInfo(
                name="Camellia-CTR-HMAC",
                type="symmetric",
                security_level="256-bit",
                description="Camellia-CTR với HMAC-SHA256 cho toàn vẹn",
                recommended=False
            ),
            
            # Key Derivation
            "Argon2id": CryptoAlgorithmInfo(
                name="Argon2id",
                type="kdf",
                security_level="256-bit",
                description="Argon2id cho derive key từ password",
                recommended=True
            ),
            
            # Asymmetric Encryption
            "X25519": CryptoAlgorithmInfo(
                name="X25519",
                type="asymmetric",
                security_level="256-bit",
                description="X25519 key exchange cho hybrid encryption",
                recommended=True
            ),
            "Kyber-1024": CryptoAlgorithmInfo(
                name="Kyber-1024",
                type="asymmetric",
                security_level="quantum-resistant",
                description="Kyber1024 KEM hậu lượng tử",
                recommended=True
            ),
            
            # Digital Signatures
            "Ed25519": CryptoAlgorithmInfo(
                name="Ed25519",
                type="signature",
                security_level="256-bit",
                description="Ed25519 chữ ký số dựa trên Edwards curve",
                recommended=True
            ),
            "Dilithium3": CryptoAlgorithmInfo(
                name="Dilithium3",
                type="signature",
                security_level="quantum-resistant",
                description="Dilithium3 chữ ký hậu lượng tử (level 3)",
                recommended=True
            ),
            "Dilithium5": CryptoAlgorithmInfo(
                name="Dilithium5",
                type="signature",
                security_level="quantum-resistant",
                description="Dilithium5 chữ ký hậu lượng tử (level 5)",
                recommended=True
            )
        }
    
    def get_supported_algorithms(self) -> Dict[str, List[CryptoAlgorithmInfo]]:
        """Lấy danh sách thuật toán được hỗ trợ theo loại"""
        algorithms_by_type = {
            "symmetric": [],
            "asymmetric": [],
            "signature": [],
            "kdf": []
        }
        
        for alg in self.algorithms.values():
            algorithms_by_type[alg.type].append(alg)
        
        return algorithms_by_type
    
    def get_algorithm_info(self, algorithm_name: str) -> Optional[CryptoAlgorithmInfo]:
        """Lấy thông tin chi tiết của thuật toán"""
        return self.algorithms.get(algorithm_name)
    
    def validate_algorithm(self, algorithm_name: str, algorithm_type: str) -> bool:
        """Validate thuật toán có được hỗ trợ không"""
        alg = self.algorithms.get(algorithm_name)
        if not alg:
            return False
        return alg.type == algorithm_type
    
    def get_recommended_algorithms(self) -> Dict[str, List[str]]:
        """Lấy danh sách thuật toán được khuyến nghị"""
        recommended = {
            "symmetric": [],
            "asymmetric": [],
            "signature": [],
            "kdf": []
        }
        
        for alg in self.algorithms.values():
            if alg.recommended:
                recommended[alg.type].append(alg.name)
        
        return recommended
    
    def generate_key_pair_info(self, algorithm: str) -> Optional[KeyPairResponse]:
        """Tạo thông tin key pair (client-side generation)"""
        if algorithm not in ["X25519", "Kyber-1024", "Ed25519", "Dilithium3", "Dilithium5"]:
            return None
        
        # Thông tin cho client-side generation
        key_sizes = {
            "X25519": 256,
            "Kyber-1024": 1024,
            "Ed25519": 256,
            "Dilithium3": 1952,
            "Dilithium5": 2592
        }
        
        return KeyPairResponse(
            public_key="",  # Client sẽ generate
            private_key="",  # Client sẽ generate
            algorithm=algorithm,
            key_size=key_sizes.get(algorithm, 256)
        )
    
    def get_algorithm_parameters(self, algorithm: str) -> Dict[str, Any]:
        """Lấy tham số mặc định cho thuật toán"""
        params = {
            "AES-256-GCM": {
                "key_size": 32,
                "nonce_size": 12,
                "tag_size": 16
            },
            "XChaCha20-Poly1305": {
                "key_size": 32,
                "nonce_size": 24,
                "tag_size": 16
            },
            "Camellia-CTR-HMAC": {
                "key_size": 32,
                "nonce_size": 16,
                "hmac_algorithm": "SHA256"
            },
            "Argon2id": {
                "memory_cost": 65536,
                "time_cost": 3,
                "parallelism": 1,
                "salt_size": 16
            },
            "X25519": {
                "key_size": 32
            },
            "Kyber-1024": {
                "key_size": 32,
                "ciphertext_size": 1088
            },
            "Ed25519": {
                "key_size": 32,
                "signature_size": 64
            },
            "Dilithium3": {
                "key_size": 1952,
                "signature_size": 3293
            },
            "Dilithium5": {
                "key_size": 2592,
                "signature_size": 4595
            }
        }
        
        return params.get(algorithm, {})
    
    def validate_encryption_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate request encryption từ client"""
        errors = []
        
        # Validate encryption algorithm
        if "encryption_algorithm" not in request_data:
            errors.append("encryption_algorithm is required")
        elif not self.validate_algorithm(request_data["encryption_algorithm"], "symmetric"):
            errors.append(f"Invalid symmetric encryption algorithm: {request_data['encryption_algorithm']}")
        
        # Validate key derivation function
        if "key_derivation_function" not in request_data:
            errors.append("key_derivation_function is required")
        elif not self.validate_algorithm(request_data["key_derivation_function"], "kdf"):
            errors.append(f"Invalid KDF algorithm: {request_data['key_derivation_function']}")
        
        # Validate key wrap if used
        if request_data.get("use_key_wrap", False):
            if "key_wrap_algorithm" not in request_data:
                errors.append("key_wrap_algorithm is required when use_key_wrap=True")
            elif not self.validate_algorithm(request_data["key_wrap_algorithm"], "asymmetric"):
                errors.append(f"Invalid key wrap algorithm: {request_data['key_wrap_algorithm']}")
        
        # Validate signature if used
        if "signature_algorithm" in request_data and request_data["signature_algorithm"]:
            if not self.validate_algorithm(request_data["signature_algorithm"], "signature"):
                errors.append(f"Invalid signature algorithm: {request_data['signature_algorithm']}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }
    
    def get_zero_knowledge_metadata(self, operation: str, user_id: str, **kwargs) -> Dict[str, Any]:
        """Tạo metadata cho zero-knowledge operation"""
        return {
            "operation": operation,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "zero_knowledge": True,
            "client_side_encryption": True,
            "no_plaintext_storage": True,
            **kwargs
        }


# Singleton instance
crypto_service = CryptoService() 