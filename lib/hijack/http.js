import HTTP from 'meteor/http';

const originalCall = HTTP.call;

HTTP.call = function(method, url) {
  const kadiraInfo = Kadira._getInfo();
  let eventId;

  if(kadiraInfo) {
    eventId = Kadira.tracer.event(kadiraInfo.trace, 'http', {method: method, url: url});
  }

  try {
    const response = originalCall.apply(this, arguments);

    //if the user supplied an asynCallback, we don't have a response object and it handled asynchronously
    //we need to track it down to prevent issues like: #3
    const endOptions = HaveAsyncCallback(arguments)? {async: true}: {statusCode: response.statusCode};
    if(eventId) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, eventId, endOptions);
    }
    return response;
  } catch(ex) {
    if(eventId) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, eventId, {err: ex.message});
    }
    throw ex;
  }
};