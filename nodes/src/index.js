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

// Variables to hold msg data and template src
var vmTemplate = 'Node-RED Vue UI: No template provided.'
var newTemplate = vmTemplate // Start with vm and new templates the same
var vmData = { msg: {} }
var vmComp = Vue.compile('<div id="app">' + vmTemplate + '</div>')

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

// Create an instance of Vue
var vm = new Vue({
    el: '#app',
    data: function() { return vmData },
    beforeUpdate: function() {
        // Send any UI changes to the data back to node-red
        if (Object.getOwnPropertyNames(this.msg).length > 0) {
            io.emit('vueuiClient', this.msg)
        }
    },
    //template: "<div id='app'><input v-model='compsrc'><vueui :template-src='compsrc'></vueui></div>"
    //computed: {
    //    newRenderFn: function() { return Vue.compile(this.compsrc).render },
    //    newStaticFns: function() { return Vue.compile(this.compsrc).staticRenderFns }
    //},
    render: vmComp.render,
    staticRenderFns: vmComp.staticRenderFns
})

// Create the socket
var io = io()

// When the socket is connected .................
io.on('connect', function() {
    console.log('SOCKET CONNECTED')

    io.emit('vueuiClient',{action:'connected'})

    // When Node-RED vueui template node sends a msg over Socket.IO...
    io.on('vueui', function(msg) {
        console.info('vueui msg received')
        console.log(JSON.stringify(msg))

        if ( 'template' in msg ) {
            // Extract any template source from the msg, if passed
            newTemplate = msg.template
            delete msg.template

            console.log(newTemplate)
            console.log(vmTemplate) // NOTE: vmTemplate is changed by compile!

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
        if (!newTemplate || Object.getOwnPropertyNames(msg).length > 0)
            vm.$data.msg = msg
    }) // -- End of websocket recieve from Node-RED -- //

}) // --- End of socket connection processing ---

// When the socket is disconnected ..............
io.on('disconnect', function() {
    console.log('SOCKET DISCONNECTED')

    io.emit('vueuiClient',{action:'disconnected'})
}) // --- End of socket disconnect processing ---

// EOF
