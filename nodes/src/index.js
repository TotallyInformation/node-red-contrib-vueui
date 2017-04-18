/*global Vue */
/*
  Copyright (c) 2017 Julian Knight (Totally Information)

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

// Ignore the non-production warning
Vue.config.productionTip = false

var msgRecvCounter = 0
var msgSentCounter = 0
var vmUpdatedMsg = null

// Variables to hold template src
var vmTemplate = 'Node-RED Vue UI: No template provided.<p>{{ msg }}</p>'
function appTemplate(source /*optional*/) {
    // Vue template source wrapped in the app container
    return '<div id="app">\n' + (source || vmTemplate) + '\n</div>'
}

// Define the data available to the Vue instance
// WARNING: standard code CANNOT add to msg structure without using
//          a setter in the Vue instance because Vue will not register
//          changes to it. So you can't do msg.payload.fred = 'blah'
//          you either have to totally replace msg.payload or msg
//          or create a setter/computed in vm
var vmData = {
    msg: { topic: '', payload: {} }, // initialise empty msg container 
}

var vmState = {
    template: vmTemplate,   // default template
    msgRecvCounter: 0,      // track how many msg's received
    msgSentCounter: 0,      // track how many msg's sent
    nrShutdown: false
}

var vmOptions = {
    el: '#app',
    data: function() { return vmData },
    template: appTemplate(),

    // watch only triggers if you update the exact thing you are watching
    // if you watch msg and update msg.cat, it will not trigger
    // Use the deep option to override that
    watch: {
        'msg': {
            handler: handleWatchMsg,
            deep: true
        }
    },

    // Called for events triggered in UI, e.g. click. May be called manually too
    methods: {
        // Replace the entire msg object, to avoid sending back to node-red
        replaceMsg: function(mess /* optional */) {
            this.$data.msg = (mess === null ? vmData.msg : mess)
        },
        // Update only those msg properties which have different values
        updateMsg: function(mess /* optional */) {
            if (mess === null) mess = vmData.msg

            // The following doesn't help make things any more reactive?!?
            var keys = Object.keys(mess)
            keys.forEach(function(key, i){
                var changed = (vm.msg[key] === mess[key])
                console.log((changed? "updated:  ": "skipped:  ") + key + " => " + mess[key])
                if (changed) {
                    vm.$set(vm.msg, key, mess[key])
                }
            })
        }
    },

    // Convenience methods for accessing the msg structure
    computed: {
        msgFields: function() {
            // Msg property names that don't start with '_'
            var fields = Object.getOwnPropertyNames(this.msg)
            return fields.filter(f => !f.startsWith("_"))
        }
    },

    // Only in development mode
    renderError (h, err) {
        return h('pre', { style: { color: 'red' }}, err.stack)
    }
}

// ---- Vue Instance Handler Functions ---- //
function handleWatchMsg(newMsg, oldMsg) {
    // If newMsg and oldMsg are the same object, something changed deeper down
    // in the msg structure -- send the updated msg object back to node-red
    if (newMsg === oldMsg) {
        // UI updates seem to trigger double events, ignore duplicates
        if (newMsg === vmUpdatedMsg) {
            console.info("vueui:vm:watch:msg - duplicate event ignored")
            return
        }

        vmUpdatedMsg = newMsg
        sendMsg(newMsg)
    }
}
function handleNrShutdown(newVal) {
//    if ( newVal === true ) {
        // Temporarily replace the body of the app container with a warning.
        // when the socket is reconnected, the page should be restored...
        vm.$el.innerHtml = '<p style="border:2px solid red;margin:.5em;padding:.5em">Flow has stopped, please reload the page when restarted</p>'
//    }
}
// ---- End Of Vue Instance Handler Functions ---- //


// Create initial Vue
var vm = new Vue(vmOptions)

// Create the socket
var io = io()

// send a msg back to Node-RED
// NR will generally expect the msg to contain a payload topic
function sendMsg(msg) {
    // Track how many messages have been sent
    vmState.msgSentCounter++
    console.info('vueui:vm:watch:msg - data msg #' + vmState.msgSentCounter + ' sent')

    io.emit('vueuiClient', msg)
}

// When the socket is connected .................
io.on('connect', function() {
    console.log('SOCKET CONNECTED')
    vmState.nrShutdown = false
}) // --- End of socket connection processing ---

// When Node-RED vueui template sends new CONFIG over Socket.IO...
io.on('vueuiConfig', function(wsMsg) {
    console.info('vueui:io.connect - config received')
    console.log(JSON.stringify(wsMsg, null, 2))

    if ( (wsMsg !== null) && (wsMsg !== '') ) {
        var temp = vmTemplate

        // Checking for NR shutdown or node redeployment
        if ( 'shutdown' in wsMsg ) {
            console.info('vueuiConfig:io.connect:io.on - Node-RED node shutting down')
            handleNrShutdown(wsMsg.shutdown)
        }

        // Extract any template source from the msg, if passed & remove from msg
        if ( 'template' in wsMsg ) {
            //console.info('vueui:io.connect:io.on - template in msg')
            temp = wsMsg.template
        }

        // If msg.template has changed, generate a new Vue using the new data
        if (temp !== vmTemplate) {
            console.info('vueuiConfig: regenerating Vue')

            vmTemplate = temp
            vmOptions.template = appTemplate()
            vm = new Vue(vmOptions)
        }
    }
}) // -- End of websocket receive CONFIG from Node-RED -- //

// When Node-RED vueui template sends incoming msg DATA over Socket.IO...
io.on('vueui', function(wsMsg) {
    if ( (wsMsg !== null) && (wsMsg !== '') ) {
        // Use the incoming msg object as vue data
        if ( Object.getOwnPropertyNames(wsMsg).length > 0 ) {
            // Track how many messages have been received
            vmState.msgRecvCounter++

            console.info('vueui:io.connect - msg #' + vmState.msgRecvCounter + ' received')
            console.log(JSON.stringify(wsMsg, null, 2))

            // Replace the Vue data with the latest msg object --
            vmData.msg = wsMsg
        }
    }
}) // -- End of websocket receive DATA from Node-RED -- //

// When the socket is disconnected ..............
io.on('disconnect', function() {
    console.log('SOCKET DISCONNECTED')
    //io.emit('vueuiClient',{action:'disconnected'}) // debug - don't normally want to bombard the server
    vmState.nrShutdown = true
}) // --- End of socket disconnect processing ---

/*
setInterval(function(){
    //console.count('me')
    myCounter++
    //vm.$data.msg = { topic: "setInterval", payload: {counter: myCounter, some: "fred", cat:"bark"} }
    //vm.msg.payload.counter = myCounter
    vm.msg.payload = {counter: myCounter}
    //Vue.nextTick(function () {
    //    console.dir(vm.msg.payload)
    //})
},10000)
*/

// EOF
