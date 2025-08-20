exports.handler = async (event, context) => {
  // Log everything for debugging
  console.log(`🔥🔥🔥 XML FUNCTION CALLED 🔥🔥🔥`);
  console.log(`Path: ${event.path}`);
  console.log(`Query: ${JSON.stringify(event.queryStringParameters)}`);
  console.log(`Headers: ${JSON.stringify(event.headers)}`);
  console.log(`Method: ${event.httpMethod}`);
  
  try {
    // Parse the path to extract competition ID
    const path = event.path;
    
    let competitionId = null;
    
    // Get competition ID from query parameter (passed by Netlify redirect)
    competitionId = event.queryStringParameters?.competitionId;
    
    console.log(`XML Function - Extracted competition ID: ${competitionId}`);
    
    if (!competitionId || competitionId.length < 6) {
      console.log(`XML Function - Invalid competition ID: ${competitionId}`);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Vary': '*',
        'X-Content-Type-Options': 'nosniff'
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
    
    // 1. FIRST: Check URL parameters (embedded data)
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
    
    // 2. Check Upstash Redis
    if (time === '0.00' && running === '0') {
      try {
        const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
        const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
        
        console.log(`Redis credentials: URL=${!!REDIS_URL}, TOKEN=${!!REDIS_TOKEN}`);
        
        if (REDIS_URL && REDIS_TOKEN) {
          const redisKey = `timer:${competitionId}`;
          console.log(`Attempting to read Redis key: ${redisKey}`);
          
          const response = await fetch(`${REDIS_URL}/get/${redisKey}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${REDIS_TOKEN}`
            }
          });
          
          console.log(`Redis response status: ${response.status}`);
          
          if (response.ok) {
            const result = await response.json();
            console.log('Redis response:', result);
            
            if (result.result) {
              let timerData;
              try {
                // Parse the Redis result - it's double-encoded JSON
                const firstParse = JSON.parse(result.result);
                timerData = JSON.parse(firstParse);
                console.log('✅ Found Redis data:', timerData);
                
                time = timerData.time || '0.00';
                running = timerData.running || '0';
                dataSource = 'redis';
              } catch (parseError) {
                console.log('❌ Error parsing Redis data:', parseError.message);
              }
            } else {
              console.log('❌ No data found in Redis for key:', redisKey);
            }
          } else {
            const errorText = await response.text();
            console.log('❌ Redis request failed:', response.status, errorText);
          }
        } else {
          console.log('❌ Redis credentials not configured');
        }
      } catch (error) {
        console.log('❌ Redis read error:', error.message);
      }
    }
    
    // Log for debugging
    console.log(`XML request for ${competitionId}: time=${time}, running=${running}, source=${dataSource}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': `"${Date.now()}-${Math.random()}"`,
        'Last-Modified': new Date().toUTCString(),
        'Vary': '*',
        'X-Content-Type-Options': 'nosniff',
        'X-Content-Type-Options': 'nosniff'
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
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Vary': '*',
        'X-Content-Type-Options': 'nosniff'
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<error>
    <message>Internal server error</message>
</error>`
    };
  }
};