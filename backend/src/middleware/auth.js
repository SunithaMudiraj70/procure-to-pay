import pool from '../config/pg.js';
import { AppError } from '../utils/errors.js';

export const authenticate = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] || req.header('X-User-Id');
    if (!userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing X-User-Id header');
    }

    const query = `
      SELECT requester_id, full_name, email, role, approval_level, department_id, is_active
      FROM requesters
      WHERE requester_id = $1;
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      throw new AppError(401, 'UNAUTHORIZED', `User '${userId}' not found or is inactive`);
    }

    const row = result.rows[0];
    req.user = {
      id: row.requester_id,
      name: row.full_name,
      email: row.email,
      role: row.role,
      approvalLevel: row.approval_level,
      departmentId: row.department_id
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] || req.header('X-User-Id');
    if (!userId) {
      req.user = null;
      return next();
    }

    const query = `
      SELECT requester_id, full_name, email, role, approval_level, department_id, is_active
      FROM requesters
      WHERE requester_id = $1;
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      throw new AppError(401, 'UNAUTHORIZED', `User '${userId}' not found or is inactive`);
    }

    const row = result.rows[0];
    req.user = {
      id: row.requester_id,
      name: row.full_name,
      email: row.email,
      role: row.role,
      approvalLevel: row.approval_level,
      departmentId: row.department_id
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    // System admin has access to everything
    if (req.user.role === 'system_admin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          `Role '${req.user.role}' is not authorized to perform this action. Required: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};

export default { authenticate, optionalAuth, requireRole };
