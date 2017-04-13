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

Vue.config.productionTip = false

// Variables to hold msg data and template src
var vmTemplate = 'Node-RED Vue UI: No template provided.'
var newTemplate = vmTemplate // Start with vm and new templates the same
var vmData = { msg: { topic:'', payload:{} } }
var vmComp = Vue.compile('<div id="app">' + vmTemplate + '</div>')

var myCounter = 0

/* Create a component to render the msg
Vue.component('vueui', function(resolve, reject) {
    var 
    resolve({
        props: ['templateSrc'],
        data: function() { return vmData },
        //template: this.templateSrc
        render: compiledSrc.render,
        staticRenderFns: compiledSrc.staticRenderFns
    })
})
*/

var watchMsg = function(newVal,oldVal){
    console.info('vueui:vm:watch:msg')
    console.dir(newVal)
    console.dir(oldVal)
    //if (Object.getOwnPropertyNames(this.msg).length > 0) {
        io.emit('vueuiClient', newVal)
    //}
}

// Create an instance of Vue
var vm = new Vue({
    el: '#app',
    data: function() { return vmData },
    // beforeUpdate is triggered just before the dom is updated
    beforeUpdate: function() {
        console.info('vueui:vm:beforeUpdate')
        // Send any UI changes to the data back to node-red
        if (Object.getOwnPropertyNames(this.msg).length > 0) {
            io.emit('vueuiClient', this.msg)
        }
    },
    // watch only triggers if you update the exact thing you are watching
    // if you watch msg and update msg.cat, it wont trigger
    watch: {
        'msg': {
            handler: function(newVal,oldVal){
                console.info('vueui:vm:watch:msg')
                //io.emit('vueuiClient', newVal)
            },
            deep: true
        },
        //'msg.payload.counter': function(newVal,oldVal){
        //    console.info('vueui:vm:watch:msg.payload.counter')
        //},
    },
    // Called for exents triggered in UI, e.g. click. May be called manually too
    methods: {
        updateMsg: function(event) {

        },
        updateCounter: function(event) {
            console.info('vueui:vm:methods:updateCounter')
            this.msg.payload.counter++
        }
    },
    //template: "<div id='app'><input v-model='compsrc'><vueui :template-src='compsrc'></vueui></div>"
    //computed: {
    //    newRenderFn: function() { return Vue.compile(this.compsrc).render },
    //    newStaticFns: function() { return Vue.compile(this.compsrc).staticRenderFns }
    //},
    render: vmComp.render,
    staticRenderFns: vmComp.staticRenderFns,

})

// Create the socket
var io = io()

// When the socket is connected .................
io.on('connect', function() {
    console.log('SOCKET CONNECTED')

    //io.emit('vueuiClient',{action:'connected'}) // debug - don't normally want to bombard the server

    // When Node-RED vueui template node sends a msg over Socket.IO...
    io.on('vueui', function(wsMsg) {
        console.info('vueui msg received')
        console.log(JSON.stringify(wsMsg))

        if ( 'template' in wsMsg ) {
            // Extract any template source from the msg, if passed
            newTemplate = wsMsg.template
            delete wsMsg.template

            // If msg.template has changed, compile and replace existing template
            if (newTemplate !== vmTemplate) {
                console.info('vueui: recompiling template')

                vmTemplate = newTemplate
                vmComp = Vue.compile('<div id="app">' + vmTemplate + '</div>')
                vm.$options.render = vmComp.render
                vm.$options.staticRenderFns = vmComp.newStaticFns
                vm.$forceUpdate()
            }
        }

        // Use the remaining msg object as vue data
        if ( Object.getOwnPropertyNames(wsMsg).length > 0 ) {
            vm.$data.msg = wsMsg
        }
    }) // -- End of websocket recieve from Node-RED -- //

}) // --- End of socket connection processing ---

// When the socket is disconnected ..............
io.on('disconnect', function() {
    console.log('SOCKET DISCONNECTED')

    //io.emit('vueuiClient',{action:'disconnected'}) // debug - don't normally want to bombard the server
}) // --- End of socket disconnect processing ---

setInterval(function(){
    //console.count('me')
    myCounter++
    //vm.$data.msg = { topic: "setInterval", payload: {counter: myCounter, some: "fred", cat:"bark"} }
    vm.$data.msg.payload.counter = myCounter
    //Vue.nextTick(function () {
    //    console.dir(vm.msg.payload)
    //})
},10000)
// EOF
