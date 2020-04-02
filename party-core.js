var http = require('http');
const PORT = process.env.PORT || 3000

var server = http.createServer(function (request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(200);
    response.end();
});
server.listen(PORT, function () {
    console.log((new Date()) + ' Server is listening on port ' + PORT);
});