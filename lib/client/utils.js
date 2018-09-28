export function getBrowserInfo() {
  return {
    browser: window.navigator.userAgent,
    userId: Meteor.userId && Meteor.userId(),
    url: location.href,
    resolution: getResolution()
  };
}

export function getResolution() {
  if(screen && screen.width && screen.height) {
    var resolution = `${screen.width}x${screen.height}`;
    return resolution;
  }
}


const toArray = (...args) => args;

export function getErrorStack(zone, callback) {
  const trace = [];
  const eventMap = zone.eventMap || {};
  const infoMap = zone.infoMap || {};

  trace.push({
    at: (new Date().getTime()),
    stack: zone.erroredStack.get()
  });

  function processZone() {
    // we assume, first two zones are not interesting
    // bacause, they are some internal meteor loading stuffs
    if(zone && zone.depth > 2) {
      let stack = "";
      if(zone.currentStack) {
        stack = zone.currentStack.get();
      }

      let events = eventMap[zone.id];
      let info = getInfoArray(infoMap[zone.id]);
      const ownerArgsEvent = events && events[0] && events[0].type == 'owner-args' && events.shift();
      let runAt = (ownerArgsEvent)? ownerArgsEvent.at : zone.runAt;
      let ownerArgs = (ownerArgsEvent)? toArray.apply(null, ownerArgsEvent.args) : [];

      // limiting
      events = events.slice(-5).map(checkSizeAndPickFields(100));
      info = info.slice(-5).map(checkSizeAndPickFields(100));
      ownerArgs = checkSizeAndPickFields(200)(ownerArgs.slice(0,5));

      zone.owner && delete zone.owner.zoneId;

      trace.push({
        createdAt: zone.createdAt,
        runAt,
        stack,
        owner: zone.owner,
        ownerArgs,
        events,
        info,
        zoneId: zone.id
      });
      zone = zone.parent;

      setTimeout(processZone, 0);
    } else {
      callback(trace);
    }
  }

  processZone();
}

export function getInfoArray (info = {}) {
  return info.map((value, type) => {
    value.type = type;
    return value;
  })
}

export function getTime() {
  if(Kadira && Kadira.syncedDate) {
    return Kadira.syncedDate.getTime();
  } else {
    return (new Date().getTime());
  }
}

export function getClientArch () {
  if (Meteor.isCordova) {
    return 'cordova.web';
  } else if (typeof Meteor.isModern === 'undefined' || Meteor.isModern) {
    return 'web.browser'
  } else {
    return 'web.browser.legacy'
  }
}

export function checkSizeAndPickFields (maxFieldSize) {
  return function(obj) {
    maxFieldSize = maxFieldSize || 100;
    for(var key in obj) {
      var value = obj[key];
      try {
        var valueStringified = JSON.stringify(value);
        if(valueStringified.length > maxFieldSize) {
          obj[key] = valueStringified.substr(0, maxFieldSize) + " ...";
        } else {
          obj[key] = value;
        }
      } catch(ex) {
        obj[key] = 'Error: cannot stringify value';
      }
    }
    return obj;
  }
}

// XXX: replace by fetch
export function httpRequest(method, url, options, callback) {
  /**
   * IE8 and IE9 does not support CORS with the usual XMLHttpRequest object
   * If XDomainRequest exists, use it to send errors.
   * XDR can POST data to HTTPS endpoints only if current page uses HTTPS
   */
  if (window.XDomainRequest) {
    const xdr = new XDomainRequest();
    url = matchPageProtocol(url);

    xdr.onload = function () {
      const headers = { 'Content-Type': xdr.contentType };
      var data = {};
      try {
        data = JSON.parse(content);
      } catch (e) {}

      callback(null, { content: xdr.responseText, data, headers, statusCode: 200 });
    }

    xdr.onerror = function () {
      callback({ statusCode: 404 });
    }

    xdr.open(method, url);
    xdr.send(options.content || null);

    function matchPageProtocol (endpoint) {
      var withoutProtocol = endpoint.substr(endpoint.indexOf(':') + 1);
      return window.location.protocol + withoutProtocol;
    }
  } else {
    HTTP.call(method, url, options, callback);
  }
};
