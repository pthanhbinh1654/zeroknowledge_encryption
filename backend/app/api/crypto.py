"""
Crypto API Endpoints
===================
API endpoints cho crypto operations theo Zero-Knowledge principles.
Chỉ cung cấp thông tin và validation, không thực hiện mã hóa/giải mã.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List
import logging

from app.core.security import get_current_user
from app.models.user import UserInDB
from app.models.encrypted_file import (
    CryptoAlgorithmInfo,
    KeyPairResponse
)
from app.services.crypto_service import crypto_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/algorithms")
async def get_supported_algorithms():
    """
    Lấy danh sách thuật toán được hỗ trợ
    
    Returns:
        Dict với các loại thuật toán: symmetric, asymmetric, signature, kdf
    """
    try:
        algorithms = crypto_service.get_supported_algorithms()
        recommended = crypto_service.get_recommended_algorithms()
        
        return {
            "success": True,
            "data": {
                "algorithms": algorithms,
                "recommended": recommended,
                "zero_knowledge": True,
                "client_side_encryption": True
            }
        }
    except Exception as e:
        logger.error(f"Error getting algorithms: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get supported algorithms"
        )


@router.get("/algorithms/{algorithm_name}")
async def get_algorithm_info(algorithm_name: str):
    """
    Lấy thông tin chi tiết của thuật toán
    
    Args:
        algorithm_name: Tên thuật toán
        
    Returns:
        Thông tin chi tiết thuật toán
    """
    try:
        algorithm_info = crypto_service.get_algorithm_info(algorithm_name)
        if not algorithm_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Algorithm '{algorithm_name}' not found"
            )
        
        parameters = crypto_service.get_algorithm_parameters(algorithm_name)
        
        return {
            "success": True,
            "data": {
                "algorithm": algorithm_info,
                "parameters": parameters,
                "zero_knowledge": True
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting algorithm info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get algorithm information"
        )


@router.get("/generate-keypair/{algorithm}")
async def get_keypair_info(
    algorithm: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Lấy thông tin để generate key pair (client-side)
    
    Args:
        algorithm: Thuật toán (X25519, Kyber-1024, Ed25519, Dilithium3, Dilithium5)
        
    Returns:
        Thông tin key pair để client generate
    """
    try:
        keypair_info = crypto_service.generate_key_pair_info(algorithm)
        if not keypair_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Algorithm '{algorithm}' does not support key pair generation"
            )
        
        return {
            "success": True,
            "data": {
                "keypair_info": keypair_info,
                "instructions": "Generate key pair on client side using the provided parameters",
                "zero_knowledge": True,
                "client_side_generation": True
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting keypair info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get keypair information"
        )


@router.post("/validate-request")
async def validate_encryption_request(
    request_data: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Validate encryption request từ client
    
    Args:
        request_data: Dữ liệu request encryption
        
    Returns:
        Kết quả validation
    """
    try:
        validation_result = crypto_service.validate_encryption_request(request_data)
        
        return {
            "success": validation_result["valid"],
            "data": {
                "valid": validation_result["valid"],
                "errors": validation_result["errors"],
                "zero_knowledge": True
            }
        }
    except Exception as e:
        logger.error(f"Error validating encryption request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate encryption request"
        )


@router.get("/recommendations")
async def get_algorithm_recommendations():
    """
    Lấy khuyến nghị thuật toán theo use case
    
    Returns:
        Khuyến nghị thuật toán cho các trường hợp sử dụng
    """
    try:
        recommended = crypto_service.get_recommended_algorithms()
        
        recommendations = {
            "general_encryption": {
                "symmetric": "AES-256-GCM",
                "kdf": "Argon2id",
                "description": "Mã hóa file thông thường với bảo mật cao"
            },
            "quantum_resistant": {
                "symmetric": "AES-256-GCM",
                "asymmetric": "Kyber-1024",
                "signature": "Dilithium3",
                "kdf": "Argon2id",
                "description": "Bảo vệ khỏi tấn công lượng tử"
            },
            "high_performance": {
                "symmetric": "XChaCha20-Poly1305",
                "kdf": "Argon2id",
                "description": "Hiệu suất cao cho file lớn"
            },
            "maximum_security": {
                "symmetric": "AES-256-GCM",
                "asymmetric": "Kyber-1024",
                "signature": "Dilithium5",
                "kdf": "Argon2id",
                "description": "Bảo mật tối đa cho dữ liệu nhạy cảm"
            }
        }
        
        return {
            "success": True,
            "data": {
                "recommendations": recommendations,
                "recommended_algorithms": recommended,
                "zero_knowledge": True
            }
        }
    except Exception as e:
        logger.error(f"Error getting recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get algorithm recommendations"
        )


@router.get("/zero-knowledge-principles")
async def get_zero_knowledge_principles():
    """
    Lấy thông tin về Zero-Knowledge principles
    
    Returns:
        Thông tin về nguyên tắc Zero-Knowledge
    """
    principles = {
        "client_side_encryption": {
            "description": "Tất cả mã hóa/giải mã thực hiện tại client",
            "benefits": [
                "Server không bao giờ thấy plaintext",
                "Server không lưu trữ key/password",
                "Bảo mật end-to-end"
            ]
        },
        "no_plaintext_storage": {
            "description": "Server chỉ lưu trữ ciphertext",
            "benefits": [
                "Không thể truy cập dữ liệu gốc",
                "Tuân thủ quy định bảo mật",
                "Giảm rủi ro rò rỉ dữ liệu"
            ]
        },
        "key_management": {
            "description": "Client quản lý toàn bộ key",
            "benefits": [
                "Kiểm soát hoàn toàn key",
                "Không phụ thuộc server",
                "Có thể sử dụng offline"
            ]
        },
        "algorithm_validation": {
            "description": "Server validate thuật toán client sử dụng",
            "benefits": [
                "Đảm bảo thuật toán an toàn",
                "Ngăn chặn thuật toán yếu",
                "Cập nhật thuật toán mới"
            ]
        }
    }
    
    return {
        "success": True,
        "data": {
            "principles": principles,
            "implementation": "Zero-Knowledge File Encryption System",
            "version": "1.0.0"
        }
    } 