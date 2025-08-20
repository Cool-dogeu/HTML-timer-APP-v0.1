// Access the same global store
global.timerDataStore = global.timerDataStore || {};

exports.handler = async (event, context) => {
  try {
    // Parse the path to extract competition ID
    const path = event.path;
    console.log(`XML Function - Received path: ${path}`);
    
    const xmlMatch = path.match(/^\/([a-zA-Z0-9]{6,})\/xml\/?$/);
    console.log(`XML Function - Regex match result:`, xmlMatch);
    
    if (!xmlMatch) {
      console.log(`XML Function - No match for path: ${path}`);
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
    <message>Invalid XML endpoint format - received path: ${path}</message>
</error>`
      };
    }

    const competitionId = xmlMatch[1];
    console.log(`XML Function - Extracted competition ID: ${competitionId}`);

    // Check data sources for timer information
    let time = '0.00';
    let running = '0';
    let dataSource = 'default';
    
    // 1. Check global store first
    const storedData = global.timerDataStore[competitionId];
    if (storedData) {
      time = storedData.time || '0.00';
      running = storedData.running || '0';
      dataSource = 'global-store';
    }
    
    // 2. Check URL parameters (for shareable URLs with embedded data)
    if (time === '0.00' && running === '0') {
      const urlData = event.queryStringParameters?.data;
      if (urlData) {
        try {
          const decodedData = Buffer.from(urlData, 'base64').toString('utf-8');
          const timerData = JSON.parse(decodedData);
          if (timerData.competitionId === competitionId) {
            time = timerData.time || '0.00';
            running = timerData.running || '0';
            dataSource = 'url-params';
          }
        } catch (e) {
          // Invalid URL data, use defaults
        }
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