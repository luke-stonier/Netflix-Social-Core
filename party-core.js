const express = require('express');
const { Client } = require('pg');
const app = express();
const secureConnectionString = process.env.DATABASE_URL || "postgres://dotjltonbuuogh:6cf0a45121c8faf9e36872b95a04b99c9829d1718e8e29dd5b243102c86bb320@ec2-54-247-78-30.eu-west-1.compute.amazonaws.com:5432/d5ugoj4cvigbbi";
console.log(secureConnectionString);
const PORT = process.env.PORT || 3001

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs

const client = new Client({
    connectionString: secureConnectionString,
    ssl: true
});

app.listen(PORT, () => {
    console.log((new Date()) + ' Server is listening on port ' + PORT);

    client.connect().then(() => {
        console.log('SQL client connected');
    }).catch((error) => {
        console.log(error);
    });
});

app.get('/add/watch-hub', async function(req, res) {
    // var WatchHubAddress = req.
    console.log(`add address -> ${req.ip}`);
    return;
    if (!WatchHubAddress) { res.sendStatus(400); return; }
    var sql = `SELECT * FROM availableservers WHERE address='${WatchHubAddress}';`;
    MakeSqlQuery(sql, (rows) => {
        if(!rows || rows.length == 0) {
            var addSQL = `INSERT INTO availableservers (address) VALUES ('${WatchHubAddress}');`;
            MakeSqlQuery(addSQL, () => {
                res.sendStatus(200);
            });
        }

        res.sendStatus(200);
    }, () => {
        res.sendStatus(400);
    })
});

app.get('/:groupName', async function(req, res) {
    var groupName = req.params.groupName;
    if (!groupName) { res.sendStatus(400); return; }
    console.log(`Get group name info for ${groupName}`);
    var sql = `SELECT * FROM GroupInstances WHERE groupname='${groupName}';`;
    await MakeSqlQuery(sql, (rows) => {
        if (!rows || rows.length == 0) {
            CreateGroup(groupName, (row) => {
                res.send(row);
            });
            return;
        }

        var groupInstance = rows[0];
        res.send(groupInstance);
    }, () => { res.sendStatus(400); });
});

app.delete('/:groupName', async function(req, res) {
    var groupName = req.params.groupName;
    if (!groupName) { res.sendStatus(400); return; }
    RemoveGroup(groupName, () => {
        res.sendStatus(200);
    })
});

function CreateGroup(groupName, callback) {
    console.log(`Creating group ${groupName}`);
    var serverAddress = "https://watch-hub.herokuapp.com/"
    var sql = `INSERT INTO GroupInstances (GroupName, server, clients) VALUES ('${groupName}', '${serverAddress}', 0);`;
    MakeSqlQuery(sql, (rows) => {
        callback({
            groupname: groupName,
            server: serverAddress,
            clients: 0
        });
    }, () => {});
}

function SetClientCount(groupName, clietnCount) {

}

function RemoveGroup(groupname, callback) {
    var sql = `DELETE FROM GroupInstances WHERE groupname='${groupname}';`;
    MakeSqlQuery(sql, () => {
        callback();
    }, () => {});
}

function MakeSqlQuery(sql, callback, errCallback) {
    if (!client) { errCallback('No Client'); }
    console.log(`running ${sql}`);
    client.query(sql, (err, res) => {
        if (err) {
            console.log(sql + " -> " + err);
            errCallback(err);
        }

        if (!res) {
            errCallback('No result');
        }

        callback(res.rows);
    });
}