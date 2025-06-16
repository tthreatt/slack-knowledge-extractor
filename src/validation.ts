import { body, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validation middleware
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Extract endpoint validation
export const extractValidation = [
  body('channelIds')
    .isArray()
    .withMessage('channelIds must be an array')
    .notEmpty()
    .withMessage('At least one channel must be selected'),
  body('channelIds.*')
    .isString()
    .withMessage('Each channel ID must be a string')
    .matches(/^[C|G][A-Z0-9]{8,}$/)
    .withMessage('Invalid channel ID format'),
  body('daysBack')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('daysBack must be between 1 and 90'),
  validate
];

// Search endpoint validation
export const searchValidation = [
  query('q')
    .isString()
    .withMessage('Search query must be a string')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  query('category')
    .optional()
    .isIn(['decisions', 'discussions', 'resources', 'processes', 'announcements'])
    .withMessage('Invalid category'),
  validate
]; 