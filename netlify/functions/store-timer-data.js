const fs = require('fs');
const path = require('path');

// Simple global store for cross-function sharing
global.timerDataStore = global.timerDataStore || {};

// File-based storage for persistence
const dataDir = path.join(__dirname, '../../.netlify-timer-data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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

    // Store in both global variable and file
    global.timerDataStore[competitionId] = timerData;
    
    // Also write to file for persistence
    const filePath = path.join(dataDir, `${competitionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(timerData, null, 2));
    
    console.log(`Stored timer data for ${competitionId}:`, timerData);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        data: timerData,
        storage: 'global+file',
        filePath: filePath,
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