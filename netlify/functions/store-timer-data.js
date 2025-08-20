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

    // Store in global variable (short-term)
    global.timerDataStore[competitionId] = timerData;
    
    console.log(`Stored timer data for ${competitionId}:`, timerData);
    
    // Also store in a simple external service for persistence
    let externalStorageSuccess = false;
    try {
      // Use JSONBin.io free tier
      const response = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bin-Name': `timer-${competitionId}`,
          'X-Collection-Id': '66c4af08e41b4d34e416b2b7' // Free public collection
        },
        body: JSON.stringify(timerData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Stored to external service:', result.metadata?.id);
        externalStorageSuccess = true;
      }
    } catch (error) {
      console.warn('External storage failed:', error.message);
    }
    
    // Create shareable URL with embedded data
    const dataString = Buffer.from(JSON.stringify(timerData)).toString('base64');
    const shareableUrl = `https://${event.headers.host}/.netlify/functions/xml?competitionId=${competitionId}&data=${dataString}`;
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        data: timerData,
        storage: externalStorageSuccess ? 'global+external' : 'global',
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