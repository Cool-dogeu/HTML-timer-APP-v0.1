// Debug endpoint to see stored timer data
exports.handler = async (event, context) => {
  let redisInfo = { error: 'Not configured' };
  
  try {
    const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
    const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (REDIS_URL && REDIS_TOKEN) {
      // Get all timer keys
      const keysResponse = await fetch(`${REDIS_URL}/scan/0/match/timer:*/count/100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${REDIS_TOKEN}`
        }
      });
      
      if (keysResponse.ok) {
        const keysResult = await keysResponse.json();
        redisInfo = {
          configured: true,
          keys: keysResult.result[1] || [],
          url: REDIS_URL.replace(/\/\/.*@/, '//***:***@') // Hide credentials
        };
        
        // Get data for each key
        if (keysResult.result[1] && keysResult.result[1].length > 0) {
          redisInfo.data = {};
          for (const key of keysResult.result[1]) {
            try {
              const dataResponse = await fetch(`${REDIS_URL}/get/${key}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${REDIS_TOKEN}`
                }
              });
              if (dataResponse.ok) {
                const data = await dataResponse.json();
                if (data.result) {
                  redisInfo.data[key] = JSON.parse(data.result);
                }
              }
            } catch (e) {
              redisInfo.data[key] = 'Error reading data';
            }
          }
        }
      }
    }
  } catch (error) {
    redisInfo = { error: error.message };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify({
      redis: redisInfo,
      timestamp: new Date().toISOString(),
      path: event.path,
      method: event.httpMethod,
      platform: process.platform,
      nodeVersion: process.version,
      environmentVars: {
        hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
      }
    }, null, 2)
  };
};