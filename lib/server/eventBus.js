import { EventEmitter } from 'events';

if(Meteor.isServer) {
  const eventBus = new EventEmitter();
  eventBus.setMaxListeners(0);

  const buildArgs = function(args) {
    const eventName = args[0] + '-' + args[1];
    args = args.slice(2);
    args.unshift(eventName);
    return args;
  };
  
  Kadira.EventBus = {};

  ['on', 'emit', 'removeListener', 'removeAllListeners'].forEach(function(m) {
    Kadira.EventBus[m] = function(...args) {
      return eventBus[m].apply(eventBus, buildArgs(args));
    };
  });
}