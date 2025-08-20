// Debug endpoint to see stored timer data
global.timerDataStore = global.timerDataStore || {};

exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify({
      globalStore: global.timerDataStore,
      globalStoreKeys: Object.keys(global.timerDataStore),
      timestamp: new Date().toISOString(),
      path: event.path,
      method: event.httpMethod,
      platform: process.platform,
      nodeVersion: process.version
    }, null, 2)
  };
};