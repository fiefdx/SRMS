/**
 * /api/menu — browsing and filtering is public, editing requires the admin role.
 * `/facets` is declared before `/:itemId`, otherwise it would be read as an id.
 */
import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createMenuItemSchema, listMenuQuerySchema, menuItemIdParamSchema, updateMenuItemSchema } from '../validation/menuSchemas.js';
import { addItem, browseMenu, editItem, facets, readItem, removeItem } from '../controllers/menuController.js';

const router = Router();

router.get('/', validate(listMenuQuerySchema, 'query'), asyncHandler(browseMenu));
router.get('/facets', asyncHandler(facets));
router.get('/:itemId', validate(menuItemIdParamSchema, 'params'), asyncHandler(readItem));

router.post('/', authenticate, requireAdmin, validate(createMenuItemSchema), asyncHandler(addItem));
router.patch(
  '/:itemId',
  authenticate,
  requireAdmin,
  validate(menuItemIdParamSchema, 'params'),
  validate(updateMenuItemSchema),
  asyncHandler(editItem),
);
router.delete(
  '/:itemId',
  authenticate,
  requireAdmin,
  validate(menuItemIdParamSchema, 'params'),
  asyncHandler(removeItem),
);

export default router;
