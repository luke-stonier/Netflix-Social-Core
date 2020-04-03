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

app.get('/:groupName', async function(req, res) {
    var groupName = req.params.groupName;
    if (!groupName) { res.sendStatus(400); return; }
    console.log(`Get group name info for ${groupName}`);
    var sql = `SELECT * FROM GroupInstances WHERE GroupName = '${groupName}';`;
    var rows = MakeSqlQuery(sql);
    console.log(rows);

    if (rows.length == 0) {
        //CreateGroup(groupName);
        res.sendStatus(204);
        return;
    }

    res.send();
});

app.listen(PORT, () => {
    console.log((new Date()) + ' Server is listening on port ' + PORT);

    client.connect().then(() => {
        console.log('SQL client connected');
    }).catch((error) => {
        console.log(error);
    });
});

function CreateGroup(groupName) {
    var serverAddress = "https://watch-hub.herokuapp.com/"
    var sql = `INSERT INTO GroupInstances (GroupName, server) VALUES ('${groupName}', ${serverAddress});`;
    var rows = MakeSqlQuery(sql);
    console.log(rows);
}

function SetClientCount(groupName, clietnCount) {

}

function RemoveGroup(groupname) {
    var sql = `DELETE FROM GroupInstances WHERE GroupName = '${groupname}';`;
    var rows = MakeSqlQuery(sql);
    console.log(rows);
}

function MakeSqlQuery(sql) {
    if (!client) { return; }
    client.query(sql, (err, res) => {
        if (err) {
            console.log("error: " + err);
            return;
        }

        if (!res) {
            console.log("no result");
            return;
        }
    
        client.end();

        return res.rows;
    });
}