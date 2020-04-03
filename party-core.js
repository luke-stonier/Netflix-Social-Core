var http = require('http');
const { Client } = require('pg');

const secureConnectionString = `${process.env.DATABASE_URL}`;
console.log(secureConnectionString);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs

const client = new Client({
    connectionString: secureConnectionString,
    ssl: true
});

client.connect().catch((error) => {
    console.log(error);
});

console.log("DO QUERY")
client.query('SELECT * FROM GroupInstances;', (err, res) => {
    if (err) { console.log("error: " + err); return; }
    if (!res) { console.log("no result"); return;}

    console.log(`got ${res.rows.length} rows`);

    for (let row of res.rows) {
        console.log(JSON.stringify(row));
    }

    client.end();
});

// const PORT = process.env.PORT || 3000

// var server = http.createServer(function (request, response) {
//     console.log((new Date()) + ' Received request for ' + request.url);
//     response.writeHead(200);
//     response.end();
// });
// server.listen(PORT, function () {
//     console.log((new Date()) + ' Server is listening on port ' + PORT);
// });