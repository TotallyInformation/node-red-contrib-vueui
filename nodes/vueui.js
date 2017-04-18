/**
 * Copyright (c) 2017 Julian Knight (Totally Information)
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

'use strict'

// Module name must match this nodes html file
var moduleName = 'vueui_template';

//var inited = false;
var settings = {};

var serveStatic = require('serve-static'),
    socketio = require('socket.io'),
    path = require('path'),
    fs = require('fs'),
    events = require('events'),
    vueUiVersion = require('../package.json').version
;

var io;

// Why?
var ev = new events.EventEmitter();
ev.setMaxListeners(0);

module.exports = function(RED) {
    'use strict';

    function nodeGo(config) {
        // Create the node
        RED.nodes.createNode(this, config)

        // copy 'this' object in case we need it in context of callbacks of other functions.
        var node = this

        // Create local copies of the node configuration (as defined in the .html file)
        node.name   = config.name || ''
        node.url    = config.url  || 'vue'
        node.fwdInMessages = config.fwdInMessages || true
        // NOTE: When a node is redeployed - e.g. after the template is changed
        //       it is totally torn down and rebuilt so we cannot ever know
        //       whether the template was changed.
        node.template = config.template || '<p>{{ msg }}</p>';

        // Keep track of last msg sent (stored in global context on shutdown)
        node.previousMsg = node.context().global.get("vueuimessage") || { 'payload': {}, 'topic': '' }

        // We need an http server to serve the page
        var app = RED.httpNode || RED.httpAdmin

        // Use httNodeMiddleware function which is defined in settings.js
        // as for the http in/out nodes
        var httpMiddleware = function(req,res,next) { next() }
        if (RED.settings.httpNodeMiddleware) {
            if ( typeof RED.settings.httpNodeMiddleware === 'function' ) {
                httpMiddleware = RED.settings.httpNodeMiddleware
            }
        }
        
        // This ExpressJS middleware runs when the vueui page loads - we'll use it at some point
        // maybe to pass a "room" name in custom header for IO to use
        // so that we can have multiple pages served
        // @see https://expressjs.com/en/guide/using-middleware.html
        function localMiddleware (req, res, next) {
            RED.log.info('VUEUI:nodeGo:app.use - Req IP: ' + req.ip)
            next()
        }

        // Create a new, additional static http path to enable
        // loading of static resources for vueui
        fs.stat(path.join(__dirname, 'dist', 'index.html'), function(err, stat) {
            if (!err) {
                // If the ./dist/index.html exists use the dist folder... 
                app.use( join(node.url), httpMiddleware, localMiddleware, serveStatic( path.join( __dirname, 'dist' ) ) );
            } else {
                // ... otherwise, use dev resources at ./src/
                RED.log.audit({ 'Vue UI': 'Using development folder' });
                app.use( join(node.url), httpMiddleware, localMiddleware, serveStatic( path.join( __dirname, 'src' ) ) );
                // Include vendor resource source paths if needed
                /*
                var vendor_packages = [
                    'font-awesome',
                    'sprintf-js',
                    'jquery', 'jquery-ui'
                ]
                vendor_packages.forEach(function (packageName) {
                    app.use(join(settings.path, 'vendor', packageName), serveStatic(path.join(__dirname, 'node_modules', packageName)));
                })
                */
            }
        })

        var fullPath = join( RED.settings.httpNodeRoot, node.url );
        RED.log.info('Vue UI - Version ' + vueUiVersion + ' started at ' + fullPath);

        // Start Socket.IO
        if (!io) {
            RED.log.audit({ 'Vue UI:io': 'Creating new IO server' }) //debug
            io = socketio.listen(RED.server); // listen === attach
            node.status({ fill: 'blue', shape: 'dot', text: 'Socket Created' })

            // Check that all incoming SocketIO data has the IO cookie
            // TODO: Needs a bit more work to add some real security
            io.use(function(socket, next){
                if (socket.request.headers.cookie) return next();
                next(new Error('VueUI:NodeGo:io.use - Authentication error'));
            });
    
            // When someone loads the page, it will try to connect over Socket.IO
            // note that the connection returns the socket instance to monitor for responses from 
            // the ui client instance
            io.on('connection', function(socket) {
                RED.log.audit({ 'VueUI': 'Socket connected', 'clientCount': io.engine.clientsCount,
                                'ID': socket.id, 'Cookie': socket.handshake.headers.cookie }); //debug
                node.status({ fill: 'green', shape: 'dot', text: 'connected '+io.engine.clientsCount })
                //console.log('--socket.request.connection.remoteAddress--')
                //console.dir(socket.request.connection.remoteAddress)
                //console.log('--socket.handshake.address--')
                //console.dir(socket.handshake.address)
                //console.dir(io.sockets.connected)
    
                // First, send the current node configuration
                io.emit('vueuiConfig', {
                    id: node.id,
                    url: node.url,
                    name: node.name,
                    template: node.template,
                    fwdInMessages: node.fwdInMessages
                })
    
                // Then, send the last message received by this node
                io.emit('vueui', node.previousMsg)
    
                // if the client sends updated msg data...
                socket.on('vueuiClient', function(msg) {
                    RED.log.audit({ 'VueUI': 'Data recieved from client', 
                                    'ID': socket.id, 'Cookie': socket.handshake.headers.cookie, 'data': msg }); //debug
    
                    // Save the msg, and send it to any downstream flows
                    // TODO: This should probably have safety validations!
                    node.previousMsg = msg
                    node.send(msg);
                })

                socket.on('disconnect', function(reason) {
                    RED.log.audit({ 'VueUI': 'Socket disconnected', 'clientCount': io.engine.clientsCount, 
                                    'reason': reason, 'ID': socket.id, 'Cookie': socket.handshake.headers.cookie }); //debug
                    node.status({ fill: 'green', shape: 'ring', text: 'connected ' + io.engine.clientsCount });
                })
            })
        }

        // handler function for node input events (when a node instance receives a msg)
        node.on('input', nodeInputHandler)
        function nodeInputHandler(msg) {
            RED.log.info('VUEUI:nodeGo:nodeInputHandler - recieved msg') //debug

            // Keep track of last msg received, so we can resend the data
            // if the client socket gets disconnected or the client reloads the page.
            node.previousMsg = msg

            // pass the complete msg object to the vue ui client
            // TODO: This should probably have some safety validation on it
            io.emit('vueui', msg)

            // pass the incoming msg to the output flow, if configured to do so
            if (node.fwdInMessages === true) {
                node.send(msg)
            }

        } // -- end of incoming msg processing -- //

        // Do something when Node-RED is closing down
        // which includes when this node instance is redeployed
        node.on('close', function() {
            RED.log.info('VUEUI:nodeGo:on-close - saving previous msg'); //debug
            // Save the last message before re-deploying
            node.context().global.set("vueuimessage", node.previousMsg)

            // Let the clients know we are closing down
            //node.previousMsg._shutdown = true
            io.emit('vueuiConfig', { shutdown: true })

            node.status({});
            node.removeListener('input', nodeInputHandler);

            // TODO Do we need to remove the app.use paths too? YES!
            // This code borrowed from the http nodes
            app._router.stack.forEach(function(route,i,routes) {
                if ( route.route && route.route.path === node.url ) {
                    routes.splice(i,1)
                }
            });

            // Disconnect all clients
            // WARNING: TODO: If we do this, a client cannot reconnect after redeployment
            //                so the user has to reload the page
            //  They have to do this at the moment anyway so might as well.
            Object.keys(io.sockets.connected).forEach(function(id){
                io.sockets.connected[id].disconnect(true)
            })
            io = null
        })

   } // ---- End of nodeGo (initialised node instance) ---- //

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType(moduleName, nodeGo)

    // Register the url for saving/restoring template source from the library
    RED.library.register("vueuitemplates")
}

// ========== UTILITY FUNCTIONS ================ //

//from: http://stackoverflow.com/a/28592528/3016654
function join() {
    var trimRegex = new RegExp('^\\/|\\/$','g');
    var paths = Array.prototype.slice.call(arguments);
    return '/'+paths.map(function(e){return e.replace(trimRegex,'');}).filter(function(e){return e;}).join('/');
}

function init(RED, node) {
    /*
    var server = RED.server,
        app = RED.httpNode || RED.httpAdmin,
        log = RED.log,
        redSettings = RED.settings
    ;
    */

    //var uiSettings = redSettings.ui || {};
    //settings.path = uiSettings.path || 'vue';
    //settings.title = uiSettings.title || 'Node-RED Vue UI';

    //var fullPath = join(redSettings.httpNodeRoot, settings.path);
    //var socketIoPath = join(fullPath, 'socket.io');

    //io = socketio(RED.server, {path: join(fullPath, 'socket.io')});


    //log.info('Vue UI Version ' + dashboardVersion + ' started at ' + fullPath);
    /*
    io.on('connection', function(socket) {
        RED.log.audit( {'VueUI': 'Socket connected'} );

        //updateUi(socket);
        socket.on(updateValueEventName, ev.emit.bind(ev, updateValueEventName));
        socket.on('vueui-replay-state', function() {
            var ids = Object.getOwnPropertyNames(replayMessages);
            ids.forEach(function (id) {
                socket.emit(updateValueEventName, replayMessages[id]);
            });
            socket.emit('vueui-replay-done');
        });
    });
    */
} // ---- End of INIT ---- //

// EOF
