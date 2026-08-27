export async function errorHandler(error, request, reply) {
  request.log.error(error);

  if (reply.statusCode === 500) {
    return reply.code(500).send({
      error: 'Internal server error',
      requestId: request.id,
    });
  }

  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation error',
      details: error.validation.map(v => v.message),
    });
  }

  if (error.code === 'FST_ERR_BAD_STATUS_CODE') {
    return reply.code(500).send({ error: 'Invalid status code' });
  }

  return reply.send({
    error: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN',
  });
}

export function wrapHandler(handler) {
  return async (request, reply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      return errorHandler(error, request, reply);
    }
  };
}
