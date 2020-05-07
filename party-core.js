const express = require('express');
const crypto = require('crypto');
const { Client } = require('pg');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const secureConnectionString = process.env.DATABASE_URL || 'postgres://dotjltonbuuogh:6cf0a45121c8faf9e36872b95a04b99c9829d1718e8e29dd5b243102c86bb320@ec2-54-247-78-30.eu-west-1.compute.amazonaws.com:5432/d5ugoj4cvigbbi';
const PORT = process.env.PORT || 3001

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "https://netflix-social.com");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  

app.use(bodyParser.json());

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs
console.log(secureConnectionString);

const client = new Client({
    connectionString: secureConnectionString,
    ssl: true
});

app.listen(PORT, () => {
    console.log((new Date()) + ' Server is listening on port ' + PORT);

    client.connect().then(async () => {
        console.log('SQL client connected');
    }).catch((error) => {
        console.log(error);
    });
});

app.get('/get-server-list', async function (req, res) {
    var getAllServers = `SELECT * FROM availableservers;`;
    var rows = await MakeSqlQuery(getAllServers);
    res.send(rows);
});

app.get('/get-group-list', async function (req, res) {
    var getAllGroups = `SELECT * FROM groupinstances;`;
    var rows = await MakeSqlQuery(getAllGroups);
    res.send(rows);
});

app.get('/clear-group-list', async function (req, res) {
    var removeSql = `DELETE FROM GroupInstances;`;
    await MakeSqlQuery(removeSql);
    res.sendStatus(200);
});

app.post('/log', async function (req, res) {
    // Add logging
    var logData = "Test Log";
    var logSql = `INSERT INTO Logs (Log) VALUES ('${logData}');`;
    // run sql command
    await MakeSqlQuery(logSql);
});

app.get('/logs', async function (req, res) {
    var logSql = `SELECT * FROM Logs;`;
    var rows = await MakeSqlQuery(logSql);
    res.send(rows);
});

app.post('/add', async function (req, res) {
    var WatchHubAddress = req.body.address;
    var is_dev = req.body.is_dev;
    if (!WatchHubAddress) { res.sendStatus(400); return; }

    // remove all old groups
    var removeSql = `DELETE FROM GroupInstances WHERE server='${WatchHubAddress}';`;
    await MakeSqlQuery(removeSql);

    // remove old record
    var removeSql = `DELETE FROM availableservers WHERE address='${WatchHubAddress}';`;
    await MakeSqlQuery(removeSql);

    // add new record
    var addSQL = `INSERT INTO availableservers (address, is_dev) VALUES ('${WatchHubAddress}', '${is_dev}');`;
    await MakeSqlQuery(addSQL);

    res.sendStatus(200);
});

app.get('/group/:groupName', async function (req, res) {
    var groupName = req.params.groupName;
    var is_dev = req.header('develop_key') == 'develop';
    var groupKey = req.header('group-key');
    if (groupKey)
        groupKey = crypto.createHash('md5').update(`${groupName}${groupKey}`).digest('hex');

    console.log(`get group info for ${groupName} -> dev = ${is_dev}`);
    if (!groupName || groupName == '') { res.sendStatus(400); return; }
    var sql = `SELECT * FROM GroupInstances WHERE groupname='${groupName}';`;
    var rows = await MakeSqlQuery(sql);
    if (!rows || rows.length == 0) {
        var group = await CreateGroup(groupName, groupKey, is_dev);
        console.log(`Return group -> ${JSON.stringify(group)}`);
        res.send(group);
        return;
    }

    var groupInstance = rows[0];
    if (groupInstance.groupkey && groupInstance.groupkey != groupKey) {
        res.sendStatus(403);
        return;
    }
    delete groupInstance.groupkey;
    console.log(`Return group -> ${JSON.stringify(groupInstance)}`);
    res.send(groupInstance);
});

app.delete('/group/:groupName', async function (req, res) {
    var groupName = req.params.groupName;
    if (!groupName) { res.sendStatus(400); return; }
    var remaining = await RemoveGroup(groupName);
    res.send(remaining);
});

app.get('/ping', async function (req, res) {
    // ping all of the available servers
    console.log("Got ping, checking servers");

    console.log("groups running --->");
    var getAllGroups = `SELECT * FROM groupinstances;`;
    var rows = await MakeSqlQuery(getAllGroups);
    rows.forEach(element => {
        console.log(`--> ${element.groupname} - ${element.server}`);
    });

    console.log("servers running --->");
    var getAllInstances = `SELECT * FROM availableservers;`;
    var instances = await MakeSqlQuery(getAllInstances);
    instances.forEach((instance, index) => {
        var options = {
            uri: `https://${instance.address}/ping`,
            method: 'GET'
        }

        request(options, function (err, res, body) {
            if (err)
                console.error(`--> ${instance.address} is not running`);
            if (res.statusCode == 200) {
                console.log(`--> ${instance.address} is running.`);
            } else {
                console.log(`--> ${res.body}`);
            }
        });
    });

    res.sendStatus(200);
});

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

async function GetBestServer(is_dev) {
    var getAllInstances = `SELECT * FROM availableservers WHERE is_dev = ${is_dev};`;
    var instances = await MakeSqlQuery(getAllInstances);
    if (!instances || instances.length == 0)
        return; // no available servers
    var groupInstances = {};

    await asyncForEach(instances, async (instance, index, array) => {
        var getInstanceData = `SELECT * FROM groupinstances WHERE server='${instance.address}';`;
        var instanceData = await MakeSqlQuery(getInstanceData);
        if (!instanceData || instanceData.length == 0)
            groupInstances[instance.address] = 0;

        if (instanceData && instanceData.length > 0) {
            instanceData.forEach((groupInstance) => {
                var addressKey = groupInstance.server;
                if (!groupInstances[addressKey]) {
                    groupInstances[addressKey] = 0;
                }

                groupInstances[addressKey]++;
            });
        }
    });

    if (groupInstances.length == 0) {
        return instances[0].address;
    }

    // check for the instance with the smallest count and return the address
    var smallestCountServer;
    Object.keys(groupInstances).forEach((instance) => {
        if (!smallestCountServer || groupInstances[instance] < smallestCountServer.count)
            smallestCountServer = { address: instance, count: groupInstances[instance] };
    });
    return smallestCountServer.address;
}

async function CreateGroup(groupName, groupKey, is_dev) {
    var serverAddress = await GetBestServer(is_dev);
    console.log(`Using ${serverAddress} for group ${groupName}`);
    var sql = `INSERT INTO GroupInstances (GroupName, GroupKey, server, clients) VALUES ('${groupName}', '${groupKey}','${serverAddress}', 0);`;
    await MakeSqlQuery(sql);
    return {
        groupname: groupName,
        server: serverAddress,
        clients: 0
    };
}

async function SetClientCount(groupName, clietnCount) {

}

async function RemoveGroup(groupname) {
    var sql = `DELETE FROM GroupInstances WHERE groupname='${groupname}';`;
    await MakeSqlQuery(sql);
    var selectSQL = `SELECT * FROM GroupInstances;`;
    return await MakeSqlQuery(selectSQL);
}

async function MakeSqlQuery(sql) {
    if (!client) { return; }
    var res = await client.query(sql);
    return res.rows;
}