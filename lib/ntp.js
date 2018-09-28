const logger = getLogger();

class Ntp {
  constructor(logger, endpoint) {
    this.setEndpoint(endpoint);
    this.logger = logger;
    this.diff = 0;
    this.synced = false;
    this.reSyncCount = 0;
    this.reSync = new Retry({
      baseTimeout: 1000*60,
      maxTimeout: 1000*60*10,
      minCount: 0
    });

    this.sync = this.sync.bind(this);
  }

  static _now() {
    const now = Date.now();
    if(typeof now == 'number') {
      return now;
    } else if(now instanceof Date) {
      // some extenal JS libraries override Date.now and returns a Date object
      // which directly affect us. So we need to prepare for that
      return now.getTime();
    } else {
      // trust me. I've seen now === undefined
      return (new Date()).getTime();
    }
  }

  setEndpoint(endpoint) {
    this.endpoint = endpoint + '/simplentp/sync';
  }

  getTime() {
    return Ntp._now() + Math.round(this.diff);
  }

  syncTime(localTime) {
    return localTime + Math.ceil(this.diff);
  }

  sync() {
    logger('init sync');

    let retryCount = 0;
    const retry = new Retry({
      baseTimeout: 1000*20,
      maxTimeout: 1000*60,
      minCount: 1,
      minTimeout: 0
    });

    const syncTime = () => {
      if(retryCount<5) {
        logger('attempt time sync with server', retryCount);
        // if we send 0 to the retryLater, cacheDns will run immediately
        retry.retryLater(retryCount++, cacheDns);
      } else {
        logger('maximum retries reached');
        this.reSync.retryLater(this.reSyncCount++, this.sync);
      }
    }

    // first attempt is to cache dns. So, calculation does not
    // include DNS resolution time
    const cacheDns = () => {
      this.getServerTime((err) => {
        if(!err) {
          calculateTimeDiff();
        } else {
          syncTime();
        }
      });
    }

    const calculateTimeDiff = () => {
      const clientStartTime = (new Date()).getTime();
      this.getServerTime((err, serverTime) => {
        if(!err && serverTime) {
          // (Date.now() + clientStartTime)/2 : Midpoint between req and res
          const networkTime = ((new Date()).getTime() - clientStartTime)/2
          const serverStartTime = serverTime - networkTime;
          this.diff = serverStartTime - clientStartTime;
          this.synced = true;
          // we need to send 1 into retryLater.
          this.reSync.retryLater(this.reSyncCount++, this.sync);
          logger('successfully updated diff value', this.diff);
        } else {
          syncTime();
        }
      });
    }

    syncTime();
  }

  getServerTime(callback) {
    throw new Error('not implemented');
  }
  
}


function getLogger() {
  if(Meteor.isServer) {
    return Npm.require('debug')("kadira:ntp");
  } else {
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
}
