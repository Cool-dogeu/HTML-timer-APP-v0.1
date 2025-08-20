exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { competitionId, time, running } = JSON.parse(event.body);
    
    if (!competitionId || time === undefined || running === undefined) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing required fields: competitionId, time, running' })
      };
    }

    const timerData = {
      competitionId,
      time,
      running,
      timestamp: new Date().toISOString()
    };

    console.log(`Storing timer data for ${competitionId}:`, timerData);

    // Store in Upstash Redis
    let redisSuccess = false;
    try {
      const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
      const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
      
      if (REDIS_URL && REDIS_TOKEN) {
        // Use simple SET command with proper format
        const response = await fetch(`${REDIS_URL}/set/timer:${competitionId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REDIS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify(timerData))
        });
        
        if (response.ok) {
          console.log(`Stored to Redis: timer:${competitionId}`);
          redisSuccess = true;
        } else {
          console.warn('Redis store failed:', response.status, await response.text());
        }
      } else {
        console.warn('Redis credentials not configured');
      }
    } catch (error) {
      console.warn('Redis storage error:', error.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        data: timerData,
        storage: redisSuccess ? 'redis' : 'none',
        debug: `Stored: ${JSON.stringify(timerData)}`
      })
    };

  } catch (error) {
    console.error('Store timer data error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Internal server error: ' + error.message })
    };
  }
};