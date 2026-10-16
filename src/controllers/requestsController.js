const store = require('../data/store');
const ApiError = require('../utils/ApiError');
const { validateRequestBody, CATEGORIES, STATUSES } = require('../utils/validate');

function failIfInvalid(errors) {
  if (errors.length > 0) {
    throw ApiError.badRequest('Some fields need attention.', errors);
  }
}

function getOr404(id) {
  const record = store.findById(id);
  if (!record) throw ApiError.notFound(`No service request found with id ${id}.`);
  return record;
}

/** GET /api/requests  (optional ?status=&category=&q=) */
function listRequests(req, res) {
  const { status, category, q } = req.query;
  const errors = [];

  if (status !== undefined && !STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${STATUSES.join(', ')}.` });
  }
  if (category !== undefined && !CATEGORIES.includes(category)) {
    errors.push({ field: 'category', message: `Category must be one of: ${CATEGORIES.join(', ')}.` });
  }
  failIfInvalid(errors);

  let results = store.findAll();
  if (status) results = results.filter((item) => item.status === status);
  if (category) results = results.filter((item) => item.category === category);
  if (typeof q === 'string' && q.trim()) {
    const term = q.trim().toLowerCase();
    results = results.filter((item) => `${item.subject} ${item.description}`.toLowerCase().includes(term));
  }

  res.status(200).json({ data: results, count: results.length });
}

/** GET /api/requests/:id */
function getRequest(req, res) {
  res.status(200).json({ data: getOr404(req.params.id) });
}

/** POST /api/requests */
function createRequest(req, res) {
  const { errors, value } = validateRequestBody(req.body, 'create');
  failIfInvalid(errors);

  const created = store.create(value);
  res.status(201).location(`${req.baseUrl}/${created.id}`).json({ data: created });
}

/** PUT /api/requests/:id  (replace every editable field) */
function replaceRequest(req, res) {
  getOr404(req.params.id);
  const { errors, value } = validateRequestBody(req.body, 'replace');
  failIfInvalid(errors);

  res.status(200).json({ data: store.update(req.params.id, value) });
}

/** PATCH /api/requests/:id  (change only the fields that were sent) */
function updateRequest(req, res) {
  getOr404(req.params.id);
  const { errors, value } = validateRequestBody(req.body, 'patch');
  failIfInvalid(errors);

  res.status(200).json({ data: store.update(req.params.id, value) });
}

/** DELETE /api/requests/:id */
function deleteRequest(req, res) {
  getOr404(req.params.id);
  store.remove(req.params.id);
  res.status(204).end();
}

module.exports = { listRequests, getRequest, createRequest, replaceRequest, updateRequest, deleteRequest };
