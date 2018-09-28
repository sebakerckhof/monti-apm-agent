const logger = getLogger();
function getLogger() {
  return function(message, ...args) {
    const canLogKadira =
      Meteor._localStorage.getItem('LOG_KADIRA') !== null
      && typeof console !== 'undefined';

    if(canLogKadira) {
      if(message) {
        message = `kadira:ntp ${message}`;
      }
      console.log(message, ...args);
    }
  }
}


class ClientNtp extends AbstractNtp {
  getServerTime(callback) {
    // XXX: Replace by fetch
    httpRequest('GET', this.endpoint, function(err, res) {
      if (err) {
        callback(err);
      } else {
        const serverTime = Number.parseInt(res.content, 10);
        callback(null, serverTime);
      }
    });
  }
}
