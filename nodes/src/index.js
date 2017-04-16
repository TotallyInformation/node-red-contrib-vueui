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

// Variables to hold template src
var vmTemplate = 'Node-RED Vue UI: No template provided.<p>{{ msg }}</p>'
var newTemplate = vmTemplate // Start with vm and new templates the same
var vmComp = Vue.compile('<div id="app">' + vmTemplate + '</div>')

// Define the data available to the Vue instance
// WARNING: standard code CANNOT add to msg structure without using
//          a setter in the Vue instance because Vue will not register
//          changes to it. So you cant do msg.payload.fred = 'blah'
//          you either have to totally replace msg.payload or msg
//          or create a setter/computed in vm
var vmData = { 
    msg: {  }, // default to a dummy msg 
    msgCounter: 0,                 // track how many msg's recieved
    msgSentCounter: 0,             // track how many msg's sent
    fwdInMessages: true,    // will we reflect input msg back out?
    template: 'Node-RED Vue UI: No template provided.<p>{{ msg }}</p>'    // default to something
}

var myCounter = 0

// ---- Vue Instance Handler Functions ---- //
var handleBeforeUpdate = function() {
    console.info('vueui:vm:beforeUpdate')
    // Send any UI changes to the data back to node-red
    //if (Object.getOwnPropertyNames(this.msg).length > 0) {
    //    io.emit('vueuiClient', this.msg)
    //}
}
var handleWatchMsg = function(newVal, oldVal){
    console.info('vueui:vm:watch:msg - ' + this.msgCounter)
    sendMsg(newVal)
}
var handleTemplateChg = function(newVal, oldVal){
    console.info('vueui:vm:watch:templateChange')
    vmComp = Vue.compile('<div id="app">' + newVal + '</div>')
    vm.$options.render = vmComp.render
    vm.$options.staticRenderFns = vmComp.newStaticFns
    vm.$forceUpdate()
}
// ---- End Of Vue Instance Handler Functions ---- //

// Create an instance of Vue
var vm = new Vue({
    el: '#app',
    data: function() { return vmData },
    // beforeUpdate is triggered just before the dom is updated
    beforeUpdate: handleBeforeUpdate,
    // watch only triggers if you update the exact thing you are watching
    // if you watch msg and update msg.cat, it wont trigger
    // Use the deep option to override that
    watch: {
        'msg': {
            handler: handleWatchMsg,
            deep: true
        },
        'template': handleTemplateChg
    },
    // Called for exents triggered in UI, e.g. click. May be called manually too
    methods: {
        updateMsg: function(msg) {
            this.msg = msg
        },
        updateCounter: function(event) {
            console.info('vueui:vm:methods:updateCounter')
            this.msg.payload.counter++
        }
    },
    render: vmComp.render,
    staticRenderFns: vmComp.staticRenderFns,
    // Only in development mode
    renderError (h, err) {
        return h('pre', { style: { color: 'red' }}, err.stack)
    }
})

// Create the socket
var io = io()

// send a msg back to Node-RED
// NR will generally expect the msg to contain a payload topic
var sendMsg = function(msg) {
    // Track how many messages have been recieved
    vm.msgSentCounter++

    io.emit('vueuiClient', msg)
}

// When the socket is connected .................
io.on('connect', function() {
    console.log('SOCKET CONNECTED')

    // When Node-RED vueui template node sends a msg over Socket.IO...
    io.on('vueui', function(wsMsg) {
        console.info('vueui:io.connect - msg received')
        console.dir(wsMsg)

        if ( (wsMsg !== null) && (wsMsg !== '') ) {
            // Extract any template source from the msg, if passed & remove from msg
            // Let Vue handle the recompile of the new template
            if ( 'template' in wsMsg ) {
                console.info('vueui:io.connect - template in msg')
                //console.dir(wsMsg)

                vm.template = wsMsg.template
                delete wsMsg.template
            }
            // Do we need to reflect input msgs to output?
            if ( '_fwdInMessages' in wsMsg ) {
                vm.fwdInMessages = wsMsg._fwdInMessages
                delete wsMsg._fwdInMessages
            }

            console.dir(Object.getOwnPropertyNames(wsMsg))
            // Use the remaining msg object as vue data
            if ( Object.getOwnPropertyNames(wsMsg).length > 0 ) {
                // Track how many messages have been recieved
                vm.msgCounter++

                //vm.$data.msg = wsMsg
                vm.updateMsg(wsMsg)
            }
        }
    }) // -- End of websocket recieve from Node-RED -- //

}) // --- End of socket connection processing ---

// When the socket is disconnected ..............
io.on('disconnect', function() {
    console.log('SOCKET DISCONNECTED')
    //io.emit('vueuiClient',{action:'disconnected'}) // debug - don't normally want to bombard the server
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
