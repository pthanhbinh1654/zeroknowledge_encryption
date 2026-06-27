# 🔐 Secure File System - Frontend

Giao diện người dùng hiện đại cho hệ thống mã hóa file Zero-Knowledge với bảo mật cao.

## 🚀 Tính năng chính

### 🔐 Bảo mật & Xác thực
- **Đăng nhập/Đăng ký** với JWT authentication
- **2FA (TOTP)** hỗ trợ Google Authenticator, Authy
- **Protected routes** với automatic token refresh
- **Session management** an toàn

### 📁 Quản lý File
- **Drag & Drop upload** với multiple files
- **Mã hóa real-time** với các thuật toán: AES-256, XChaCha20, Serpent
- **Progress tracking** cho upload và mã hóa
- **File validation** và error handling
- **Batch operations** (upload/delete nhiều file)

### 💎 Giao diện
- **Modern UI** với Tailwind CSS
- **Dark mode** support
- **Responsive design** cho mobile/tablet
- **Accessibility** WCAG 2.1 compliant
- **Smooth animations** và transitions

### 📊 Dashboard & Analytics
- **Overview cards** với thống kê real-time
- **Recent activity** và notifications
- **System health** monitoring
- **File usage analytics**

## 🛠 Công nghệ sử dụng

### Core Technologies
- **React 19** - UI Library
- **TypeScript** - Type safety
- **Vite** - Build tool nhanh

### State Management & API
- **React Query (TanStack)** - Server state management
- **React Context** - Client state
- **Axios** - HTTP client với interceptors

### UI & Styling
- **Tailwind CSS** - Utility-first CSS
- **HeadlessUI** - Accessible components
- **Heroicons** - Beautiful icons
- **React Hot Toast** - Notifications

### Forms & Validation
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **Password strength** validation

### Routing & Navigation
- **React Router v6** - Client-side routing
- **Protected routes** với authentication
- **Breadcrumb navigation**

### File Handling
- **React Dropzone** - Drag & drop upload
- **File Saver** - Download management
- **Progress tracking** - Upload/download progress

## 📦 Cài đặt và Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd frontend
```

### 2. Cài đặt Dependencies
```bash
npm install
```

### 3. Cấu hình Environment
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

Cấu hình các biến môi trường:
```env
# API Base URL
VITE_API_URL=http://localhost:8000

# App Information
VITE_APP_NAME=SecureFileSystem
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_DEV_TOOLS=true
VITE_ENABLE_LOGGING=true

# Upload Limits
VITE_MAX_FILE_SIZE=100000000
VITE_ALLOWED_FILE_TYPES=*
```

### 4. Chạy Development Server
```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173`

## 🏗 Cấu trúc dự án

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable components
│   │   ├── Auth/          # Authentication components
│   │   ├── Layout/        # Layout components (Header, Sidebar)
│   │   └── UI/            # Base UI components
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities and configurations
│   │   └── api.ts         # Axios client setup
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx
│   │   ├── EncryptPage.tsx
│   │   └── FilesPage.tsx
│   ├── services/          # API services
│   │   ├── auth.service.ts
│   │   ├── file.service.ts
│   │   └── dashboard.service.ts
│   ├── types/             # TypeScript types
│   │   └── api.ts
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── tailwind.config.js     # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite configuration
```

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # TypeScript type checking

# Testing
npm run test            # Run tests
npm run test:coverage   # Test with coverage
```

## 🎨 UI Components

### Layout Components
- **MainLayout**: Layout chính với sidebar và header
- **Sidebar**: Navigation sidebar với collapsible
- **Header**: Top header với breadcrumbs và user menu

### Authentication Components
- **LoginForm**: Form đăng nhập với 2FA support
- **RegisterForm**: Form đăng ký với validation
- **ProtectedRoute**: Route protection wrapper

### UI Components
- **Modal**: Reusable modal dialog
- **LoadingSpinner**: Loading indicators
- **Toast Notifications**: Success/error messages

## 🔐 Authentication Flow

### 1. Login Process
```
User Input → Validation → API Call → JWT Storage → Redirect
```

### 2. Token Management
- **Access Token**: Short-lived (15 minutes)
- **Refresh Token**: Long-lived (7 days)
- **Auto-refresh**: Background token renewal
- **Multi-tab sync**: Logout across tabs

### 3. Protected Routes
```typescript
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

## 📁 File Management Flow

### 1. Upload & Encryption
```
File Selection → Validation → Encryption Config → Upload → Progress → Success
```

### 2. File Operations
- **List**: Paginated file listing với search/filter
- **Decrypt**: Password input → API call → Download
- **Delete**: Confirmation → API call → Refresh list
- **Rename**: Inline editing → API call → Update

## 🎯 Performance Optimizations

### Code Splitting
- **Route-based splitting**: Lazy load pages
- **Component splitting**: Dynamic imports
- **Bundle optimization**: Tree shaking

### Caching
- **React Query**: Server state caching
- **Browser caching**: Static assets
- **Service Worker**: Offline support (future)

### UI Performance
- **Virtualization**: Large file lists
- **Debounced search**: Reduce API calls
- **Optimistic updates**: Immediate UI feedback

## 🌙 Dark Mode

Dark mode được implement với Tailwind CSS:

```typescript
// Toggle dark mode
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark');
};
```

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Adaptive Features
- **Collapsible sidebar** trên mobile
- **Touch-friendly** interactions
- **Responsive tables** với horizontal scroll

## 🔍 Debugging & Development

### Development Tools
- **React DevTools**: Component inspection
- **React Query DevTools**: State debugging
- **Network tab**: API call monitoring

### Logging
```typescript
// API requests/responses được log
console.log('🚀 API Request:', config);
console.log('✅ API Response:', response);
console.error('❌ API Error:', error);
```

## 🚀 Deployment

### Build Production
```bash
npm run build
```

### Environment Setup
- **Staging**: Test environment
- **Production**: Live environment

### Performance Monitoring
- **Bundle analyzer**: Webpack bundle analysis
- **Lighthouse**: Performance auditing
- **Error tracking**: Sentry integration (future)

## 🤝 Contributing

### Code Standards
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type safety
- **Conventional Commits**: Commit messages

### Pull Request Process
1. Fork repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit PR

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

Nếu bạn gặp vấn đề:
1. Check console logs
2. Verify API connectivity
3. Check environment variables
4. Review documentation
5. Create issue on GitHub

---

Made with ❤️ by SecureFS Team
