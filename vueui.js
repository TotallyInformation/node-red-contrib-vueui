/**
 * Copyright (c) 2015 Julian Knight (Totally Information)
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

var inited = false;

module.exports = function(RED) {
    if (!inited) {
        inited = true;
        init(RED.server, RED.httpNode || RED.httpAdmin, RED.log, RED.settings);
    }

    return {
        add: add,
        addLink: addLink,
        addBaseConfig: addBaseConfig,
        emit: emit,
        toNumber: toNumber.bind(null, false),
        toFloat: toNumber.bind(null, true),
        updateUi: updateUi
    };
};

var serveStatic = require('serve-static'),
    socketio = require('socket.io'),
    path = require('path'),
    fs = require('fs'),
    events = require('events'),
    dashboardVersion = require('./package.json').version
;

var io;

var baseConfiguration = {
    title: "Node-RED Dashboard",
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

// ========== UTILITY FUNCTIONS ================ //
function init(server, app, log, redSettings) {
    var uiSettings = redSettings.ui || {};
    settings.path = uiSettings.path || 'ui';
    settings.title = uiSettings.title || 'Node-RED Dashboard';
    settings.defaultGroupHeader = uiSettings.defaultGroup || 'Default';

    var fullPath = join(redSettings.httpNodeRoot, settings.path);
    var socketIoPath = join(fullPath, 'socket.io');

    io = socketio(server, {path: socketIoPath});

    fs.stat(path.join(__dirname, 'dist/index.html'), function(err, stat) {
        if (!err) {
            app.use(join(settings.path), serveStatic(path.join(__dirname, "dist")));
        } else {
            log.info("Using development folder");
            app.use(join(settings.path), serveStatic(path.join(__dirname, "src")));
            var vendor_packages = [
                'font-awesome',
                'sprintf-js',
                'jquery', 'jquery-ui'
            ];
            vendor_packages.forEach(function (packageName) {
                app.use(join(settings.path, 'vendor', packageName), serveStatic(path.join(__dirname, 'node_modules', packageName)));
            });
        }
    });

    log.info("Vue UI Version " + dashboardVersion + " started at " + fullPath);

    io.on('connection', function(socket) {
        //updateUi(socket);
        socket.on(updateValueEventName, ev.emit.bind(ev, updateValueEventName));
        socket.on('ui-replay-state', function() {
            var ids = Object.getOwnPropertyNames(replayMessages);
            ids.forEach(function (id) {
                socket.emit(updateValueEventName, replayMessages[id]);
            });
            socket.emit('ui-replay-done');
        });
    });
} // ---- End of INIT ---- //

// EOF
