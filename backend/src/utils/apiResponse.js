function success(res, { data = null, message = 'OK', meta = null, statusCode = 200 } = {}) {
  return res.status(statusCode).json({ success: true, message, data, meta });
}

function failure(res, { message = 'Something went wrong', statusCode = 400, errors = null } = {}) {
  return res.status(statusCode).json({ success: false, message, errors });
}

module.exports = { success, failure };
