/**
 * Created by Azku on 14-1-24.
 */

var WebSocketServer = require('ws').Server;
var  wss = new WebSocketServer({port: 18080});
wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        console.log('received: %s', message);
        ws.send(message);
    });
    ws.send('something');
    console.log("connection");
});