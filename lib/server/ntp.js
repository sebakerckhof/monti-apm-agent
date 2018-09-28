import Fiber from 'fibers';

const logger = getLogger();

function getLogger() {
  return Npm.require('debug')("kadira:ntp");
}

class ServerNtp extends AbstractNtp {
  
  getServerTime(callback) {

      new Fiber(function() {
        // Replace by fetch
        HTTP.get(self.endpoint, function (err, res) {
          if(err) {
            callback(err);
          } else {
            var serverTime = parseInt(res.content);
            callback(null, serverTime);
          }
        });
      }).run();

  }
  
}


