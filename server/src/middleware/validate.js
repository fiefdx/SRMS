/**
 * Validation middleware. A zod schema is chosen by the route (see src/validation/*.js) and the parsed,
 * coerced result is put on req.valid — Express 5 makes req.query a read-only getter, so validated
 * input is never written back onto the request object.
 *
 *   router.post('/menu', validate(createMenuItemSchema), controller.create)
 */
import ApiError from '../utils/ApiError.js';

export default function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(ApiError.unprocessable('Validation failed', details));
    }

    req.valid = { ...req.valid, [source]: result.data };
    return next();
  };
}
