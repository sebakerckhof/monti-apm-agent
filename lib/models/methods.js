import KadiraModel from './kadira';
import TracerStore from '../tracer/tracer_store';

const METHOD_METRICS_FIELDS = ['wait', 'db', 'http', 'email', 'async', 'compute', 'total'];

export default class MethodsModel extends KadiraModel {
  constructor(metricsThreshold) {
    this.methodMetricsByMinute = Object.create(null);
    this.errorMap = Object.create(null);

    this._metricsThreshold = {
      "wait": 100,
      "db": 100,
      "http": 1000,
      "email": 100,
      "async": 100,
      "compute": 100,
      "total": 200,
      ...(metricsThreshold || Object.create(null))
    }

    //store max time elapsed methods for each method, event(metrics-field)
    this.maxEventTimesForMethods = Object.create(null);
    this.tracerStore = new TracerStore({ // XXX: Import
      interval: 1000 * 60,
      maxTotalPoints: 30,
      archiveEvery: 5 //always trace for every 5 minutes,
    });
    this.tracerStore.start();
  }
  _getMetrics(timestamp, method) {
    const dateId = this._getDateId(timestamp);

    if (!this.methodMetricsByMinute[dateId]) {
      this.methodMetricsByMinute[dateId] = {
        methods: Object.create(null),
      };
    }
  
    const methods = this.methodMetricsByMinute[dateId].methods;
    //initialize method
    if (!methods[method]) {
      methods[method] = {
        count: 0,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 0
      };
      METHOD_METRICS_FIELDS.forEach((field) => {
        methods[method][field] = 0;
      });
    }
    return this.methodMetricsByMinute[dateId].methods[method];
  }

  setStartTime(timestamp) {
    this.metricsByMinute[dateId].startTime = timestamp;
  }

  processMethod(methodTrace) {
    const dateId = this._getDateId(methodTrace.at);
    //append metrics to previous values
    this._appendMetrics(dateId, methodTrace);
    if (methodTrace.errored) {
      this.methodMetricsByMinute[dateId].methods[methodTrace.name].errors++;
    }
    this.tracerStore.addTrace(methodTrace);
  }

  _appendMetrics(id, methodTrace) {
    const methodMetrics = this._getMetrics(id, methodTrace.name);
    // startTime needs to be converted into serverTime before sending
    if (!this.methodMetricsByMinute[id].startTime) {
      this.methodMetricsByMinute[id].startTime = methodTrace.at;
    }

    //merge
    METHOD_METRICS_FIELDS.forEach(function (field) {
      var value = methodTrace.metrics[field];
      if (value > 0) {
        methodMetrics[field] += value;
      }
    });
    methodMetrics.count++;
    this.methodMetricsByMinute[id].endTime = methodTrace.metrics.at;
  }

  trackDocSize(method, size) {
    const timestamp = Ntp._now();
    const dateId = this._getDateId(timestamp);
    const methodMetrics = this._getMetrics(dateId, method);
    methodMetrics.fetchedDocSize += size;
  }

  trackMsgSize(method, size) {
    const timestamp = Ntp._now();
    const dateId = this._getDateId(timestamp);
    const methodMetrics = this._getMetrics(dateId, method);
    methodMetrics.sentMsgSize += size;
  }

  /*
    There are two types of data
  
    1. methodMetrics - metrics about the methods (for every 10 secs)
    2. methodRequests - raw method request. normally max, min for every 1 min and errors always
  */
  buildPayload() {
    const payload = {
      methodMetrics: [],
      methodRequests: []
    };

    //handling metrics
    const methodMetricsByMinute = this.methodMetricsByMinute;
    this.methodMetricsByMinute = Object.create(null);

    //create final paylod for methodMetrics
    for (var key in methodMetricsByMinute) { //XXX: REWORK
      var methodMetrics = methodMetricsByMinute[key];
      // converting startTime into the actual serverTime
      var startTime = methodMetrics.startTime;
      methodMetrics.startTime = Kadira.syncedDate.syncTime(startTime);
      for (var methodName in methodMetrics.methods) {
        METHOD_METRICS_FIELDS.forEach(function (field) {
          methodMetrics.methods[methodName][field] /=
            methodMetrics.methods[methodName].count;
        });
      }
      payload.methodMetrics.push(methodMetricsByMinute[key]);
    }

    //collect traces and send them with the payload
    payload.methodRequests = this.tracerStore.collectTraces();
    return payload;
  }
}