exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Debug endpoint reached',
      path: event.path,
      queryStringParameters: event.queryStringParameters,
      headers: event.headers,
      httpMethod: event.httpMethod,
      timestamp: new Date().toISOString()
    }, null, 2)
  };
};