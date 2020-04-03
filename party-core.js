const express = require('express');
const { Client } = require('pg');
const app = express();
const secureConnectionString = `${process.env.DATABASE_URL}`;
const PORT = process.env.PORT || 3001

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs

const client = new Client({
    connectionString: secureConnectionString,
    ssl: true
});

app.get('/', (req, res) => {
    client.query('SELECT * FROM GroupInstances;', (err, res) => {
        if (err) { console.log("error: " + err); return; }
        if (!res) { console.log("no result"); return; }
    
        console.log(`got ${res.rows.length} rows`);
    
        for (let row of res.rows) {
            console.log(JSON.stringify(row));
        }
    
        client.end();
    });
    
    res.send();
});

app.listen(PORT, () => {
    console.log((new Date()) + ' Server is listening on port ' + PORT);

    client.connect().then(() => {
        console.log('Postgres client connected');
    }).catch((error) => {
        console.log(error);
    });
});
