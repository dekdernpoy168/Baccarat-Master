import http from 'http';

http.get('http://localhost:3000/socket.io/?EIO=4&transport=polling', (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data));
}).on('error', err => console.error('Error:', err.message));
