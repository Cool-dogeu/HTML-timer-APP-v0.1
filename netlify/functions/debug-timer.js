const fs = require('fs');
const path = require('path');

// Debug endpoint to see stored timer data
global.timerDataStore = global.timerDataStore || {};

const dataDir = path.join(__dirname, '../../.netlify-timer-data');

exports.handler = async (event, context) => {
  let fileContents = {};
  
  // Read all files in the data directory
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(dataDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          fileContents[file] = JSON.parse(content);
        } catch (error) {
          fileContents[file] = `Error reading file: ${error.message}`;
        }
      }
    }
  }
  
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
      fileStore: fileContents,
      fileStoreKeys: Object.keys(fileContents),
      dataDirectory: dataDir,
      dataDirExists: fs.existsSync(dataDir),
      timestamp: new Date().toISOString(),
      path: event.path,
      method: event.httpMethod
    }, null, 2)
  };
};