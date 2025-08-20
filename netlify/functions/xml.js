// Access the same global store
global.timerDataStore = global.timerDataStore || {};

exports.handler = async (event, context) => {
  try {
    // Parse the path to extract competition ID
    const path = event.path;
    console.log(`XML Function - Received path: ${path}`);
    console.log(`XML Function - Query params:`, event.queryStringParameters);
    
    let competitionId = null;
    
    // Try multiple path formats
    const patterns = [
      /^\/api\/xml\/([a-zA-Z0-9]{6,})\/?$/,  // /api/xml/mytest
      /^\/([a-zA-Z0-9]{6,})\/xml\/?$/,       // /mytest/xml
      /^\/\.netlify\/functions\/xml$/         // direct function call
    ];
    
    for (const pattern of patterns) {
      const match = path.match(pattern);
      if (match && match[1]) {
        competitionId = match[1];
        break;
      }
    }
    
    // If no match from path, try query parameter
    if (!competitionId && event.queryStringParameters?.competitionId) {
      competitionId = event.queryStringParameters.competitionId;
    }
    
    console.log(`XML Function - Extracted competition ID: ${competitionId}`);
    
    if (!competitionId || competitionId.length < 6) {
      console.log(`XML Function - Invalid competition ID: ${competitionId}`);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/xml',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<error>
    <message>Invalid competition ID. Path: ${path}, ID: ${competitionId}</message>
</error>`
      };
    }

    // Check data sources for timer information
    let time = '0.00';
    let running = '0';
    let dataSource = 'default';
    
    // 1. FIRST: Check URL parameters (most reliable for current data)
    const urlData = event.queryStringParameters?.data;
    if (urlData) {
      try {
        const decodedData = Buffer.from(urlData, 'base64').toString('utf-8');
        const timerData = JSON.parse(decodedData);
        console.log('Found URL data:', timerData);
        if (timerData.competitionId === competitionId) {
          time = timerData.time || '0.00';
          running = timerData.running || '0';
          dataSource = 'url-params';
        }
      } catch (e) {
        console.log('Invalid URL data:', e.message);
      }
    }
    
    // 2. Fallback: Check global store 
    if (time === '0.00' && running === '0') {
      const storedData = global.timerDataStore[competitionId];
      if (storedData) {
        time = storedData.time || '0.00';
        running = storedData.running || '0';
        dataSource = 'global-store';
      }
    }
    
    // Log for debugging
    console.log(`XML request for ${competitionId}: time=${time}, running=${running}, source=${dataSource}`);
    console.log(`Global store contents:`, Object.keys(global.timerDataStore));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': `"${Date.now()}"`,
        'Last-Modified': new Date().toUTCString()
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<timer>
    <time>${time}</time>
    <running>${running}</running>
</timer>`
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<error>
    <message>Internal server error</message>
</error>`
    };
  }
};