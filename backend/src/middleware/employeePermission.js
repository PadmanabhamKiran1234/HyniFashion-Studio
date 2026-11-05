const EMPLOYEE_PERMISSIONS = [
  'dashboard.view',
  'products.view',
  'products.manage',
  'inventory.view',
  'inventory.manage',
  'orders.view',
  'orders.manage',
  'customers.view',
  'offlineSales.view',
'offlineSales.manage'
];

// Check whether an employee has the requested permission.
export const authorizeEmployeePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (req.user.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Employee access only.'
      });
    }

    if (req.user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your employee account is not active.'
      });
    }

    const userPermissions = req.user.permissions || [];

    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
        requiredPermissions
      });
    }

    next();
  };
};

// Allow admins automatically, but check the permission for employees.
export const authorizeAdminOrEmployee = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this resource.'
      });
    }

    if (req.user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your employee account is not active.'
      });
    }

    const userPermissions = req.user.permissions || [];

    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
        requiredPermissions
      });
    }

    next();
  };
};

export { EMPLOYEE_PERMISSIONS };