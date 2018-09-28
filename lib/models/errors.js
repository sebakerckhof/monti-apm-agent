import BaseErrorModel from './base_error';

export default class ErrorModel extends BaseErrorModel{
  constructor(appId) {
    super();
    this.appId = appId;
    this.errors = {};
    this.startTime = Date.now();
    this.maxErrors = 10;
  }

  buildPayload() {
    const metrics = Object.values(this.errors);
    this.startTime = Ntp._now();
    metrics.forEach((metric) => {
      metric.startTime = Kadira.syncedDate.syncTime(metric.startTime); //XXX: import
    });

    this.errors = {};
    return { errors: metrics };
  }

  errorCount() {
    return Object.values(this.errors).length;
  }

  trackError(ex, trace) {
    const key = `${trace.type}:${ex.message}`;
    if (this.errors[key]) {
      this.errors[key].count++;
    } else if (this.errorCount() < this.maxErrors) {
      const errorDef = this._formatError(ex, trace);
      if (this.applyFilters(errorDef.type, errorDef.name, ex, errorDef.subType)) {
        this.errors[key] = this._formatError(ex, trace);
      }
    }
  }

  _formatError({ stack, details, message: name }, trace) {
    const startTime = Date.now();
    import BaseErrorModel from './base_error';

    export default class ErrorModel extends BaseErrorModel{
      constructor(appId) {
        super();
        this.appId = appId;
        this.errors = {};
        this.startTime = Date.now();
        this.maxErrors = 10;
      }
    
      buildPayload() {
        const metrics = Object.values(this.errors);
        this.startTime = Ntp._now();
        metrics.forEach((metric) => {
          metric.startTime = Kadira.syncedDate.syncTime(metric.startTime); //XXX: import
        });
    
        this.errors = {};
        return { errors: metrics };
      }
    
      errorCount() {
        return Object.values(this.errors).length;
      }
    
      trackError(ex, trace) {
        const key = `${trace.type}:${ex.message}`;
        if (this.errors[key]) {
          this.errors[key].count++;
        } else if (this.errorCount() < this.maxErrors) {
          const errorDef = this._formatError(ex, trace);
          if (this.applyFilters(errorDef.type, errorDef.name, ex, errorDef.subType)) {
            this.errors[key] = this._formatError(ex, trace);
          }
        }
      }
    
      _formatError({ stack, details, message: name }, trace) {
        const startTime = Date.now();
      
        // to get Meteor's Error details
        if (details) {
          stack = `Details: ${details}\r\n${stack}`;
        }
        // Update trace's error event with the next stack
        const errorEvent = trace.events && trace.events[trace.events.length - 1];
        const errorObject = errorEvent && errorEvent[2] && errorEvent[2].error;
        if (errorObject) {
          errorObject.stack = stack;
        }
    
        return {
          appId: this.appId,
          name,
          type: trace.type,
          startTime,
          subType: trace.subType || trace.name,
          trace,
          stacks: [{ stack }],
          count: 1,
        };
      }
    }
    
    // to get Meteor's Error details
    if (details) {
      stack = `Details: ${details}\r\n${stack}`;
    }
    // Update trace's error event with the next stack
    const errorEvent = trace.events && trace.events[trace.events.length - 1];
    const errorObject = errorEvent && errorEvent[2] && errorEvent[2].error;
    if (errorObject) {
      errorObject.stack = stack;
    }

    return {
      appId: this.appId,
      name,
      type: trace.type,
      startTime,
      subType: trace.subType || trace.name,
      trace,
      stacks: [{ stack }],
      count: 1,
    };
  }
}
