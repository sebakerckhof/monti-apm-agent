import pidusage from 'pidusage';
import EventLoopMonitor from 'evloop-monitor';
import KadiraModel from './kadira';

export default class SystemModel extends KadiraModel {
  constructor() {
    this.startTime = Ntp._now();
    this.newSessions = 0;
    this.sessionTimeout = 1000 * 60 * 30; //30 min
    this.evloopMonitor = new EventLoopMonitor(200);
    this.evloopMonitor.start();
  }

  buildPayload() { //XX: Check correctness
    const now = Ntp._now();
    const { cpu: pcpu, cpuInfo } = this.getUsage();
    const metrics = {
      startTime: Kadira.syncedDate.syncTime(this.startTime), // Repalce by imports
      endTime: Kadira.syncedDate.syncTime(now),
      sessions: Object.keys(Meteor.default_server.sessions).length,
      memory: process.memoryUsage().rss / (1024 * 1024),
      newSessions: this.newSessions,
      pcpu,

      // track eventloop blockness
      pctEvloopBlock: this.evloopMonitor.status().pctBlock,
    };
    
    this.newSessions = 0;
    
    if (cpuInfo) { //XXX: Check if we can just expand
      metrics.cputime = cpuInfo.cpuTime;
      metrics.pcpuUser = cpuInfo.pcpuUser;
      metrics.pcpuSystem = cpuInfo.pcpuSystem;
    }
   
    this.startTime = now;
    return { systemMetrics: [metrics] };
  }

  getUsage() {
    // XXX: should we propgate the promise upwards?
    const usage = Promise.await(pidusage(process.pid)) || {};
    Kadira.docSzCache.setPcpu(usage.cpu); // XXX: replace by import
    return usage;
  }

  handleSessionActivity(msg, session) {
    if (msg.msg === 'connect' && !msg.session) {
      this.countNewSession(session);
    } else if (['sub', 'method'].includes(msg.msg)) {
      if (!this.isSessionActive(session)) {
        this.countNewSession(session);
      }
    }
    session._activeAt = Date.now();
  }

  countNewSession({ socket }) {
    if (!isLocalAddress(socket)) {
      this.newSessions++;
    }
  }

  isSessionActive({ _activeAt: activeAt }) {
    const inactiveTime = Date.now() - activeAt;
    return inactiveTime < this.sessionTimeout;
  }
}

// ------------------------------------------------------------------------- //

// http://regex101.com/r/iF3yR3/2
const isLocalHostRegex = /^(?:.*\.local|localhost)(?:\:\d+)?|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/;

// http://regex101.com/r/hM5gD8/1
const isLocalAddressRegex = /^127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/;

function isLocalAddress (socket) {
  const host = socket.headers['host'];
  if (host) {
    return isLocalHostRegex.test(host);
  }
  const address = socket.headers['x-forwarded-for'] || socket.remoteAddress;
  if (address) {
    return isLocalAddressRegex.test(address);
  }
}
