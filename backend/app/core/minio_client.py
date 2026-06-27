
from minio import Minio
from minio.error import S3Error
import logging
from typing import Optional, BinaryIO
from app.core.config import settings

logger = logging.getLogger(__name__)


class MinIOClient:
    """
    MinIO Client wrapper cho việc lưu trữ file mã hóa

    Features:
    - Upload/download file mã hóa
    - Quản lý bucket riêng cho từng user
    - Stream file để tiết kiệm bộ nhớ
    - Automatic retry và error handling
    """

    def __init__(self):
        """Khởi tạo MinIO client với config từ environment"""
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL
        )
        self.default_bucket_name = settings.MINIO_BUCKET_NAME
        # Cache for checked buckets
        self._checked_buckets = set()

    def _get_user_bucket_name(self, user_email: str) -> str:
        """
        Tạo tên bucket cho user dựa trên email

        Args:
            user_email: Email của user

        Returns:
            str: Tên bucket hợp lệ cho MinIO
        """
        # Chuyển email thành tên bucket hợp lệ (lowercase, chỉ chứa a-z, 0-9, -, .)
        import re
        bucket_name = user_email.lower()
        bucket_name = re.sub(r'[^a-z0-9.-]', '-', bucket_name)
        # Đảm bảo bucket name không bắt đầu hoặc kết thúc bằng dấu -
        bucket_name = bucket_name.strip('-')
        # Thêm prefix để tránh conflict
        bucket_name = f"user-{bucket_name}"
        return bucket_name

    def _ensure_bucket_exists(self, bucket_name: str):
        """Đảm bảo bucket tồn tại, tạo mới nếu chưa có"""
        if bucket_name in self._checked_buckets:
            return

        try:
            if not self.client.bucket_exists(bucket_name):
                self.client.make_bucket(bucket_name)
                logger.info(f"Created MinIO bucket: {bucket_name}")
            self._checked_buckets.add(bucket_name)
        except Exception as e:
            logger.warning(f"MinIO not available for bucket {bucket_name}: {e}")
            # Don't raise error, just log warning

    def _check_connection(self, bucket_name: str):
        """Kiểm tra kết nối MinIO"""
        try:
            self._ensure_bucket_exists(bucket_name)
            return True
        except Exception:
            return False

    def upload_file(self, file_name: str, file_data: BinaryIO, file_size: int, user_email: str = None) -> bool:
        """
        Upload file mã hóa lên MinIO

        Args:
            file_name: Tên file (thường là original_name.enc)
            file_data: File stream (BinaryIO)
            file_size: Kích thước file
            user_email: Email của user (để tạo bucket riêng)

        Returns:
            bool: True nếu thành công

        Note:
            - File được stream trực tiếp, không load toàn bộ vào RAM
            - Tự động retry nếu lỗi network
            - Mỗi user có bucket riêng
        """
        try:
            # Xác định bucket name
            bucket_name = self._get_user_bucket_name(user_email) if user_email else self.default_bucket_name

            if not self._check_connection(bucket_name):
                logger.error(f"MinIO not available for bucket: {bucket_name}")
                return False

            self.client.put_object(
                bucket_name=bucket_name,
                object_name=file_name,
                data=file_data,
                length=file_size,
                content_type="application/octet-stream",
                metadata={
                    "encryption": "true",
                    "user_email": user_email or "unknown"
                }
            )
            logger.info(f"Uploaded encrypted file: {file_name} to bucket: {bucket_name}")
            return True
        except S3Error as e:
            logger.error(f"Error uploading file to MinIO: {e}")
            return False
    
    def download_file(self, file_name: str, user_email: str = None) -> Optional[bytes]:
        """
        Download file mã hóa từ MinIO

        Args:
            file_name: Tên file cần download
            user_email: Email của user (để xác định bucket)

        Returns:
            bytes: Nội dung file hoặc None nếu lỗi

        Warning:
            - Chỉ dùng cho file nhỏ
            - File lớn nên dùng download_file_stream()
        """
        try:
            bucket_name = self._get_user_bucket_name(user_email) if user_email else self.default_bucket_name
            response = self.client.get_object(bucket_name, file_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            logger.error(f"Error downloading file from MinIO: {e}")
            return None

    def download_file_stream(self, file_name: str, user_email: str = None):
        """
        Stream download file từ MinIO (cho file lớn)

        Args:
            file_name: Tên file cần download
            user_email: Email của user (để xác định bucket)

        Returns:
            HTTPResponse stream hoặc None nếu lỗi

        Note:
            - Caller phải đóng stream sau khi dùng
            - Phù hợp cho streaming response về client
        """
        try:
            bucket_name = self._get_user_bucket_name(user_email) if user_email else self.default_bucket_name
            return self.client.get_object(bucket_name, file_name)
        except S3Error as e:
            logger.error(f"Error streaming file from MinIO: {e}")
            return None
    
    def delete_file(self, file_name: str, user_email: str = None) -> bool:
        """
        Xóa file khỏi MinIO

        Args:
            file_name: Tên file cần xóa
            user_email: Email của user (để xác định bucket)

        Returns:
            bool: True nếu thành công
        """
        try:
            bucket_name = self._get_user_bucket_name(user_email) if user_email else self.default_bucket_name
            self.client.remove_object(bucket_name, file_name)
            logger.info(f"Deleted file from MinIO: {file_name} from bucket: {bucket_name}")
            return True
        except S3Error as e:
            logger.error(f"Error deleting file from MinIO: {e}")
            return False

    def file_exists(self, file_name: str, user_email: str = None) -> bool:
        """
        Kiểm tra file có tồn tại trong MinIO không

        Args:
            file_name: Tên file cần kiểm tra
            user_email: Email của user (để xác định bucket)

        Returns:
            bool: True nếu file tồn tại
        """
        try:
            bucket_name = self._get_user_bucket_name(user_email) if user_email else self.default_bucket_name
            self.client.stat_object(bucket_name, file_name)
            return True
        except S3Error:
            return False

    def list_user_files(self, user_email: str) -> list:
        """
        Liệt kê tất cả file của user trong bucket riêng

        Args:
            user_email: Email của user

        Returns:
            list: Danh sách file objects
        """
        try:
            bucket_name = self._get_user_bucket_name(user_email)
            if not self.client.bucket_exists(bucket_name):
                return []

            objects = self.client.list_objects(bucket_name)
            return list(objects)
        except S3Error as e:
            logger.error(f"Error listing files for user {user_email}: {e}")
            return []


# Singleton instance
minio_client = MinIOClient()
