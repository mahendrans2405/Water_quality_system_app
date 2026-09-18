# SuperAdmin Company Management System - Implementation Guide

## Overview
The Water Quality Monitoring System now includes comprehensive SuperAdmin functionality for managing multiple companies, with role-based dashboards and seamless navigation.

## Features Implemented

### 1. **SuperAdmin Authentication**
- **Hardcoded SuperAdmin Account:**
  - Email: `superadmin`
  - Password: `12345678`
  - Auto-created on first backend startup via seed function
- **Quick Login Button:** "Quick Login as SuperAdmin" for easy demo access

### 2. **Company Management (SuperAdmin Only)**
- **Create Companies:** SuperAdmin can create unlimited companies with:
  - Company name and address
  - Owner credentials (name, email, password)
  - Manager limits (Manager1 and Manager2 quotas)
  
- **Company List:** View all created companies with details:
  - Company name
  - Address
  - Manager capacity
  - Owner information

- **Company Selection:** Dropdown selector to switch between companies

### 3. **Role-Based Navigation**
- **SuperAdmin Login:** Routes to Admin Panel (/(tabs)/admin)
- **Company User Login:** Routes directly to Dashboard (/(tabs)/dashboard)
- **Auto-Redirect:** Based on user role after authentication

### 4. **Dashboard Features**
- **For SuperAdmin:**
  - Company selector dropdown at the top
  - View selected company's water quality stats
  - "Back to Admin Panel" button for quick navigation
  - Shows: Latest pH, Turbidity, 24h Alerts

- **For Company Users:**
  - Direct access to company dashboard
  - Same stats display (scoped to their company)

### 5. **Admin Panel (SuperAdmin)**
- **Tools Section:**
  - "+ Create New Company" button → Opens modal with form
  - "Refresh Companies" button → Reloads company list
  
- **Company Listing:**
  - Total company count
  - Company cards with full details
  - Company selector for switching
  - Direct dashboard access for selected company

- **User Management:**
  - View all users across system (SuperAdmin) or company users (Company admin)
  - User details: Name, email, role, active status
  - Refresh button

- **Logout:** Secure logout with confirmation

## File Structure & Changes

### Backend Changes
- **src/utils/seed.js**
  - Added `ensureSuperAdminExists()` function
  - Auto-creates SuperAdmin user on startup
  - Passwords hashed securely

### Mobile App Changes

#### State Management
- **src/state/authStore.ts**
  - Added `companies` array
  - Added `selectedCompanyId` field
  - New methods: `setCompanies()`, `setSelectedCompanyId()`

#### Components
- **components/company-selector.tsx** (NEW)
  - Dropdown selector for company switching
  - Shows all available companies
  - Highlights selected company
  - Callable from any screen

- **components/create-company-form.tsx** (NEW)
  - Form for creating new companies
  - Validates all inputs
  - Creates company with owner credentials
  - Success/error alerts

#### Screens
- **app/login.tsx** (UPDATED)
  - Support for SuperAdmin hardcoded login
  - Quick login demo button
  - Auto-fetches companies for SuperAdmin
  - Role-based routing (SuperAdmin → admin, Others → dashboard)
  - Improved UI with demo section

- **app/modal.tsx** (UPDATED)
  - Replaced with Create Company Modal
  - Embedded CreateCompanyForm component

- **app/(tabs)/admin.tsx** (UPDATED)
  - Complete redesign for SuperAdmin
  - Company creation and management
  - User listing
  - Logout functionality
  - Beautiful card-based UI

- **app/(tabs)/dashboard.tsx** (UPDATED)
  - Company selector for SuperAdmin
  - Shows selected company name
  - Company stats display
  - Back to Admin button for SuperAdmin
  - Enhanced styling

## Usage Instructions

### For SuperAdmin

1. **Login:**
   - Email: `superadmin`
   - Password: `12345678`
   - Or click "Quick Login as SuperAdmin"

2. **Create Companies:**
   - Click "+ Create New Company" on Admin Panel
   - Fill in company details:
     - Company name
     - Company address (optional)
     - Owner name
     - Owner email
     - Owner password (min 8 chars)
     - Manager limits
   - Click "Create Company"

3. **Switch Between Companies:**
   - Use the company selector dropdown
   - Click "View Selected Company Dashboard" to see company stats
   - Or use "Back to Admin Panel" to return to admin

4. **View Users:**
   - Admin Panel shows all users across system
   - Manage user access and information

### For Company Users

1. **Login with Company Credentials:**
   - Use the credentials created by SuperAdmin
   - Auto-routes to company dashboard

2. **View Dashboard:**
   - See company's water quality data
   - Latest pH and turbidity readings
   - 24-hour alert summary

3. **Manage Company:**
   - Navigate to Admin tab for company-level management
   - Create additional users within company
   - View company users

## API Endpoints Used

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/auth/login` | POST | User authentication | None |
| `/api/auth/register` | POST | New user registration | Optional |
| `/api/companies` | GET | List all companies | SuperAdmin |
| `/api/companies` | POST | Create new company | SuperAdmin |
| `/api/users` | GET | List users | Authenticated |
| `/api/users` | POST | Create new user | SuperAdmin/Company |
| `/api/water/stats` | GET | Get water quality stats | Authenticated |

## Backend SuperAdmin Seeding

The backend now automatically creates a SuperAdmin user when:
1. Server starts and connects to MongoDB
2. Roles are successfully seeded
3. No existing SuperAdmin account found

**Credentials:**
- Email: `superadmin`
- Password: `12345678`

If the SuperAdmin user already exists, the seeding skips creation.

## State Flow Diagram

```
Login Screen
    ↓
    ├─ SuperAdmin Login
    │  ├─ Fetch companies list
    │  └─ Route to Admin Panel
    │
    └─ Company User Login
       └─ Route to Dashboard (pre-select their company)

Admin Panel (SuperAdmin)
    ├─ Create Companies
    ├─ Select Company
    ├─ View Company Users
    └─ Manage Credentials

Dashboard
    ├─ SuperAdmin with Company Selected
    │  ├─ Company Selector
    │  ├─ View Company Stats
    │  └─ Back to Admin
    │
    └─ Company User
       └─ View Own Company Stats
```

## Security Notes

1. **Password Security:**
   - All passwords hashed with bcrypt
   - SuperAdmin password is demo-only (change in production)
   - Passwords enforced min 8 characters

2. **Token Management:**
   - JWT tokens auto-refresh
   - Tokens cleared on logout
   - CORS configured for API access

3. **Role-Based Access:**
   - SuperAdmin: All companies and users
   - Company Admin: Their company data only
   - Managers/Users: Read-only their company data

4. **Demo Access:**
   - Demo credentials visible for testing
   - Should be hidden/removed in production
   - Change SuperAdmin password in production

## Next Steps for Production

1. Remove/hide demo credentials
2. Implement proper SuperAdmin creation/change password
3. Add company admin credentials reset functionality
4. Add audit logging for company creation
5. Implement rate limiting on company creation
6. Add company deletion/archiving features
7. Add company user management UI
8. Implement permission levels for Managers

## Testing Checklist

- [x] SuperAdmin login with hardcoded credentials
- [x] Create company with owner credentials
- [x] View list of all companies
- [x] Switch between companies
- [x] View company-specific dashboard
- [x] Company user login
- [x] Company dashboard auto-display
- [x] Logout functionality
- [x] Navigation between Admin and Dashboard
- [x] Error handling and validation
- [x] Responsive UI on mobile

## Troubleshooting

**SuperAdmin not appearing:**
- Restart backend: `npm run dev`
- Check MongoDB connection
- Verify seed function logs

**Companies not loading:**
- Check API endpoint `/api/companies`
- Verify SuperAdmin token
- Check network in browser DevTools

**Can't create company:**
- Validate all required fields
- Check password length (min 8)
- Verify email format
- Check MongoDB quota

**Navigation issues:**
- Clear app cache: `npx expo start --clear`
- Restart Expo server
- Check authStore state in Redux DevTools
