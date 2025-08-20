// Simple global store for cross-function sharing
global.timerDataStore = global.timerDataStore || {};

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

    // Store in global variable (works for short-term sharing on Netlify)
    global.timerDataStore[competitionId] = timerData;
    
    console.log(`Stored timer data for ${competitionId}:`, timerData);
    
    // Also create a shareable URL with embedded data
    const dataString = Buffer.from(JSON.stringify(timerData)).toString('base64');
    const shareableUrl = `https://${event.headers.host}/${competitionId}/xml?data=${dataString}`;
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        data: timerData,
        storage: 'global',
        shareableUrl: shareableUrl,
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