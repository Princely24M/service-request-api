const { Router } = require('express');
const controller = require('../controllers/requestsController');
const ApiError = require('../utils/ApiError');

const router = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Runs for every route that has an :id segment.
router.param('id', (req, res, next, id) => {
  if (!UUID_PATTERN.test(id)) {
    return next(
      ApiError.badRequest('The request id in the URL is not valid.', [{ field: 'id', message: 'Expected a UUID.' }])
    );
  }
  return next();
});

router.route('/').get(controller.listRequests).post(controller.createRequest);

router
  .route('/:id')
  .get(controller.getRequest)
  .put(controller.replaceRequest)
  .patch(controller.updateRequest)
  .delete(controller.deleteRequest);

module.exports = router;
