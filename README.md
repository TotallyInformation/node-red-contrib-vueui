# node-red-contrib-vueui

**2018-05-25** PLEASE NOTE THAT THIS PROJECT IS NO LONGER ACTIVE

It is kept for reference but the approach turned out to be a dead-end. If you wish to integrate Vue.JS front-end pages with Node-RED, please consider [node-red-contrib-uibuilder](https://github.com/TotallyInformation/node-red-contrib-uibuilder) which is a much more flexible approach to the same problem and certainly supports Vue and many more front-end libraries (or indeed vanilla HTML/JS).

------

A Node-RED UI template based on Vue.js

Designed as a simpler (for developers) alternative to the Node-RED Dashboard. Whereas Dashboard is great for creating a zero-code UI, it achieves
that at the cost of behind-the-scenes complexity.

Instead, this uses the much simpler Vue.js framework and a simple configuration and single template node so you need to know some HTML at least
and you will need to know a bit about Vue.js. But you should be able to use this to build anything you want to. Effectively, each instance of
this node will create a new single-page app.

## Current Status - Alpha

The things that are currently working, not or partly working or yet to be done are recorded
in the [Progress Project](https://github.com/TotallyInformation/node-red-contrib-vueui/projects/2).

## Pre-requisites

VueUI requires Node-RED version 0.16 or more recent. It uses Vue.JS v2.

## Install

Run the following command in your Node-RED user directory (typically `~/.node-red`):

```
npm install node-red-contrib-vueui
```

Open your Node-RED instance and you should have VueUI nodes available in the palette. The UI interface is available at <http://localhost:1880/vue> 
(if default Node-RED and node settings are used).

## Discussions and suggestions

Use the [Node-RED google group](https://groups.google.com/forum/#!forum/node-red) for general discussion about this node. Or use the
[GitHub issues log](https://github.com/TotallyInformation/node-red-contrib-vueui/issues) for raising issues or contributing suggestions and enhancements.

## Contributing

If you would like to contribute to this node, you can contact Totally Information via GitHub or raise a request in the GitHub issues log.

## Developers
