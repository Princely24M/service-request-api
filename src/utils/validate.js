const CATEGORIES = ['opportunity', 'application', 'portal', 'other'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEXT_RULES = {
  name: { label: 'Name', min: 2, max: 80 },
  subject: { label: 'Subject', min: 3, max: 120 },
  description: { label: 'Description', min: 10, max: 2000 },
};

/** Check one field. Returns an error message, or null when the value is fine. */
function checkField(field, value) {
  switch (field) {
    case 'name':
    case 'subject':
    case 'description': {
      const { label, min, max } = TEXT_RULES[field];
      if (typeof value !== 'string' || value.trim() === '') return `${label} is required.`;
      const length = value.trim().length;
      if (length < min) return `${label} must be at least ${min} characters.`;
      if (length > max) return `${label} must be ${max} characters or fewer.`;
      return null;
    }
    case 'email': {
      if (typeof value !== 'string' || value.trim() === '') return 'Email is required.';
      if (value.trim().length > 120 || !EMAIL_PATTERN.test(value.trim())) {
        return 'Enter a valid email address, like name@example.com.';
      }
      return null;
    }
    case 'category':
      return CATEGORIES.includes(value) ? null : `Category must be one of: ${CATEGORIES.join(', ')}.`;
    case 'status':
      return STATUSES.includes(value) ? null : `Status must be one of: ${STATUSES.join(', ')}.`;
    default:
      return null;
  }
}

const FIELDS = ['name', 'email', 'category', 'subject', 'description', 'status'];
const REQUIRED = ['name', 'email', 'category', 'subject', 'description'];

const clean = (value) => (typeof value === 'string' ? value.trim() : value);

/**
 * Validate a request body.
 *
 * "create" (POST) and "replace" (PUT): name, email, category, subject and
 *   description are required; status is optional and defaults to "open".
 * "patch" (PATCH): any subset of fields, but at least one.
 *
 * Returns { errors: [{ field, message }], value: { ...cleaned fields } }.
 * Unknown fields are ignored so clients cannot set id or timestamps.
 */
function validateRequestBody(body, mode) {
  const errors = [];
  const value = {};

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: [{ field: 'body', message: 'Request body must be a JSON object.' }], value };
  }

  const check = (field) => {
    const message = checkField(field, body[field]);
    if (message) errors.push({ field, message });
    else value[field] = clean(body[field]);
  };

  if (mode === 'patch') {
    const supplied = FIELDS.filter((field) => body[field] !== undefined);
    if (supplied.length === 0) {
      errors.push({ field: 'body', message: `Send at least one of: ${FIELDS.join(', ')}.` });
    }
    supplied.forEach(check);
    return { errors, value };
  }

  REQUIRED.forEach(check);
  if (body.status !== undefined) check('status');
  else if (mode === 'replace') value.status = 'open';

  return { errors, value };
}

module.exports = { validateRequestBody, CATEGORIES, STATUSES };
