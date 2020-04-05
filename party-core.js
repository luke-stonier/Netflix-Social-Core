const express = require('express');
const { Client } = require('pg');
const app = express();
const bodyParser = require('body-parser');
const secureConnectionString = process.env.DATABASE_URL;
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
    console.log(JSON.stringify(req.body));
    var WatchHubAddress = req.body.address;
    if (!WatchHubAddress) { res.sendStatus(400); return; }
    console.log(WatchHubAddress);
    var sql = `SELECT * FROM availableservers WHERE address='${WatchHubAddress}';`;
    var rows = await MakeSqlQuery(sql);
    if (!rows || rows.length == 0) {
        var addSQL = `INSERT INTO availableservers (address) VALUES ('${WatchHubAddress}');`;
        await MakeSqlQuery(addSQL)
    }

    res.sendStatus(200);
});

app.get('/:groupName', async function (req, res) {
    var groupName = req.params.groupName;
    if (!groupName) { res.sendStatus(400); return; }
    var sql = `SELECT * FROM GroupInstances WHERE groupname='${groupName}';`;
    var rows = await MakeSqlQuery(sql);
    if (!rows || rows.length == 0) {
        console.log("Creating group as it doesnt exist");
        var group = await CreateGroup(groupName);
        res.send(group);
        return;
    }

    console.log("Returning group info");
    var groupInstance = rows[0];
    res.send(groupInstance);
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

    console.log(`Instances available -> ${JSON.stringify(instances)}`);
    var groupInstances = [];

    await asyncForEach(instances, async (instance, index, array) => {
        var getInstanceData = `SELECT * FROM groupinstances WHERE server='${instance.address}';`;
        var instanceData = await MakeSqlQuery(getInstanceData);
        console.log("instance data-> " + JSON.stringify(instanceData));
        if (instanceData && instanceData.length > 0) {
            instanceData.forEach((groupInstance) => {
                console.log(`${JSON.stringify(groupInstance)} adding to groupInstances`);
                if (!groupInstances[groupInstance.server]) {
                    console.log(`create group instance ${groupInstance.server}`);
                    groupInstances[groupInstance.server] = {instances: []};
                }

                console.log(`push group instance to ${groupInstance.server}`);
                groupInstances[groupInstance.server].instances.push(groupInstance);
                console.log("group instance in loop ->" + JSON.stringify(groupInstances));
            });
        }
    });

    console.log("group instances ->" + JSON.stringify(groupInstances));

    if (groupInstances.length == 0) {
        console.log("No group instances to check");
        return instances[0].address;
    }

    // check for the instance with the smallest count and return the address
    var smallestCountServer;
    groupInstances.forEach((instance) => {
        console.log(instance);
    });
    return `https://watch-hub.herokuapp.com`;
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