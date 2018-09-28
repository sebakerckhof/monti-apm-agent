import { Email } from 'meteor/email';

const originalSend = Email.send;

Email.send = function(options) {
  const kadiraInfo = Kadira._getInfo();
  let eventId;
  if(kadiraInfo) {
    const { from, to, cc, bcc, replyTo } = options;
    const data = { from, to, cc, bcc, replyTo };
    eventId = Kadira.tracer.event(kadiraInfo.trace, 'email', data);
  }
  try {
    const ret = originalSend.call(this, options);
    if(eventId) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, eventId);
    }
    return ret;
  } catch(ex) {
    if(eventId) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, eventId, {err: ex.message});
    }
    throw ex;
  }
};