const http = require('http');

const boundary = '----WebKitBoundary7MA4YWxkTrZu0gW';
const imageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="logo"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`, 'utf8');
const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
const postData = Buffer.concat([header, imageBuffer, footer]);

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/teams/upload-logo',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': postData.length,
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Upload status:', res.statusCode);
    console.log('Upload response:', data);
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
});

req.on('error', (e) => {
  console.error(e);
  process.exit(1);
});

req.write(postData);
req.end();
