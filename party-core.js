var http = require('http');
const { Client } = require('pg');

console.log(process.env.DATABASE_URL);

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
    rejectUnauthorized: false
});

client.connect().catch((error) => {
    console.log(error);
});

// client.query('SELECT table_schema,table_name FROM information_schema.tables;', (err, res) => {
//     if (err) { console.log(err); return; }
//     for (let row of res.rows) {
//         console.log(JSON.stringify(row));
//     }
//     client.end();
// });

// const PORT = process.env.PORT || 3000

// var server = http.createServer(function (request, response) {
//     console.log((new Date()) + ' Received request for ' + request.url);
//     response.writeHead(200);
//     response.end();
// });
// server.listen(PORT, function () {
//     console.log((new Date()) + ' Server is listening on port ' + PORT);
// });