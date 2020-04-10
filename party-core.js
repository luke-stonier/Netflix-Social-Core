const express = require('express');
const { Client } = require('pg');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const secureConnectionString = process.env.DATABASE_URL || 'postgres://dotjltonbuuogh:6cf0a45121c8faf9e36872b95a04b99c9829d1718e8e29dd5b243102c86bb320@ec2-54-247-78-30.eu-west-1.compute.amazonaws.com:5432/d5ugoj4cvigbbi';
const PORT = process.env.PORT || 3001

app.use(bodyParser.json());

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs
console.log(secureConnectionString);

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

app.post('/add', async function (req, res) {
    var WatchHubAddress = req.body.address;
    if (!WatchHubAddress) { res.sendStatus(400); return; }
    var sql = `SELECT * FROM availableservers WHERE address='${WatchHubAddress}';`;
    var rows = await MakeSqlQuery(sql);
    if (!rows || rows.length == 0) {
        var addSQL = `INSERT INTO availableservers (address) VALUES ('${WatchHubAddress}');`;
        await MakeSqlQuery(addSQL)
    }

    res.sendStatus(200);
});

app.get('/group/:groupName', async function (req, res) {
    var groupName = req.params.groupName;
    if (!groupName || groupName == '') { res.sendStatus(400); return; }
    var sql = `SELECT * FROM GroupInstances WHERE groupname='${groupName}';`;
    var rows = await MakeSqlQuery(sql);
    if (!rows || rows.length == 0) {
        console.log(`Creating group ${groupName} as it doesnt exist`);
        var group = await CreateGroup(groupName);
        res.send(group);
        return;
    }

    console.log(`Returning group info for ${groupName}`);
    var groupInstance = rows[0];
    res.send(groupInstance);
});

app.get('/ping', async function(req, res) {
    // ping all of the available servers
    console.log("Got ping, checking servers");
    var getAllInstances = `SELECT * FROM availableservers;`;
    var instances = await MakeSqlQuery(getAllInstances);
    await asyncForEach(instances, async (instance, index, array) => {
        var options = {
            uri: `https://${instance.address}/ping`,
            method: 'GET'
        }
    
        request(options, function (err, res, body) {
            if (err) { }
            if (res.statusCode == 200) {
                console.log(`${instance.address} is running.`);
            }
        });
    });
    res.sendStatus(200);
});

app.delete('/:groupName', async function (req, res) {
    var groupName = req.params.groupName;
    if (!groupName) { res.sendStatus(400); return; }
    var remaining = await RemoveGroup(groupName);
    res.send(remaining);
});

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

async function GetBestServer() {
    var getAllInstances = `SELECT * FROM availableservers;`;
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
            smallestCountServer = { address: instance, count: groupInstances[instance]};
    });
    return smallestCountServer.address;
}

async function CreateGroup(groupName) {
    var serverAddress = await GetBestServer();
    console.log(`Using ${serverAddress} for group ${groupName}`);
    var sql = `INSERT INTO GroupInstances (GroupName, server, clients) VALUES ('${groupName}', '${serverAddress}', 0);`;
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