import Fibers from 'fibers';

const eventLogger = Npm.require('debug')('kadira:tracer');
const REPITITIVE_EVENTS = {'db': true, 'http': true, 'email': true, 'wait': true, 'async': true};

export default class Tracer {
  constructor() {
    this._filters = [];
  }

  //In the future, we might wan't to track inner fiber events too.
  //Then we can't serialize the object with methods
  //That's why we use this method of returning the data
  start(session, msg) {
    var traceInfo = {
      _id: session.id + "::" + msg.id,
      session: session.id,
      userId: session.userId,
      id: msg.id,
      events: []
    };

    if(msg.msg == 'method') {
      traceInfo.type = 'method';
      traceInfo.name = msg.method;
    } else if(msg.msg == 'sub') {
      traceInfo.type = 'sub';
      traceInfo.name = msg.name;
    } else {
      return null;
    }

    return traceInfo;
  }

  event(traceInfo, type, data) {
    // do not allow to proceed, if already completed or errored
    const lastEvent = this.getLastEvent(traceInfo);
    if(lastEvent && ['complete', 'error'].includes(lastEvent.type)) {
      return false;
    }

    //expecting a end event
    let eventId = true;

    //specially handling for repitivive events like db, http
    if(REPITITIVE_EVENTS[type]) {
      //can't accept a new start event
      if(traceInfo._lastEventId) {
        return false;
      }
      eventId = traceInfo._lastEventId = DefaultUniqueId.get();
    }

    this._processEvent(type, traceInfo, data);
    return eventId;
  }

  eventEnd(traceInfo, eventId, data) {
    if(traceInfo._lastEventId && traceInfo._lastEventId == eventId) {
      const lastEvent = this.getLastEvent(traceInfo);
      const type = `${lastEvent.type}end`;
      this._processEvent(type, traceInfo, data);
      traceInfo._lastEventId = null;
      return true;
    } else {
      return false;
    }
  }

  _processEvent(type, traceInfo, data) {
    const event = {type, at: Ntp._now()};
    if(data) {
      event.data = this._applyFilters(type, data, { type: traceInfo.type, name: traceInfo.name }, "end");
    }
    traceInfo.events.push(event);
    eventLogger(`${type} ${traceInfo._id}`);
  }

  getLastEvent(traceInfo) {
    return traceInfo.events[traceInfo.events.length -1]
  };

  endLastEvent(traceInfo) {
    const lastEvent = this.getLastEvent(traceInfo);
    if(lastEvent && !/end$/.test(lastEvent.type)) {
      traceInfo.events.push({
        type: `${lastEvent.type}end`,
        at: Ntp._now()
      });
      return true;
    }
    return false;
  };

  buildTrace(traceInfo) {
    const firstEvent = traceInfo.events[0];
    const lastEvent = traceInfo.events[traceInfo.events.length - 1];
    const processedEvents = [];

    if(firstEvent.type != 'start') {
      console.warn('Kadira: trace is not started yet');
      return null;
    } else if(lastEvent.type != 'complete' && lastEvent.type != 'error') {
      //trace is not completed or errored yet
      console.warn('Kadira: trace is not completed or errored yet');
      return null;
    } else {
      //build the metrics
      traceInfo.errored = lastEvent.type == 'error';
      traceInfo.at = firstEvent.at;

      const metrics = {
        total: lastEvent.at - firstEvent.at,
      };

      let totalNonCompute = 0;

      firstEvent = ['start', 0];
      if(traceInfo.events[0].data) firstEvent.push(traceInfo.events[0].data);
      processedEvents.push(firstEvent);

      for(let lc=1; lc < traceInfo.events.length - 1; lc += 2) {
        const prevEventEnd = traceInfo.events[lc-1];
        const startEvent = traceInfo.events[lc];
        const endEvent = traceInfo.events[lc+1];
        const computeTime = startEvent.at - prevEventEnd.at;
        if(computeTime > 0) processedEvents.push(['compute', computeTime]);
        if(!endEvent) {
          console.error('Kadira: no end event for type: ', startEvent.type);
          return null;
        } else if(endEvent.type != startEvent.type + 'end') {
          console.error('Kadira: endevent type mismatch: ', startEvent.type, endEvent.type, JSON.stringify(traceInfo));
          return null;
        } else {
          const elapsedTimeForEvent = endEvent.at - startEvent.at
          const  currentEvent = [startEvent.type, elapsedTimeForEvent];
          currentEvent.push({ ...startEvent.data, ...endEvent.data});
          processedEvents.push(currentEvent);
          metrics[startEvent.type] = metrics[startEvent.type] || 0;
          metrics[startEvent.type] += elapsedTimeForEvent;
          totalNonCompute += elapsedTimeForEvent;
        }
      }

      computeTime = lastEvent.at - traceInfo.events[traceInfo.events.length - 2];
      if(computeTime > 0) processedEvents.push(['compute', computeTime]);

      const lastEventData = [lastEvent.type, 0];
      if(lastEvent.data) lastEventData.push(lastEvent.data);
      processedEvents.push(lastEventData);

      metrics.compute = metrics.total - totalNonCompute;
      traceInfo.metrics = metrics;
      traceInfo.events = processedEvents;
      traceInfo.isEventsProcessed = true;
      return traceInfo;
    }
  }

  addFilter(filterFn) {
    this._filters.push(filterFn);
  };

  _applyFilters(eventType, data, info) {
    this._filters.forEach((filterFn) => {
      // Check what data is to decide on clone strategy
      data = filterFn(eventType, _.clone(data), info);
    });

    return data;
  }
}

// XXX MOVE THESE
Kadira.tracer = new Tracer();
// need to expose Tracer to provide default set of filters
Kadira.Tracer = Tracer;