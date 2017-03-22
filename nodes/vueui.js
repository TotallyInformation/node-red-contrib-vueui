/**
 * Copyright (c) 2017 Julian Knight (Totally Information)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

'use strict'

// Module name must match this nodes html file
var moduleName = 'vueui_template';

var inited = false;
var settings = {};

var serveStatic = require('serve-static'),
    socketio = require('socket.io'),
    path = require('path'),
    fs = require('fs'),
    events = require('events'),
    vueUiVersion = require('../package.json').version
;

var io;

var baseConfiguration = {
    title: "Node-RED Vue UI",
    theme: "theme-light"
};

var tabs = [];
var links = [];
var updateValueEventName = 'update-value';
var currentValues = {};
var replayMessages = {};
var removeStateTimers = {};
var removeStateTimeout = 1000;

var ev = new events.EventEmitter();
ev.setMaxListeners(0);

module.exports = function(RED) {
    'use strict'
    RED.log.audit(RED.settings);
    /*
        {   "uiPort":1880,
            "mqttReconnectTime":15000,
            "serialReconnectTime":15000,
            "debugMaxLength":1000,
            "flowFilePretty":true,
            "httpAdminRoot":"/red/",
            "httpStatic":"public",
            "functionGlobalContext":{},
            "logging":{"console":{"level":"info","metrics":false,"audit":true}},
            "settingsFile":"C:\\Users\\julia\\.node-red\\settings.js",
            "httpRoot":"/",
            "disableEditor":false,
            "httpNodeRoot":"/",
            "uiHost":"0.0.0.0",
            "coreNodesDir":"C:\\Users\\julia\\AppData\\Roaming\\nvm\\v6.9.1\\node_modules\\node-red\\nodes",
            "version":"0.16.2",
            "userDir":"C:\\Users\\julia\\.node-red",
            "level":98,
            "timestamp":1490205280827}
    */

    function nodeGo(config) {
        // Create the node
        RED.nodes.createNode(this,config);

        // Start Socket.IO
        if (!io) { io = socketio.listen(RED.server); }

        RED.log.audit(RED.settings);

        // Create local copies of the node configuration (as defined in the .html file)
        this.name   = config.name || ''
        this.url    = config.url  || 'vueui'
        this.format = config.format || ''
 
        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;

        var fullPath = join( RED.settings.httpNodeRoot, node.url );
        RED.log.info('Vue UI Version ' + vueUiVersion + ' started at ' + fullPath);

        // Initialise the static server and Socket.IO
        if (!inited) {
            inited = true;
            init(RED, node);
        }
   }

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType(moduleName,nodeGo);
};

// ========== UTILITY FUNCTIONS ================ //

//from: http://stackoverflow.com/a/28592528/3016654
function join() {
    var trimRegex = new RegExp('^\\/|\\/$','g'),
    paths = Array.prototype.slice.call(arguments);
    return '/'+paths.map(function(e){return e.replace(trimRegex,"");}).filter(function(e){return e;}).join('/');
}

function init(RED, node) {
    var server = RED.server,
        app = RED.httpNode || RED.httpAdmin,
        log = RED.log,
        redSettings = RED.settings
    ;

    var uiSettings = redSettings.ui || {};
    settings.path = uiSettings.path || 'vue';
    //settings.title = uiSettings.title || 'Node-RED Vue UI';

    var fullPath = join(redSettings.httpNodeRoot, settings.path);
    var socketIoPath = join(fullPath, 'socket.io');

    io = socketio(server, {path: socketIoPath});

    fs.stat(path.join(__dirname, 'dist', 'index.html'), function(err, stat) {
        if (!err) {
            app.use( join( settings.path ), serveStatic( path.join( __dirname, 'dist' ) ) );
        } else {
            log.info("Using development folder");
            app.use( join( settings.path ), serveStatic( path.join( __dirname, 'src' ) ) );
            /*
            var vendor_packages = [
                'font-awesome',
                'sprintf-js',
                'jquery', 'jquery-ui'
            ];
            vendor_packages.forEach(function (packageName) {
                app.use(join(settings.path, 'vendor', packageName), serveStatic(path.join(__dirname, 'node_modules', packageName)));
            });
            */
        }
    });

    //log.info("Vue UI Version " + dashboardVersion + " started at " + fullPath);

    io.on('connection', function(socket) {
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
} // ---- End of INIT ---- //

// EOF
