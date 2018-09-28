var logger = Npm.require('debug')('kadira:ts');

export default class TracerStore {
  constructor({
    maxTotalPoints = 30,
    interval = 1000 * 60
  } = {}) {
    this.maxTotalPoints = maxTotalPoints;
    this.interval = interval;
    this.archiveEvery = options.archiveEvery || this.maxTotalPoints / 6;

    //store max total on the past 30 minutes (or past 30 items)
    this.maxTotals = Object.create(null);
    //store the max trace of the current interval
    this.currentMaxTrace = Object.create(null);
    //archive for the traces
    this.traceArchive = [];

    this.processedCnt = Object.create(null);

    //group errors by messages between an interval
    this.errorMap = Object.create(null);

    this.processTraces = this.processTraces.bind(this);
  }

  addTrace(trace) {
    const kind = `${trace.type}::${trace.name}`;
    if(!this.currentMaxTrace[kind]) {
      this.currentMaxTrace[kind] = EJSON.clone(trace);
    } else if(this.currentMaxTrace[kind].metrics.total < trace.metrics.total) {
      this.currentMaxTrace[kind] = EJSON.clone(trace);
    } else if(trace.errored) {
      this._handleErrors(trace);
    }
  }

  collectTraces() {
    const traces = this.traceArchive;
    this.traceArchive = [];

    // convert at(timestamp) into the actual serverTime
    traces.forEach((trace) => {
      trace.at = Kadira.syncedDate.syncTime(trace.at);
    });
    return traces;
  }

  start() {
    this._timeoutHandler = setInterval(this.processTraces, this.interval);
  }

  stop() {
    if(this._timeoutHandler) {
      clearInterval(this._timeoutHandler);
    }
  }

  _handleErrors(trace) {
    // sending error requests as it is
    const lastEvent = trace.events[trace.events.length -1];
    if(lastEvent && lastEvent[2]) {
      const error = lastEvent[2].error;

      // grouping errors occured (reset after processTraces)
      const errorKey = [trace.type, trace.name, error.message].join("::");
      if(!this.errorMap[errorKey]) {
        const erroredTrace = EJSON.clone(trace);
        this.errorMap[errorKey] = erroredTrace;

        this.traceArchive.push(erroredTrace);
      }
    } else {
      logger('last events is not an error: ', JSON.stringify(trace.events));
    }
  }

  processTraces() {
    const kinds = [...new Set([
      ...Object.keys(this.maxTotals),
      ...Object.keys(this.currentMaxTrace)
    ])];

    kinds.forEach((kind) => {
      this.processedCnt[kind] = this.processedCnt[kind] || 0;
      const currentMaxTrace = this.currentMaxTrace[kind];
      const currentMaxTotal = currentMaxTrace? currentMaxTrace.metrics.total : 0;

      this.maxTotals[kind] = this.maxTotals[kind] || [];
      //add the current maxPoint
      this.maxTotals[kind].push(currentMaxTotal);
      const exceedingPoints = this.maxTotals[kind].length - this.maxTotalPoints;
      if(exceedingPoints > 0) {
        this.maxTotals[kind].splice(0, exceedingPoints);
      }

      const archiveDefault = (this.processedCnt[kind] % this.archiveEvery) == 0;
      this.processedCnt[kind]++;

      const canArchive = archiveDefault || isTraceOutlier(this.maxTotals[kind], currentMaxTrace);

      if(canArchive && currentMaxTrace) {
        this.traceArchive.push(currentMaxTrace);
      }

      //reset currentMaxTrace
      this.currentMaxTrace[kind] = null;
    });

    //reset the errorMap
    this.errorMap = Object.create(null);
  }
}

function isTraceOutlier(dataSet, trace) {
  if(trace) {
    return isOutlier(dataSet, trace.metrics.total, 3);
  } else {
    return false;
  }
}

function isOutlier(dataSet, dataPoint, maxMadZ) {
  const median = getMedian(dataSet);
  const mad = calculateMad(dataSet, median);
  const madZ = funcMedianDeviation(median)(dataPoint) / mad;

  return madZ > maxMadZ;
}

function getMedian(dataSet) {
  // XXX: Check data to find best clone strategy
  const sortedDataSet = _.clone(dataSet).sort((a, b) => a - b);
  return pickQuartile(sortedDataSet, 2);
}

function pickQuartile(dataSet, num) {
  const pos = ((dataSet.length + 1) * num) / 4;
  if(pos % 1 == 0) {
    return dataSet[pos -1];
  } else {
    pos = pos - (pos % 1);
    return (dataSet[pos -1] + dataSet[pos])/2
  }
}

function calculateMad(dataSet, median) {
  const medianDeviations = dataSet.map(funcMedianDeviation(median));
  const mad = getMedian(medianDeviations);

  return mad;
}

function funcMedianDeviation(median) {
  return (x => Math.abs(median - x));
}

function getMean(dataPoints) {
  if(dataPoints.length > 0) {
    const total = dataPoints.reduce((total, point) => total + point, 0);
    return total / dataPoints.length;
  } else {
    return 0;
  }
}
