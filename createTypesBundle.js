const { spec } = require('@docknetwork/node-types')
// console.debug('spec', spec)
// spec['dock-pos-main-runtime']
const typesBundle = spec['dock-pos-main-runtime'] // .types // .typesBundle
console.debug(JSON.stringify(typesBundle, null, 2))
