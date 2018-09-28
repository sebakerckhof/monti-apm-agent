import Fibers from 'fibers';

const originalYield = Fibers.yield;
Fibers.yield = function() {
  const kadiraInfo = Kadira._getInfo();
  if(kadiraInfo) {
    const eventId = Kadira.tracer.event(kadiraInfo.trace, 'async');;
    if(eventId) {
      Fibers.current._apmEventId = eventId;
    }
  }

  return originalYield();
}

const originalRun = Fibers.prototype.run;
Fibers.prototype.run = function(val) {
  if(this._apmEventId) {
    const kadiraInfo = Kadira._getInfo(this);
    if(kadiraInfo) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, this._apmEventId);
      this._apmEventId = null;
    }
  }
  return originalRun.call(this, val);
}
