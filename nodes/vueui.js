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
        RED.nodes.createNode(this, config);

        // Create local copies of the node configuration (as defined in the .html file)
        this.name   = config.name || '';
        this.url    = config.url  || '/vueui';
        this.template = config.template || '<p>{{ msg.payload }}</p>';
        this.fwdInMessages = config.fwdInMessages;
        this.lastMessage = { template: this.template };
 
        // copy 'this' object in case we need it in context of callbacks of other functions.
        var node = this;

        // handler function for node input events (when a node instance receives a msg)
        function nodeInputHandler(msg) {
            RED.log.info('VUEUI:nodeInputHandler - recieved msg'); //debug

            // Add the template to the msg, unless it already has one
            if ( !('template' in msg) ) {
                msg.template = node.template;
            }

            // pass the complete msg object to the vue ui client
            // TODO: This should probably have some safety validation on it
            io.emit('vueui', msg);
            this.lastMessage = msg;

        } // -- end of msg recieved processing -- //
        node.on('input', nodeInputHandler);

        // Do something when stuff is closing down
        node.on('close', function() {
            RED.log.info('VUEUI:on-close'); //debug

            node.removeListener('input', nodeInputHandler);
            node.status({});
            io.disconnect;
            io = null;
        })


        // We need an http server to serve the page
        var app = RED.httpNode || RED.httpAdmin;

        // Create a new, additional static http path to enable
        // loading of static resources for vueui
        fs.stat(path.join(__dirname, 'dist', 'index.html'), function(err, stat) {
            if (!err) {
                // If the ./dist/index.html exists use the dist folder... 
                app.use( join(node.url), serveStatic( path.join( __dirname, 'dist' ) ) );
            } else {
                // ... otherwise, use dev resources at ./src/
                RED.log.info('Using development folder');
                app.use( join(node.url), serveStatic( path.join( __dirname, 'src' ) ) );
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

        var fullPath = join( RED.settings.httpNodeRoot, this.url );
        RED.log.info('Vue UI Version ' + vueUiVersion + ' started at ' + fullPath);

        // Start Socket.IO
        if (!io) {
            RED.log.info('VUEUI:io - creating new IO server'); //debug
            io = socketio.listen(RED.server);
        }

        // When someone loads the page, it will try to connect over Socket.IO
        // note that the connection returns the socket instance to monitor for responses from 
        // the ui client instance
        io.on('connection', function(socket) {
            RED.log.audit({ 'VueUI': 'Socket connected', 'clientCount': io.engine.clientsCount }); //debug
            node.status({ fill: 'green', shape: 'dot', text: 'connected '+io.engine.clientsCount });

            // send the last message with the current template
            io.emit('vueui', node.lastMessage);

            socket.on('vueuiClient', function(msg) {
                RED.log.audit({ 'VueUI': 'Data recieved from client', 'data': msg }); //debug
                if (node.fwdInMessages) {
                    node.send(msg);
                }
            });

            socket.on('disconnect', function(reason) {
                RED.log.audit({ 'VueUI': 'Socket disconnected', 'clientCount': io.engine.clientsCount, 'reason': reason }); //debug
                node.status({ fill: 'green', shape: 'ring', text: 'connected ' + io.engine.clientsCount });
            });
        });

   } // ---- End of nodeGo (initialised node instance) ---- //

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType(moduleName, nodeGo);
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
